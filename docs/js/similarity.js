// similarity.js
// Replaces the /player/similar plumber endpoint. The expensive part
// (build_zone_cache) now runs offline via build-zone-cache.R; this module
// just loads that JSON once and does the cosine-similarity ranking + image
// lookup that used to happen per-request in R.

import { getConnection } from "./db.js";

let cachePromise = null;

async function loadZoneCache() {
  if (cachePromise) return cachePromise;
  cachePromise = fetch(new URL("/docs/data/zone-vectors.json", window.location.href).href).then((res) => {
    if (!res.ok) throw new Error("Failed to load zone-vectors.json");
    return res.json();
  });
  return cachePromise;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Was fetchSimilarPlayers(player, season)
export async function fetchSimilarPlayers(playerName, season = "All", nResults = 5) {
  const cache = await loadZoneCache();

  let entry;
  let pool;

  if (season === "All") {
    entry = cache.career.find((p) => p.name === playerName);
    pool = cache.career.filter((p) => p.name !== playerName);
  } else {
    entry = cache.season.find((p) => p.name === playerName && String(p.season) === String(season));
    pool = cache.season.filter((p) => p.name !== playerName && String(p.season) === String(season));
  }

  if (!entry) {
    return { error: `No zone vector found for ${playerName} in season ${season} (player may not meet minimum attempt threshold)` };
  }
  if (pool.length === 0) {
    return { error: "No comparable players found for this season" };
  }

  const queryVec = Object.values(entry.vector);
  const scored = pool.map((p) => ({
    name: p.name,
    similarity: cosineSimilarity(queryVec, Object.values(p.vector)),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  const top = scored.slice(0, nResults);

  // Image lookup — matches the plumber file's query against conPlayer's
  // `player` table exactly.
  const conn = await getConnection();
  const allNames = [playerName, ...top.map((p) => p.name)];
  const placeholders = allNames.map(() => "?").join(", ");
  const stmt = await conn.prepare(`
    SELECT name, MAX(image) AS image
    FROM player
    WHERE name IN (${placeholders})
    GROUP BY name
  `);
  const profileRows = (await stmt.query(...allNames)).toArray().map((r) => r.toJSON());
  const imageByName = Object.fromEntries(profileRows.map((r) => [r.name, r.image ?? ""]));

  return {
    player: { name: playerName, image: imageByName[playerName] ?? "" },
    similar: top.map((p) => ({
      name: p.name,
      similarity: Math.round(p.similarity * 10000) / 10000,
      image: imageByName[p.name] ?? "",
    })),
  };
}