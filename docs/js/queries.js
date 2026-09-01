// queries.js
// One function per plumber endpoint that was "just SQL." Function names
// and return shapes match what attempts2.js / practice.js already call —
// swap your old fetch* functions for these imports and nothing else
// needs to change at the call sites.

import { getConnection } from "./db.js";

async function runQuery(sql, params = []) {
  const conn = await getConnection();
  const stmt = await conn.prepare(sql);
  const result = await stmt.query(...params);
  return result.toArray().map((row) => row.toJSON());
}

// ── /filters/universe ───────────────────────────────────────────────────
// Was fetchFilterUniverse(filters) in attempts2.js/practice.js
export async function fetchFilterUniverse(filters = {}) {
  const season = filters.season ?? "All";
  const player = filters.player ?? "All";
  const team = filters.team ?? "All";
  const quarter = filters.quarter ?? "All";

  const sql = `
    SELECT
      ARRAY_AGG(DISTINCT season ORDER BY season DESC) AS seasons,
      ARRAY_AGG(DISTINCT name ORDER BY name) AS players,
      ARRAY_AGG(DISTINCT team_name ORDER BY team_name) AS teams,
      ARRAY_AGG(DISTINCT period_number ORDER BY period_number) AS quarters
    FROM shots
    WHERE
      (season = ? OR ? = 'All')
      AND (name = ? OR ? = 'All')
      AND (team_name = ? OR ? = 'All')
      AND (period_number = ? OR ? = 'All')
  `;
  const rows = await runQuery(sql, [
    season, season,
    player, player,
    team, team,
    quarter, quarter,
  ]);
  const row = rows[0] ?? {};

  // ARRAY_AGG comes back as a LIST column, which Arrow (what DuckDB-WASM
  // uses under the hood) sometimes surfaces as a Vector-like object rather
  // than a plain JS array — iterable and indexable, but no .map(). This
  // normalizes it either way.
  const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : Array.from(v));

  return {
    seasons: toArray(row.seasons),
    players: toArray(row.players),
    teams: toArray(row.teams),
    quarters: toArray(row.quarters),
  };
}

// ── /player/profile ─────────────────────────────────────────────────────
// Was fetchPlayerImage(player)
// NOTE: matches the original SQL exactly (name, image, position from
// shots) — it does not select `team`, even though update()/practice.js
// reads profile[0].team. That mismatch existed in the plumber version
// too; add `team_name AS team` to the SELECT below if you want it fixed.
export async function fetchPlayerImage(playerName) {
  const sql = `
    SELECT name, image, position
    FROM shots
    WHERE name = ?
    LIMIT 1
  `;
  return runQuery(sql, [playerName]);
}

// ── /player/avg-distance ────────────────────────────────────────────────
export async function fetchAvgDistance(playerName = "All") {
  const sql = `
    SELECT season, AVG(SQRT(LOC_X * LOC_X + LOC_Y * LOC_Y)) AS avg_distance
    FROM shots
    WHERE (? = 'All' OR name = ?)
      AND region != 'Backcourt'
    GROUP BY season
    ORDER BY season
  `;
  return runQuery(sql, [playerName, playerName]);
}

// ── /player/assist-pct ──────────────────────────────────────────────────
export async function fetchAssistPct(playerName = "All") {
  const sql = `
    SELECT
      season,
      COUNT(*) AS total_makes,
      SUM(CAST(assisted AS INT)) AS assisted_makes,
      AVG(CAST(assisted AS INT)) AS assist_pct
    FROM shots
    WHERE scoring_play = TRUE
      AND (? = 'All' OR name = ?)
    GROUP BY season
    ORDER BY season
  `;
  return runQuery(sql, [playerName, playerName]);
}

// ── /player/points-per-shot ─────────────────────────────────────────────
export async function fetchPointsPerShot(playerName, season = "All", period = "All") {
  const sql = `
    WITH player_stats AS (
      SELECT
        name,
        SUM(score_value) AS total_points,
        COUNT(*) AS attempts,
        CAST(SUM(score_value) AS FLOAT) / COUNT(*) AS points_per_shot
      FROM shots
      WHERE (? = 'All' OR season = ?)
        AND (? = 'All' OR period_number = ?)
      GROUP BY name
      HAVING COUNT(*) >= 50
    ),
    with_percentile AS (
      SELECT name, points_per_shot, attempts,
             PERCENT_RANK() OVER (ORDER BY points_per_shot) AS percentile
      FROM player_stats
    )
    SELECT points_per_shot, attempts, percentile
    FROM with_percentile
    WHERE name = ?
  `;
  const rows = await runQuery(sql, [season, season, period, period, playerName]);
  if (rows.length === 0) {
    return { points_per_shot: null, attempts: 0, percentile: null, error: "Player not found or insufficient attempts" };
  }
  const r = rows[0];
  return {
    points_per_shot: Math.round(r.points_per_shot * 1000) / 1000,
    attempts: r.attempts,
    percentile: Math.round(r.percentile * 1000) / 1000,
  };
}

// ── /player/total-attempts ──────────────────────────────────────────────
export async function fetchTotalAttempts(playerName, season = "All", period = "All") {
  const sql = `
    WITH player_stats AS (
      SELECT name, COUNT(*) AS attempts
      FROM shots
      WHERE (? = 'All' OR season = ?)
        AND (? = 'All' OR period_number = ?)
      GROUP BY name
      HAVING COUNT(*) >= 50
    ),
    with_percentile AS (
      SELECT name, attempts,
             PERCENT_RANK() OVER (ORDER BY attempts) AS percentile
      FROM player_stats
    )
    SELECT attempts, percentile
    FROM with_percentile
    WHERE name = ?
  `;
  const rows = await runQuery(sql, [season, season, period, period, playerName]);
  if (rows.length === 0) {
    return { attempts: null, percentile: null, error: "Player not found or insufficient attempts" };
  }
  const r = rows[0];
  return { attempts: r.attempts, percentile: Math.round(r.percentile * 1000) / 1000 };
}

