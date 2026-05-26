# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint
```

No test runner is configured.

## Architecture

Pigedex is a pigeon-coop family tree visualizer built with **Next.js (App Router)**, **React 19**, **Tailwind CSS v4**, and **Supabase**.

### Pages

- `/` — interactive family tree graph (`src/app/page.js`)
- `/catalog` — card-grid catalog with search/filter/sort (`src/app/catalog/page.jsx`)
- `/flights` and `/pigeons/[id]` — planned but not yet implemented

### Data layer (`src/lib/`)

All DB access goes through `src/lib/pigeonDb.js`, which wraps Supabase. The client is initialized in `src/lib/supabaseClient.js` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

**`COOP_ID`** (hardcoded in `src/lib/constants.js`) is appended to every query to scope data to one coop. All inserts and reads must include `.eq("coop_id", COOP_ID)`.

Supabase tables:
| Table | Key columns |
|---|---|
| `pigeons` | `id`, `coop_id`, `name`, `birthday`, `status`, `band_id`, `band_color`, `sex`, `notes`, `archived` |
| `pigeon_relationships` | `coop_id`, `parent_id`, `child_id` |
| `pigeon_images` | `coop_id`, `pigeon_id`, `url`, `is_profile`, `sort_order` |
| `coop_members` | `coop_id`, `user_id`, `role` (`owner` / `admin`) |

`fetchPigeonsWithParents()` loads all three tables in parallel and merges them into a flat JS object per pigeon. The in-app pigeon object shape is:

```js
{ id, name, birthday, status, bandId, bandColor, sex, notes, imageUrl, images, parentIds, createdAt, updatedAt }
```

Note the camelCase ↔ snake_case mapping (e.g. `band_id` → `bandId`).

**Birthday format**: stored and displayed as `MM-dd-yyyy` strings (e.g. `"05-23-2024"`). Parsing helpers live in `src/app/catalog/page.jsx`.

### Graph pipeline (`src/app/page.js` + `src/lib/graph/`)

The home page renders an interactive React Flow canvas. The flow is:

1. `fetchPigeonsWithParents()` — load data from Supabase
2. `buildGraphData(pigeons, handlers)` — convert pigeons to React Flow nodes/edges
3. `layoutWithElk(nodes, edges)` — compute positions with ELK (`layered`, top-down)
4. Render via `<ReactFlow>` with two custom node types

**Union node pattern**: when pigeons share parents, a small "union" dot node is inserted between the parents and their children, forming a `parent → union → child` chain rather than direct `parent → child` edges. This avoids crossing edges for shared parentage. See `getUnionId()` and `buildGraphData()` in `src/lib/graph/graphData.js`.

Edge highlighting on hover traverses both ancestors and descendants of the hovered pigeon using BFS (`getConnectedEdgeIds()`).

**State management**: all pigeon data lives in a single `pigeons` useState in `PigeonGraph`. Updates follow this pattern:
- Update local `pigeons` and `nodes` state immediately (optimistic)
- Write to Supabase
- If parent relationships changed, re-run `layoutWithElk` with `preserveViewport = true`

### Admin auth (`src/lib/auth.js`)

The site is publicly viewable but edits require an admin session. Admins are Supabase users with `role = "owner"` or `"admin"` in `coop_members`. Auth state is managed in `PigeonGraph` via `isAdmin`; the `AdminLoginDialog` calls `signInAdmin()` and then checks `getIsCoopAdmin()`. All editing UI is disabled when `!isAdmin`.

### UI

- **shadcn/ui** components (style: `base-nova`, configured in `components.json`) live in `src/components/ui/`
- **Tailwind CSS v4** — theme tokens like `--color-dot` and `--color-edge` are used via `var()` throughout the graph and CSS
- `@/` path alias maps to `src/` (configured in `jsconfig.json`)

### Mock data

`src/data/mockData.js` contains sample pigeons and flights used for local development reference. It is **not wired into the app**; the app always reads from Supabase.
