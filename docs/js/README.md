# NBA plumber.R -> JS port

## Files

- `db.js` — DuckDB-WASM connection setup. Replaces `dbConnect()` / the CORS filter.
- `queries.js` — every SQL-only endpoint (`/filters/universe`, `/player/profile`,
  `/player/avg-distance`, `/player/assist-pct`, `/player/points-per-shot`,
  `/player/total-attempts`, `/league/regions`, `/position/regions`,
  `/team/regions`, `/player/regions`, `/teams`, `/players`,
  `/player/regions/yearly`, `/team/regions/yearly`,
  `/player/shot-distribution/yearly`).
- `similarity.js` — `/player/similar`, reading a precomputed zone-vector
  cache instead of rebuilding it per-request.
- `kde.js` — `/player/shot-density`, a hand-rolled port of `MASS::kde2d`.
- `build-zone-cache.R` — run this once (and again whenever the underlying
  shot data changes) to generate `public/data/zone-vectors.json`.

## What to change in attempts2.js / practice.js

1. Delete the entire `// API CALLS` block (the `const API_BASE = ...` line
   and every `fetch*` function under it).
2. Add at the top of each file:

```javascript
import {
  fetchFilterUniverse,
  fetchPlayerImage,
  fetchAvgDistance,
  fetchAssistPct,
  fetchPointsPerShot,
  fetchTotalAttempts,
  fetchLeagueRegionStats,
  fetchPositionRegionStats,
  fetchTeamRegionStats,
  fetchPlayerRegionStats,
  fetchTeamRegionStatsLineChart,
  fetchPlayerRegionStatsLineChart,
  fetchStackedBar,
} from "./queries.js";
import { fetchSimilarPlayers } from "./similarity.js";
import { fetchPlayerDensity } from "./kde.js";
```

Everything below that point in both files (`updateSelect`, `recomputeFilters`,
`registerFilter`, `update()`, the D3 drawing code, event listeners) calls
these functions by name already and needs no changes — the function
signatures and return shapes match the old `fetch*` versions exactly,
except:

- Errors now throw from DuckDB-WASM rather than from `res.ok` checks —
  your existing `try { ... } catch (err) { ... }` blocks around each call
  in `update()` already handle this correctly as-is.
- `fetchPlayerImage` still doesn't return `team` (see the note in
  `queries.js`) — that was a pre-existing gap in the plumber version, not
  something this port introduced.

## One-time setup

```bash
npm install @duckdb/duckdb-wasm
```

Put `shots.parquet` at `public/data/shots.parquet`, then run:

```bash
Rscript build-zone-cache.R
```

to generate `public/data/zone-vectors.json`.
