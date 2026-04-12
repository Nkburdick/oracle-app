---
doc: FRONTMATTER_SPEC
project: Oracle / ORACLE PARA
status: v1 — Forge dispatch baseline
created: 2026-04-06
---

# ORACLE Frontmatter Specification

This document is the **contract** for what every `PROJECT.md` and `AREA.md` file in the ORACLE repo must contain (and may optionally contain). It applies to:

- **Oracle App** — reads frontmatter to render the sidebar, dashboard, and project/area views
- **Pennyworth** — must write conforming frontmatter when creating or updating projects via the GitHub API
- **Alfred (terminal)** — must write conforming frontmatter when creating or editing files directly
- **GitHub Actions / scripts** — must preserve frontmatter on automated edits

If you're touching ORACLE files, this spec is the source of truth for the YAML header.

---

## File Locations

```
ORACLE/
├── Projects/
│   └── {slug}/
│       └── PROJECT.md       ← uses ProjectFrontmatter
└── Areas/
    └── {slug}/
        └── AREA.md          ← uses AreaFrontmatter
```

The `{slug}` is the folder name. It is **the canonical identifier** for the project or area. It is NEVER stored in the frontmatter — it is derived from the directory path. Use kebab-case (`pennyworth`, `psi-odoo-v8-to-v19-upgrade`, `health-fitness`).

---

## Project Frontmatter (`Projects/{slug}/PROJECT.md`)

### Required Fields

| Field        | Type     | Example          | Notes                                                                                       |
| ------------ | -------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `title`      | string   | `"Pennyworth"`   | Display name. Used in sidebar, cards, page header.                                          |
| `state`      | enum     | `"active"`       | One of: `active`, `planning`, `paused`, `complete`                                          |
| `owner`      | string   | `"Nick Burdick"` | Display name of the owner                                                                   |
| `created`    | ISO date | `"2026-03-16"`   | YYYY-MM-DD format                                                                           |
| `sort_order` | integer  | `100`            | Sidebar position. Lower = higher in list. Use multiples of 100. New items default to `999`. |

### Optional Fields

| Field          | Type          | Example                     | Notes                                                                                      |
| -------------- | ------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `area`         | string (slug) | `"alfred"`                  | Slug of the parent area. Renders as a clickable link in metadata card.                     |
| `target_date`  | ISO date      | `"2026-06-01"`              | Hidden in metadata card if missing                                                         |
| `phase`        | string        | `"Phase 3 — Oracle as App"` | Free-form phase label. Hidden if missing.                                                  |
| `platform_ids` | object        | see below                   | Key/value table of external platform IDs. Renders as collapsible section in metadata card. |
| `category`     | string        | `"health"`                  | **Reserved for Phase 2.** Not rendered in MVP. Used for future visual grouping in sidebar. |

### Platform IDs Object

A flexible key/value object. Each key is a platform name; each value is an identifier or URL. The Oracle App renders these as clickable links when the platform is recognized.

```yaml
platform_ids:
  todoist: '6g9XRCp9Q6f7H5Mq'
  github_repo: 'Nkburdick/pennyworth'
  oracle_slug: 'alfred-online'
  local_code: '~/Code/Pennyworth'
  vps: '31.220.21.243'
  telegram_bot: '@alfredonlinebot'
  drive_folder: '[01] Projects/Pennyworth'
```

**Recognized platform keys (clickable in Oracle App):**

| Key            | Click target                               |
| -------------- | ------------------------------------------ |
| `todoist`      | `https://todoist.com/app/project/{value}`  |
| `github_repo`  | `https://github.com/{value}`               |
| `drive_folder` | (Future) Drive folder picker by name       |
| `telegram_bot` | `https://t.me/{value}` (strip leading `@`) |
| `vps`          | not clickable (display only)               |
| `local_code`   | not clickable (display only)               |
| `oracle_slug`  | (Future) Oracle App link                   |

Unknown keys still render but are not clickable. Add new clickable platforms by updating the Oracle App's link resolver.

### Complete Example

```yaml
---
title: Pennyworth
state: active
owner: Nick Burdick
created: 2026-03-16
sort_order: 100
area: alfred
target_date: 2026-06-30
phase: Phase 3 — Oracle as App
platform_ids:
  todoist: '6g9XRCp9Q6f7H5Mq'
  github_repo: 'Nkburdick/pennyworth'
  oracle_slug: 'alfred-online'
  local_code: '~/Code/Pennyworth'
  vps: '31.220.21.243'
  telegram_bot: '@alfredonlinebot'
  drive_folder: '[01] Projects/Pennyworth'
---
# Pennyworth — Personal Operations App

(markdown body follows...)
```

---

## Area Frontmatter (`Areas/{slug}/AREA.md`)

Areas use the **same frontmatter schema as projects**, with two differences:

