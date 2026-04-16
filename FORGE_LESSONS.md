# Forge Lessons

> Repo: Nkburdick/oracle-app | Runtime: Bun | Lockfile: bun.lock | Framework: SvelteKit

Hard-won rules from prior Forge dispatch cycles. Read this file before starting work on any PRD.
These are NOT suggestions — they are corrections from actual failures that cost time to debug.

## Package Manager: Bun (CRITICAL)

This repo uses **Bun**, not npm. The lockfile is `bun.lock`.

- Run `bun install` to add dependencies. NEVER run `npm install`.
- NEVER commit `package-lock.json`. If one appears, delete it.
- The Docker build reads `bun.lock`. A stale `bun.lock` paired with a `package-lock.json` produces
  inconsistent builds that fail on deploy.

**Why:** Three consecutive Forge dispatches (PR #50, #51, #54 on Pennyworth; PR #3 on oracle-app)
committed `package-lock.json`. Each required manual cleanup. The Docker build on KVM2 uses Bun
and breaks when lockfiles diverge.

## PRD Verbatim Code Blocks Are The Spec

When the PRD contains a TypeScript code block with exact type definitions, field names, or enum
values — implement them **character-for-character**. Do not:

- Rename fields (e.g., `content` → `title`, `description` → `notes`)
- Invent alternative enum values (e.g., `todo` instead of `ready`, `aol` instead of `pennyworth`)
- Add fields not in the spec (e.g., `dueDate`, `oracleSlug` when not specified)
- Split types into base + extension (e.g., `Task` + `StoredTask`) when the PRD shows one type
- Mix naming conventions (e.g., `camelCase` when the spec uses `snake_case`)

**Why:** PR #50 (Pennyworth Phase 1, first dispatch) drifted on every field name, enum value,
and storage architecture. The PRD said `content`; Forge wrote `title`. The PRD said
`"nick" | "alfred" | "pennyworth" | "forge"`; Forge wrote `"nick" | "aol" | "forge" | "unassigned"`.
PR #54 (Phase 2) had two competing type systems with different names for the same concept.
Each required 30+ minutes of manual patching.

## PRD Anti-Lists Are Corrections From Prior Attempts

When the PRD includes an "Anti-list" or "Do NOT" section, those items are specific mistakes
from a prior Forge dispatch that was rejected. Follow them literally — they exist because
Forge already made that exact mistake once.

## Storage Architecture: Read The PRD Carefully

If the PRD says "per-project file at `Projects/${slug}/tasks.json`," implement per-project files.
Do NOT create a single global file and filter by a field at read time. The storage architecture
is a deliberate design decision, not a suggestion.

**Why:** PR #50 stored all tasks in a single `Projects/pennyworth/tasks.json` and filtered by
`oracleSlug`. The PRD explicitly specified per-project files. This required a full storage
layer rewrite.

## No .DS_Store

macOS drops `.DS_Store` files. Never commit them. Check `git status` before committing and
exclude any `.DS_Store` files from staging.

## Drizzle Migrations

When adding or modifying a Drizzle schema table, you MUST generate AND commit the migration:
```bash
bunx drizzle-kit generate
```
Schema-only changes without a migration silently break queries at runtime.
