// kde.js
// Replaces the /player/shot-density plumber endpoint, which called
// MASS::kde2d(). There's no off-the-shelf JS equivalent, so this is a
// direct port of what kde2d() actually does internally:
//
//   h <- h / 4                                  (bandwidth -> kernel sd)
//   gx <- seq(lims[1], lims[2], length.out=nx)   (evenly spaced grid)
//   gy <- seq(lims[3], lims[4], length.out=ny)
//   density(gx_i, gy_j) =
//     (1 / (N * h1 * h2)) * sum_k dnorm((gx_i - x_k)/h1) * dnorm((gy_j - y_k)/h2)
//
// then normalized by its own max, exactly like the R code did.

import { getConnection } from "./db.js";

function dnorm(t) {
  return Math.exp(-0.5 * t * t) / Math.sqrt(2 * Math.PI);
}

function linspace(lo, hi, n) {
  if (n === 1) return [lo];
  const step = (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, i) => lo + i * step);
}

// Was fetchPlayerDensity(player, season, period, bandwidth, resolution)
export async function fetchPlayerDensity(
  playerName = "All",
  season = "All",
  period = "All",
  bandwidth = 2.5,
  resolution = 0.5
) {
  const conn = await getConnection();
  const stmt = await conn.prepare(`
    SELECT LOC_X, LOC_Y
    FROM shots
    WHERE (? = 'All' OR name = ?)
      AND (? = 'All' OR season = ?)
      AND (? = 'All' OR period_number = ?)
      AND LOC_Y <= 47
  `);
  const rows = (
    await stmt.query(playerName, playerName, season, season, period, period)
  ).toArray().map((r) => r.toJSON());

  if (rows.length === 0) return [];

  const res = Number(resolution);
  const bw = Number(bandwidth);
  const h = bw / 4; // matches kde2d's internal h/4

  const nx = Math.round((50 - res) / res) + 1; // same count as the R x_seq
  const ny = Math.round((47 - res) / res) + 1;

  const gx = linspace(-25, 25, nx);
  const gy = linspace(0, 47, ny);

  const xs = rows.map((r) => r.LOC_X);
  const ys = rows.map((r) => r.LOC_Y + 4.75);
  const n = xs.length;

  // NOTE: this is O(nx * ny * n). Fine for a single player/season
  // (a few thousand shots, ~100x94 grid -> well under a second). If you
  // call this with player="All" and no season/period filter, n can be in
  // the hundreds of thousands and this will be noticeably slow on the
  // main thread — worth moving into a Web Worker, or precomputing the
  // "All" case at build time the same way similarity.js does.
  const grid = [];
  const scale = 1 / (n * h * h);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += dnorm((gx[i] - xs[k]) / h) * dnorm((gy[j] - ys[k]) / h);
      }
      grid.push({ x: gx[i], y: gy[j], density: sum * scale });
    }
  }

  const maxD = Math.max(...grid.map((c) => c.density));
  if (maxD > 0) {
    for (const cell of grid) cell.density /= maxD;
  }

  return grid;
}