1. The `state` field is **omitted** for areas (areas don't have lifecycle states — they're ongoing)
2. The `target_date` and `phase` fields are **omitted** for areas (areas don't end)

### Required Fields

| Field        | Type     | Example          | Notes                  |
| ------------ | -------- | ---------------- | ---------------------- |
| `title`      | string   | `"Alfred"`       | Display name           |
| `owner`      | string   | `"Nick Burdick"` |                        |
| `created`    | ISO date | `"2026-03-16"`   |                        |
| `sort_order` | integer  | `100`            | Same rules as projects |

### Optional Fields

| Field          | Type   | Example        | Notes                      |
| -------------- | ------ | -------------- | -------------------------- |
| `platform_ids` | object | (see Projects) | Same structure as projects |
| `category`     | string | `"work"`       | Reserved for Phase 2       |

### Complete Example

```yaml
---
title: Alfred
owner: Nick Burdick
created: 2026-03-16
sort_order: 100
platform_ids:
  todoist: '6g9XR9GRQhF2mvVP'
  github_repo: 'Nkburdick/Alfred'
  local_code: '~/Code/Alfred'
---
# Alfred — Personal AI Infrastructure

(markdown body follows...)
```

---

## Body Conventions

The markdown body of every PROJECT.md / AREA.md file SHOULD follow these section conventions for Oracle App to parse it correctly. The Oracle App is robust to variation, but Pennyworth and Alfred should use these section names when generating new files.

### Standard Project Sections

```markdown
# {title}

## Overview

(short description)

## Architecture

(bullet list or prose)

## Definition of Done

### Phase 1: ...

- [x] Item one
- [x] Item two
- [ ] Item three

### Phase 2: ...

- [ ] Item

## Scope

### In Scope

- ...

### Out of Scope

- ...

## Context

(prose)

## Key Decisions

- 2026-03-16: Decision text
- 2026-04-05: Another decision

## Current Status

(short prose)
```

### Standard Area Sections

```markdown
# {title}

## Type

(category, owner, created)

## My Responsibilities

- ...

## What "Good" Looks Like

- ...

## Context

(prose)

## Key Resources

- Code:
- Docs:
- Tasks:

## Active Projects

- [ ] [project-slug](../../Projects/project-slug/PROJECT.md) — description

## Recurring Rhythms

- Weekly: ...
- Monthly: ...
```

---

## Definition of Done Parsing

Oracle App parses `## Definition of Done` (or `## DoD` as alias) to compute completion stats for the dashboard. Rules:

1. Look for `## Definition of Done` (case-insensitive) anywhere in the body
2. Within that section, find all lines matching `^- \[x\]` (checked) or `^- \[ \]` (unchecked)
3. Sub-section headers (`### Phase N: ...`) are preserved as `section` metadata on each item
4. Indented checkboxes (nested sub-tasks) ARE counted
5. Stop counting when the next `## ` section header is encountered

The completion percentage is `Math.round((checked / total) * 100)`. If `total === 0`, percent is `0` and the dashboard card shows `0%` with an empty bar.

---

## Validation Rules

When Pennyworth or Alfred writes a PROJECT.md / AREA.md, the following validations should pass before commit:

1. **Required fields present:** `title`, `state` (projects only), `owner`, `created`, `sort_order`
2. **Valid state value:** `state` is one of `active | planning | paused | complete`
3. **Valid date format:** `created` and `target_date` are YYYY-MM-DD
4. **Sort order is integer:** `sort_order` is a non-negative integer
5. **Slug matches folder:** the file path is `Projects/{slug}/PROJECT.md` where `{slug}` is kebab-case
6. **No leading/trailing whitespace** in string fields

Soft warnings (don't block commit, but log):

- Missing optional fields that are typically expected (e.g., `area` for a project)
- `sort_order` collisions with existing items in the same section
- Non-recognized keys in `platform_ids`

---

## Migration Notes (one-time, before Oracle App launch)

Existing PROJECT.md / AREA.md files in ORACLE may not have all the fields specified here. Specifically:

- Many existing files use a `## Platform IDs` markdown table instead of a `platform_ids` YAML object
- Many existing files don't have `sort_order`
- Some files have ad-hoc fields not specified here

**Migration script:** `scripts/migrate-frontmatter.ts` (to be written) walks all files and:

1. Adds missing required fields with sensible defaults
2. Converts `## Platform IDs` markdown tables to `platform_ids` YAML objects (deletes the table from the body)
3. Sets `sort_order` to alphabetical order × 100 (or keeps existing if present)
4. Logs warnings for ad-hoc fields it doesn't recognize

This script runs **once**, before Oracle App's first deploy. After that, all writers (Alfred, Pennyworth) follow the spec going forward.

---

## Versioning

This is **v1** of the spec. Future versions will be backwards compatible — readers must tolerate missing fields gracefully (use defaults). Breaking changes require a `version: N` field in the frontmatter and a migration plan.
