# Oracle App

Nick's personal operations PWA — renders the ORACLE PARA repository (`Projects/`, `Areas/`) as a navigable, beautiful UI.

Built with SvelteKit 2 + TypeScript + TailwindCSS 4. Darkmatter design system (warm copper on slate).

## Development

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
cd app/
bun install
bun run dev
```

The app reads ORACLE data from `../Projects/` and `../Areas/` by default (one level up from `app/`).
Override with the `ORACLE_DATA_PATH` env variable:

```bash
ORACLE_DATA_PATH=/path/to/ORACLE bun run dev
```

## Commands

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `bun run dev`      | Start dev server at `http://localhost:5173` |
| `bun run build`    | Production build                            |
| `bun run preview`  | Preview production build                    |
| `bun run check`    | TypeScript + Svelte type check              |
| `bun run lint`     | Prettier + ESLint                           |
| `bun run format`   | Auto-format all files                       |
| `bun run test`     | Vitest unit tests                           |
| `bun run test:e2e` | Playwright smoke test                       |

## Architecture

```
app/
├── src/
│   ├── lib/
│   │   ├── types/oracle.ts         ← TypeScript types (Project, Area, etc.)
│   │   ├── server/
│   │   │   ├── markdown.ts         ← Frontmatter + markdown parser (gray-matter + marked + shiki)
│   │   │   └── oracle-reader.ts    ← Filesystem reader (reads ../Projects/, ../Areas/)
│   │   └── components/             ← Svelte UI components
│   └── routes/
│       ├── +layout.svelte          ← Two-panel shell (sidebar + main)
│       ├── +page.svelte            ← Dashboard (project completeness cards)
│       ├── projects/[slug]/        ← Project workspace (Chats | Artifacts | SOW tabs)
│       ├── areas/[slug]/           ← Area workspace
│       ├── settings/               ← Settings (theme toggle, version)
│       └── api/
│           ├── events/             ← SSE endpoint (chokidar file-watcher push)
│           └── health/             ← Health check
└── tests/
    ├── unit/                       ← Vitest unit tests
    └── e2e/                        ← Playwright smoke test
```

## Data Layer

Oracle reads markdown files directly from the ORACLE repository via Node.js `fs.readFile`. No database.

- **Frontmatter:** parsed with `gray-matter` → typed `ProjectFrontmatter` / `AreaFrontmatter`
- **Markdown body:** rendered server-side with `marked` + Shiki (no client-side bundle)
- **Live updates:** `chokidar` watches for file changes → broadcasts SSE events → client calls `invalidate()` → DOM updates without reload

## Deployment

### Docker (production)

```bash
docker build -t oracle .
docker run -p 3000:3000 \
  -e ORACLE_DATA_PATH=/opt/oracle/data \
  -v /path/to/ORACLE:/opt/oracle/data:ro \
  oracle
```

### KVM 2 (Dockge)

Stack file at `deploy/compose.yml`. Routes `oracle.aptoworks.cloud` via Traefik.

### Environment Variables

| Variable           | Default                 | Description                      |
| ------------------ | ----------------------- | -------------------------------- |
| `ORACLE_DATA_PATH` | `../` (relative to cwd) | Path to ORACLE repo clone        |
| `PORT`             | `3000`                  | HTTP port                        |
| `HOST`             | `0.0.0.0`               | Bind address                     |
| `VITE_BUILD_SHA`   | (empty)                 | Git commit SHA shown in Settings |

## Design System

Darkmatter — warm copper (`#D87943`) accent on slate-tinted near-black. Geist Mono throughout, JetBrains Mono for code blocks. See `docs/DESIGN_SYSTEM.md` for full spec.

## Phase Roadmap

| Phase                   | Scope                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| **MVP Shell** (current) | Navigation, dashboard, project/area views, Darkmatter theme           |
| **Phase 2**             | Chat interface (Pennyworth API), Artifacts tab, drag-and-drop reorder |
| **Phase 3**             | PWA install, service worker, offline support                          |