// ── /league/regions ─────────────────────────────────────────────────────
export async function fetchLeagueRegionStats(season = "All") {
  const sql = `
    SELECT region, COUNT(*) AS attempts,
           SUM(CAST(scoring_play AS INT)) AS makes,
           AVG(CAST(scoring_play AS INT)) AS fg_pct
    FROM shots
    WHERE (? = 'All' OR season = ?)
    GROUP BY region
    ORDER BY region
  `;
  return runQuery(sql, [season, season]);
}

// ── /position/regions ───────────────────────────────────────────────────
export async function fetchPositionRegionStats(position = "All", season = "All") {
  const sql = `
    SELECT region, COUNT(*) AS attempts,
           SUM(CAST(scoring_play AS INT)) AS makes,
           AVG(CAST(scoring_play AS INT)) AS fg_pct
    FROM shots
    WHERE (? = 'All' OR position = ?)
      AND (? = 'All' OR season = ?)
    GROUP BY region
    ORDER BY region
  `;
  return runQuery(sql, [position, position, season, season]);
}

// ── /team/regions ───────────────────────────────────────────────────────
export async function fetchTeamRegionStats(season = "All", teamName = "All", period = "All") {
  const sql = `
    SELECT region, COUNT(*) AS attempts,
           SUM(CAST(scoring_play AS INT)) AS makes,
           AVG(CAST(scoring_play AS INT)) AS fg_pct
    FROM shots
    WHERE (? = 'All' OR season = ?)
      AND (? = 'All' OR team_name = ?)
      AND (? = 'All' OR period_number = ?)
    GROUP BY region
  `;
  return runQuery(sql, [season, season, teamName, teamName, period, period]);
}

// ── /player/regions ─────────────────────────────────────────────────────
export async function fetchPlayerRegionStats(season = "All", playerName = "All", period = "All") {
  const sql = `
    SELECT region, COUNT(*) AS attempts,
           SUM(CAST(scoring_play AS INT)) AS makes,
           AVG(CAST(scoring_play AS INT)) AS fg_pct
    FROM shots
    WHERE (? = 'All' OR season = ?)
      AND (? = 'All' OR name = ?)
      AND (? = 'All' OR period_number = ?)
    GROUP BY region
  `;
  return runQuery(sql, [season, season, playerName, playerName, period, period]);
}

// ── /teams ───────────────────────────────────────────────────────────────
export async function fetchTeams(player = "All", season = null) {
  const conds = [];
  const params = [];
  if (player !== "All") { conds.push("name = ?"); params.push(player); }
  if (season !== null) { conds.push("season = ?"); params.push(season); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const sql = `SELECT DISTINCT team_name FROM shots ${where} ORDER BY team_name`;
  return runQuery(sql, params);
}

// ── /players ─────────────────────────────────────────────────────────────
export async function fetchPlayers(team = "All", season = null) {
  const conds = [];
  const params = [];
  if (team !== "All") { conds.push("team_name = ?"); params.push(team); }
  if (season !== null) { conds.push("season = ?"); params.push(season); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const sql = `SELECT DISTINCT name FROM shots ${where} ORDER BY name`;
  return runQuery(sql, params);
}

// ── /player/regions/yearly ──────────────────────────────────────────────
export async function fetchPlayerRegionStatsLineChart(playerName = "All") {
  const sql = `
    SELECT season, region, COUNT(*) AS attempts,
           SUM(CAST(scoring_play AS INT)) AS makes,
           AVG(CAST(scoring_play AS INT)) AS fg_pct
    FROM shots
    WHERE region != 'Backcourt'
      AND (? = 'All' OR name = ?)
    GROUP BY season, region
    ORDER BY season, region
  `;
  return runQuery(sql, [playerName, playerName]);
}

// ── /team/regions/yearly ────────────────────────────────────────────────
export async function fetchTeamRegionStatsLineChart(teamName = "All") {
  const sql = `
    SELECT season, region, COUNT(*) AS attempts,
           SUM(CAST(scoring_play AS INT)) AS makes,
           AVG(CAST(scoring_play AS INT)) AS fg_pct
    FROM shots
    WHERE region != 'Backcourt'
      AND (? = 'All' OR team_name = ?)
    GROUP BY season, region
    ORDER BY season, region
  `;
  return runQuery(sql, [teamName, teamName]);
}

// ── /player/shot-distribution/yearly ────────────────────────────────────
// Was fetchStackedBar(player)
export async function fetchStackedBar(playerName = "All") {
  const sql = `
    WITH grouped AS (
      SELECT
        season,
        CASE
          WHEN region IN ('Restricted Area', 'In the Paint (Non-RA)') THEN 'paint'
          WHEN region IN ('Right Mid-Range', 'Left Mid-Range', 'Center Mid-Range',
                           'Left Wing Mid-Range', 'Right Wing Mid-Range') THEN 'mid'
          WHEN region IN ('Left Corner 3', 'Right Corner 3', 'Left Wing 3',
                           'Right Wing 3', 'Above the Break 3') THEN 'three'
        END AS shot_group,
        COUNT(*) AS attempts
      FROM shots
      WHERE region != 'Backcourt'
        AND (? = 'All' OR name = ?)
      GROUP BY season, shot_group
    )
    SELECT
      season,
      shot_group,
      attempts,
      CAST(attempts AS FLOAT) / SUM(attempts) OVER (PARTITION BY season) AS freq
    FROM grouped
    ORDER BY season, shot_group
  `;
  return runQuery(sql, [playerName, playerName]);
}