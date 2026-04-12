# Oracle App — Phase 2 Scoping

**Status:** SUPERSEDED IN PARTS — see §8 Update Log (2026-04-07) at the bottom for current state.
**Original status:** Draft — written 2026-04-06 while MVP Shell job `Nuss7vFycaSw` is in flight on the Forge.
**Purpose:** Inventory what Phase 2 needs, surface open questions, and recommend a sequencing strategy. The original document below is the 2026-04-06 snapshot; §8 captures what's actually shipped and what's now locked in subsequent days.

---

## 1. Phase 2 Scope Inventory (from MVP Shell PRD deferrals)

These are the features the MVP PRD explicitly defers to Phase 2. Pulled from `PRD.md` — section references in parentheses.

| #   | Feature                                                     | PRD §                        | Spec Maturity                                                                     | Backend Lift                                                  | Frontend Lift                                      |
| --- | ----------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **Multi-thread chat** (per-project, persistent + throwaway) | 4.7                          | **High** — full layout, thread types, mobile pattern documented                   | **Medium** — schema migration, SSE streaming, thread API      | **Medium-High** — wires up existing 2-panel layout |
| 2   | **Mobile chat two-screen pattern**                          | 4.7 §Mobile                  | High — flow documented                                                            | None (uses #1)                                                | Medium — back-nav, state preservation              |
| 3   | **Global FAB throwaway chat**                               | 4.8                          | Medium — purpose + behavior, no UX details                                        | Reuses #1 backend                                             | Low-Medium — overlay component, slide-up panel     |
| 4   | **Drag-and-drop sidebar reorder**                           | 4.4 §Phase 2 plan            | **High** — library, interaction, persistence, smart sort_order calc all spec'd    | **Low** — single PATCH endpoint                               | **Low-Medium** — `svelte-dnd-action` integration   |
| 5   | **Artifacts tab** (file mgmt within projects)               | 5.2, 4.6                     | **Low** — only "files Pennyworth creates AND files Nick uploads, synced to Drive" | **Medium-High** — upload, list, Drive sync extension          | **Medium** — file list, upload UI, preview         |
| 6   | **In-app editing** (replace Edit-in-GitHub link)            | 5.2, 6.1 §Phase 2            | **Low** — only "POST to Pennyworth's write API → commit → SSE broadcast"          | **Medium** — file write API, GitHub commit, conflict handling | **Medium-High** — markdown editor, save/cancel UX  |
| 7   | **Search**                                                  | 4.5, 5.2, "Out of scope" §38 | **Very Low** — vertical space reserved, no spec                                   | **Medium** — FTS5 index, search API                           | **Low** — input + results dropdown                 |
| 8   | **Default tab change** (SOW → Chats)                        | 5.2 line 447                 | Trivial                                                                           | None                                                          | Trivial                                            |
| 9   | **Theme toggle relocation** to Settings page                | 4.5 line 263                 | Trivial                                                                           | None                                                          | Low                                                |
| 10  | **DnD reorder one-time migration**                          | 4.4 §"One-time migration"    | Trivial                                                                           | One script                                                    | None                                               |

**Total: 10 sub-features.** Some are trivial (#8, #9, #10), some are large (#1, #5, #6).

---

## 2. Pennyworth Backend State (verified 2026-04-06)

The existing API surface in `~/Code/Pennyworth/src/api/server.ts`:

| Endpoint                              | Status               | Phase 2 Reuse                                                                                                                                                            |
| ------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/health`                     | ✅ Live, public      | Reuse as-is                                                                                                                                                              |
| `POST /api/chat`                      | ✅ Live, Bearer auth | **Foundation for #1 chat** — already accepts `message`, `conversationId`, `oracleSlug`. Persists to SQLite via Drizzle. Returns `{response, conversationId, artifacts}`. |
| `GET /api/conversations`              | ✅ Live              | **Foundation for thread list** — already returns id/title/oracleSlug/timestamps. Need to filter by project + add ephemeral flag.                                         |
| `GET /api/conversations/:id/messages` | ✅ Live              | **Foundation for thread history** — reuse as-is.                                                                                                                         |
| `POST /api/tasks`                     | ✅ Live              | Reuse for long-running operations (research, council debates)                                                                                                            |
| `GET /api/tasks/:id`                  | ✅ Live              | Reuse                                                                                                                                                                    |
| `DELETE /api/tasks/:id`               | ✅ Live              | Reuse                                                                                                                                                                    |

**This is great news.** Pennyworth's chat foundation is already shipped — Phase 2 chat is mostly _additive_ (multi-thread features, SSE streaming) rather than building from scratch.

### 2.1 Pennyworth gaps for Phase 2

> **⚠ Gap discovered during MVP Shell pre-dispatch verification (2026-04-06):** Pennyworth has **no code path to create a new ORACLE project or area**. The existing `oracle-writer.ts` only writes handoffs into _existing_ `Projects/<slug>/handoffs/` directories via the GitHub Contents API — it never PUTs a new `PROJECT.md` or `AREA.md`. The MVP PRD §4.4 line 215 says _"Pennyworth's project template needs a one-line update"_ to include `sort_order: 999` on creation, but that framing is wrong: **the whole function doesn't exist yet.** Adding it is a new `createOracleProject()` / `createOracleArea()` with frontmatter template, slug validation, duplicate detection, and GitHub PUT — roughly mirroring the existing `writeHandoffToOracle()` pattern. **Filed as `Nkburdick/pennyworth#25` and cross-referenced in `Nkburdick/ORACLE#18`.** This is a **hard prerequisite for the Phase 2B FAB chat feature** (since the FAB is supposed to create projects on the fly — PRD §4.8 line 389). Also relevant to any other future automation that spins up projects programmatically.

#### Schema additions

- Add `is_ephemeral BOOLEAN DEFAULT FALSE` to `conversations` table
- Add `last_seen_at` timestamp for throwaway TTL purge
- Index on `oracle_slug` for fast per-project thread lookup
- Drizzle migration `drizzle/00XX_phase2_oracle_chat.sql`

#### New endpoints

- `GET /api/projects/:slug/threads` — list threads for a project (could just be a query param on existing `/api/conversations` instead)
- `POST /api/conversations` (or extend chat endpoint) — create empty thread without sending a message
- `DELETE /api/conversations/:id` — explicit thread delete
- `PATCH /api/conversations/:id` — rename thread, toggle ephemeral
- `GET /api/chat/stream/:conversationId` — **SSE streaming endpoint** for token-by-token chat responses (large lift; requires refactoring `handleChat`)
- `POST /api/oracle/projects` — create new PROJECT.md (the issue we filed: `Nkburdick/pennyworth#25`)
- `POST /api/oracle/areas` — same for areas
- `PATCH /api/oracle/files/:type/:slug` — write/update PROJECT.md frontmatter (drag-drop sort_order, in-app edit)
- `POST /api/oracle/artifacts` — upload artifact, save to Drive, record in DB
- `GET /api/oracle/search?q=` — full-text search across PROJECT.md/AREA.md/handoffs (SQLite FTS5)

#### Background workers

- Throwaway thread purge job (cron in `src/checks/`?)
- chokidar→SSE bridge for cross-client cache invalidation (already planned in MVP §6.1, verify it broadcasts from Pennyworth out to Oracle App rather than within Oracle App only)

#### CORS

- Oracle App at `oracle.aptoworks.cloud` → Pennyworth at `pennyworth.aptoworks.cloud` (or similar). Cross-origin requires CORS middleware on `/api/*`.

---

## 3. Oracle App Frontend Gaps for Phase 2

| Feature                 | New components/files                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-thread chat       | `ThreadList.svelte`, `ChatMessage.svelte`, `MessageInput.svelte`, SSE client wrapper, sticky-input scroll logic, "↓ new message" pill |
| Mobile chat             | Responsive routing for `/projects/[slug]/chats/[threadId]`, back-nav state preservation                                               |
| FAB chat                | `GlobalChatFAB.svelte`, slide-up panel (`Sheet` from shadcn-svelte), keyboard shortcut (`?` or `cmd+k`?)                              |
| DnD reorder             | `svelte-dnd-action` install, drag handles in `ProjectListItem.svelte`, optimistic update store, error revert                          |
| Artifacts               | `ArtifactsList.svelte`, drop zone, file preview modal (PDF/image/markdown), Drive link                                                |
| In-app edit             | Markdown editor (CodeMirror 6 or similar), save/cancel toolbar, conflict warning if SSE invalidates while editing                     |
| Search                  | `SearchInput.svelte` in sidebar (use the reserved space from MVP §AC-49), results dropdown, keyboard nav                              |
| Default tab change      | One-line config change in `ProjectDetail.svelte`                                                                                      |
| Theme toggle relocation | Move from sidebar footer to `/settings` route, update `Settings.svelte`                                                               |

---

## 4. Critical Open Questions for Nick (need answers before drafting Phase 2 PRD)

**Sequencing & scope:**

1. **One PRD or split?** — Phase 2 has 10 sub-features ranging from trivial to multi-week. Three options:
   - (a) **Single big Phase 2 PRD** like MVP Shell (high coordination, single Forge dispatch, longer review cycle)
   - (b) **Split into 2-3 medium PRDs** (recommended below — see §5)
   - (c) **One PRD per sub-feature** (heavy PRD overhead)

2. **What ships first?** — If splitting, what's the MVP-of-Phase-2? My guess: chat (#1) is highest user value. But drag-drop (#4) is contained and would let you start using sort_order without Alfred's terminal.

**Chat-specific:**

3. **Throwaway thread retention** (PRD §4.7 says "TBD when Phase 2 lands"):
   - Session-only (gone on browser close)?
   - Auto-purge after N days (suggest 7)?
   - Or hybrid: session-only for FAB chat, 7-day for project Chats throwaway?

4. **SSE streaming priority** — Pennyworth's current `POST /api/chat` returns the full response after generation. Phase 2 wants token streaming. Is streaming a Phase 2 _requirement_ or a nice-to-have we can defer to Phase 2.5? (Defer would let us ship chat faster.)

5. **Pennyworth's Agent SDK** — Current `handleChat()` likely uses the Anthropic SDK directly. Streaming requires refactoring to the Agent SDK's streaming events. Confirm this is the right time to do that refactor (or if there's an existing in-flight effort).

**Write-back features:**

6. **In-app editing scope** — Full markdown editor (CodeMirror 6) with live preview, OR simpler "edit one section at a time" patch UI? The full editor is much more work but more powerful.

7. **Conflict handling** — If the file changes via git/Alfred while you're editing in Oracle App, what happens? Hard-overwrite (last write wins, lose work)? Show diff and ask? Lock the file while editing?

8. **Artifacts storage** — PRD §5.2 says "synced to the project's Google Drive folder". Pennyworth has `google-drive.ts` already. Confirm: artifacts are Drive-backed (not local filesystem on KVM 2)? What file size limit? What MIME types?

**Search:**

9. **Search scope** — PROJECT.md and AREA.md only? Or also handoffs? Or also chat history? Each layer adds index complexity.

10. **Search UI placement** — MVP reserves vertical space _above_ the PROJECTS header in the sidebar (PRD §AC-49). Confirm that's where Phase 2 puts the input, or do we want a global cmd+k modal instead?

**Auth & exposure:**

11. **Authentication** — MVP has no user auth (it's single-user, trusted network). Once chat with project context is exposed at `oracle.aptoworks.cloud`, do we need auth? (Cloudflare Access is the easy answer — zero code, SSO, no Pennyworth changes.)

12. **API token rotation** — Pennyworth uses `AOL_API_TOKEN` Bearer auth. The Oracle App will need this token. How does Oracle App get it — env var at deploy time, OAuth flow, something else?

**Operational:**

13. **Phase 2 dispatch policy** — MVP Shell got 8/8 PRD gate before dispatch. Phase 2 sub-PRDs should hit the same bar. Confirm.

14. **Pennyworth#25 ordering** — The createOracleProject issue is a Phase 2 prerequisite for the FAB chat (which can create projects). Bundle into the same PRD or ship Pennyworth#25 first as a standalone PR?

---

## 5. Recommended Sequencing (my proposal — Nick to review)

### Option A: "Two-track" — recommended

Split Phase 2 into **two PRDs that can be developed in parallel** (one Oracle-frontend-heavy, one Pennyworth-backend-heavy):

#### **Phase 2A — "Sidebar Polish + Editing"** (frontend-leaning)

- Drag-and-drop reorder (#4)
- In-app editing (#6) — without conflict handling, lock-on-edit for safety
- Search (#7) — sidebar input, FTS5 backend
- Default tab change (#8) — bundle in
- Theme toggle relocation (#9) — bundle in
- One-time DnD migration (#10) — bundle in
- **Pennyworth backend deps:** PATCH file API, FTS5 search API
- **Estimated PRD size:** ~600 lines, ~80 ACs

#### **Phase 2B — "Chat + Artifacts"** (backend-leaning)

- Multi-thread chat (#1) — extends existing `/api/chat`
- Mobile chat two-screen (#2)
- Global FAB chat (#3)
- Artifacts (#5)
- Pennyworth#25 (createOracleProject) — bundle here so FAB can create projects
- **Pennyworth backend deps:** schema migration, thread CRUD, SSE streaming, artifact upload, project creation
- **Estimated PRD size:** ~1,200 lines, ~150 ACs (similar size to MVP Shell)

**Why split this way:** 2A is mostly frontend with small backend touches → can dispatch quickly after polish. 2B has the backend heavy lifting and biggest UX surface area → needs more PRD iteration. Splitting lets 2A ship 2-3x faster than 2B and unblocks Nick from depending on Alfred's terminal for sort_order changes.

### Option B: "Big bang" — single Phase 2 PRD

One ~2,000-line PRD covering everything. Single Forge dispatch, longest cycle time, highest coordination cost. Only worth it if there are tight cross-feature dependencies I'm missing.

### Option C: "Chat first" — Phase 2A is chat only

Ship #1 chat alone first (most user value), then Phase 2B is everything else. Risk: chat is the highest-complexity item and would be the _slowest_ thing to ship.

**My vote: Option A.** Confirms the value of the issue we filed (Pennyworth#25 lives in 2B), respects feedback rule about staging-only large changes, and lets the sidebar polish ship while we deep-dive on chat.

---

## 6. What Happens Next

When Nick is back from his break, the recommended workflow is:

1. **Review this scoping doc** together. Adjust assumptions.
2. **Answer the 14 open questions** in §4 (or defer ones that need more thought).
3. **Lock the sequencing** (Option A vs B vs C).
4. **Schedule a project-definition deep-dive** for the chosen first PRD per `feedback_project_definition_sessions.md` — collaborative First Principles / 5 Whys session, not a rushed solo draft.
5. **Draft the PRD** with the Engineer + Architect re-review pattern that worked for StrideMind push notifications and Oracle App MVP Shell.
6. **PRD gate** before dispatch (target: 8/8 like MVP Shell).
7. **Forge dispatch** with the same monitoring pattern as job `Nuss7vFycaSw`.

---

## 7. Pre-Phase-2 Chores (can be done independently)

Things we can knock out _before_ the Phase 2 PRD walkthrough that won't change based on Nick's answers:

- [ ] **Verify MVP Shell ships clean** — once `Nuss7vFycaSw` completes, confirm no architectural surprises in the built code that change Phase 2 assumptions.
- [ ] **Inventory Pennyworth's existing chat behavior** — does `handleChat()` already support multi-turn? How does it persist? Read `src/services/chat.ts` end-to-end.
- [ ] **Check if SSE infrastructure exists in Pennyworth** — chokidar+SSE was mentioned in MVP §6.1 but I don't yet know if it's implemented or planned. This affects Phase 2 chat streaming and live update broadcasts.
- [ ] **Survey existing Pennyworth tests** — Phase 2 will need real DB integration tests this time (StrideMind taught us that lesson — see issues #299 and #300 on stridemind-ai).
- [ ] **Migration headers** — confirm `drizzle/` migration numbering pattern so Phase 2 migration files don't collide.
- [ ] **CORS middleware decision** — Cloudflare-side or Hono middleware? Both work; pick one consistently.
- [ ] **Cloudflare Access for `oracle.aptoworks.cloud`** — set up before Phase 2 ships to get auth for free without writing code.

---

## References

- MVP Shell PRD: `~/Code/ORACLE/app/docs/PRD.md` (1087 lines, 131 ACs)
- Design system: `~/Code/ORACLE/app/docs/DESIGN_SYSTEM.md`
- Frontmatter spec: `~/Code/ORACLE/app/docs/FRONTMATTER_SPEC.md`
- Mockup (Phase 2 multi-thread chat shown): `~/Code/ORACLE/app/docs/mockups/oracle-mockup-v3.html`
- Pennyworth API: `~/Code/Pennyworth/src/api/server.ts`
- Pennyworth chat handler: `~/Code/Pennyworth/src/services/chat.ts`
- Forge dispatch tracking: memory `project_oracle_app_forge_dispatched.md`
- Pennyworth#25 (createOracleProject): https://github.com/Nkburdick/pennyworth/issues/25
- ORACLE#18 (Phase 2 prereq tracking): https://github.com/Nkburdick/ORACLE/issues/18

---

## 8. Update Log — 2026-04-07 (end of day)

What actually happened between this scoping doc and now:

### 8.1 MVP Shell shipped + deployed

- Forge job `Nuss7vFycaSw` completed 2026-04-07T00:03Z (~61 min)
- Deployed live at https://oracle.aptoworks.cloud (BasicAuth) on KVM 2 — `oracle Up healthy`
- 5 deploy bugs caught by manual pre-deploy review and first-deploy debugging — see `feedback_forge_deploy_config_validation.md` for the rule the Forge needs to learn
- See `project_oracle_app_forge_dispatched.md` for the full deploy postmortem

### 8.2 Phase 2 sequencing — DECIDED on Option A (two-track split)

The "Option A: Two-track" recommendation in §5 was adopted. Phase 2 is now split into:

- **Phase 2A** — sidebar polish + in-app editing (frontend-leaning) — PRD not yet drafted, queued
- **Phase 2B** — chat + artifacts (backend-leaning) — partially shipped, see below

### 8.3 Phase 2.B.prep (Pennyworth backend prereqs) — 6 of 8 DONE

Shipped today via 7 Pennyworth PRs (#26, #28, #29, #30, #31, #32, #33):

| #   | Item                                                              | Shipped               | Tested                |
| --- | ----------------------------------------------------------------- | --------------------- | --------------------- |
| 1   | Schema migration (`is_ephemeral`, indexes)                        | ✅ #26+#28+#29        | ✅ #32 (9 tests)      |
| 2   | Thread CRUD (GET/POST/PATCH/DELETE `/api/conversations`)          | ✅ #26                | ✅ #32 (16 tests)     |
| 3   | CORS middleware on `/api/*`                                       | ✅ #26                | ✅ #32 (2 tests)      |
| 4   | Throwaway thread purge cron                                       | ✅ #28                | ✅ #31 (6 tests)      |
| 5   | `createOracleProject` + `createOracleArea` (closes Pennyworth#25) | ✅ #30                | ✅ **#33 (21 tests)** |
| 6   | API integration test infra (vitest + real-DB)                     | ✅ #31+#32            | —                     |
| 7   | Artifact upload + Drive integration                               | ⏭ Not started        | —                     |
| 8   | SSE streaming endpoint                                            | ⏭ Deferred to 2.B.1+ | —                     |

**Test count:** 43 → **102 passing** (+59 today, all on Pennyworth `main`).

### 8.4 Phase 2.B Minimal Chat PRD — READY TO BUILD

Drafted, deep-dove, and merged today as ORACLE#24 — lives at `app/docs/PHASE_2B_MINIMAL_CHAT_PRD.md`. Status: READY. **40 acceptance criteria** across 9 subsections. All 10 contentious UX questions resolved in a synchronous deep-dive. Decision summary:

| Q   | Locked answer                                                                   |
| --- | ------------------------------------------------------------------------------- |
| Q1  | Instant throwaway thread on `[+ New]`, zero clicks                              |
| Q2  | Thread list shows persistent + throwaway both, sorted by recent                 |
| Q3  | Promote = rename auto-promotes OR `★` toggle in row hover                       |
| Q4  | `+page.server.ts` loader, SSR'd on first paint                                  |
| Q5  | Hybrid optimistic + silent background reconcile after Send                      |
| Q6  | Cmd/Ctrl+Enter sends desktop; mobile = Send button only; Enter always = newline |
| Q7  | Hover ✕ on row (long-press mobile); confirm only for persistent                 |
| Q8  | Auto-select most-recent thread on tab open                                      |
| Q9  | Moot — Q1=a means no modal, no placeholder needed                               |
| Q10 | One silent auto-retry after 1s, then manual `[Retry]`                           |

The PRD intentionally **defers** SSE streaming, FAB, artifacts, mobile two-screen, markdown rendering, and council UI to sub-phases 2.B.1-5.

### 8.5 What's still open in §1 / §4 of the original scoping doc

The 14 questions in §4 are partially answered:

- **Q1** (one PRD or split) → **Option A** chosen
- **Q3** (throwaway retention) → **7-day auto-purge** (shipped via #28)
- **Q4** (SSE streaming priority) → **deferred to 2.B.1+** (not in minimal chat scope)
- **Q11** (auth) → **Traefik BasicAuth** at the edge (zero code, single-user)
- **Q14** (Pennyworth#25 ordering) → **shipped first** as PR #30

The rest (#2 sequencing details, #5 Agent SDK refactor, #6-8 in-app editing scope, #9-10 search) are still **open** and will be addressed when Phase 2A and Phase 2.B.1+ get their own PRDs.

### 8.6 Pre-Phase-2 chores (§7) — status

- [x] MVP Shell ships clean — yes, deployed + healthy
- [x] Inventory Pennyworth's existing chat behavior — done during Phase 2.B.prep
- [x] Survey existing Pennyworth tests — done; vitest migration shipped (#31)
- [ ] SSE infrastructure check — deferred (not needed for minimal chat)
- [ ] Migration header collision check — deferred (Pennyworth uses inline schema bootstrap, not numbered files)
- [x] CORS middleware decision — Hono middleware (shipped #26)
- [x] Auth setup — Traefik BasicAuth at the edge (deployed)

### 8.7 What's next

Phase 2.B Minimal Chat is buildable right now. Either:

- Hand to Forge (currently busy with StrideMind) when it frees up, or
- Build directly (Alfred has clean context and Forge is busy)

Phase 2A (sidebar polish + editing) PRD draft is queued behind Phase 2.B build.
