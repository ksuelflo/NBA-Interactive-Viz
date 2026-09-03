// db.js
// Replaces: the plumber `con` / `conPlayer` dbConnect() calls and the
// #* @filter cors block (no longer needed — there's no cross-origin
// request once queries run in-browser).
//
// Lazily creates a single DuckDB-WASM connection and registers your
// parquet file(s) as SQL views, so the rest of the app can just call
// `const conn = await getConnection()` and write normal SQL.

import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";

let connPromise = null;

// Resolved relative to this module's own location (docs/js/db.js -> ../data/)
// rather than the page URL or a root-absolute path. GitHub Pages serves the
// `docs/` folder itself as the site root under a repo-name subpath
// (e.g. https://user.github.io/repo-name/), so a root-absolute "/docs/data/..."
// 404s in production even though it resolves locally — this works in both.
const SHOTS_PARQUET_URL = new URL("../data/shots.parquet", import.meta.url).href;
const PLAYER_PARQUET_URL = new URL("../data/player.parquet", import.meta.url).href;

export async function getConnection() {
  if (connPromise) return connPromise;

  connPromise = (async () => {
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

    // Browsers refuse `new Worker(crossOriginUrl)` outright (a SecurityError,
    // not a CORS issue) — even though fetching that same URL is fine.
    // Workaround: wrap the remote worker script in a same-origin blob that
    // importScripts() the real (CDN) worker, and construct the Worker from
    // that blob instead. importScripts() inside a worker isn't subject to
    // the same restriction.
    const workerBlob = new Blob(
      [`importScripts("${bundle.mainWorker}");`],
      { type: "text/javascript" }
    );
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);

    await db.registerFileURL(
      "shots.parquet",
      SHOTS_PARQUET_URL,
      duckdb.DuckDBDataProtocol.HTTP,
      false
    );
    await db.registerFileURL(
      "player.parquet",
      PLAYER_PARQUET_URL,
      duckdb.DuckDBDataProtocol.HTTP,
      false
    );

    const conn = await db.connect();

    // Two views, mirroring the plumber file's two connections: `con`
    // (shots.duckdb) and `conPlayer` (player.duckdb).
    await conn.query(`
      CREATE VIEW shots AS SELECT * FROM read_parquet('shots.parquet')
    `);
    await conn.query(`
      CREATE VIEW player AS SELECT * FROM read_parquet('player.parquet')
    `);

    return conn;
  })();

  return connPromise;
}

// Small helper: escape a value for safe interpolation into an IN (...)
// list or a LIKE pattern. Prefer prepared statements (conn.prepare) for
// anything user-typed — this is only for building dynamic column/IN lists.
export function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}
