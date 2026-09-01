# build-zone-cache.R
# Run this locally whenever your filtered shot data changes. It reproduces
# build_zone_cache() from the plumber file, but instead of holding the
# result in memory for a live API, it writes the result to a static JSON
# file that similarity.js loads in the browser.
#
# Usage: Rscript build-zone-cache.R

library(DBI)
library(duckdb)
library(jsonlite)

ZONES <- c(
  "Restricted Area", "In the Paint (Non-RA)", "Left Mid-Range", "Right Mid-Range",
  "Left Wing Mid-Range", "Right Wing Mid-Range", "Center Mid-Range",
  "Left Corner 3", "Right Corner 3", "Left Wing 3", "Right Wing 3", "Above the Break 3"
)

con <- dbConnect(duckdb::duckdb())
dbExecute(con, "CREATE VIEW shots AS SELECT * FROM read_parquet('../data/shots.parquet')")

min_attempts <- 200

season_sql <- "
  WITH qualifying AS (
    SELECT name, season FROM shots
    WHERE region != 'Backcourt'
    GROUP BY name, season
    HAVING COUNT(*) >= ?
  )
  SELECT s.name, s.season, s.region, COUNT(*) AS zone_count
  FROM shots s
  INNER JOIN qualifying q ON s.name = q.name AND s.season = q.season
  WHERE s.region != 'Backcourt'
  GROUP BY s.name, s.season, s.region
  ORDER BY s.name, s.season, s.region
"
season_agg <- dbGetQuery(con, season_sql, params = list(min_attempts))

season_cache <- list()
ps <- unique(season_agg[, c("name", "season")])
for (i in seq_len(nrow(ps))) {
  player <- ps$name[i]
  szn    <- ps$season[i]
  grp    <- season_agg[season_agg$name == player & season_agg$season == szn, ]
  counts <- setNames(grp$zone_count, grp$region)
  vec    <- as.numeric(counts[ZONES])
  vec[is.na(vec)] <- 0
  total  <- sum(vec)
  if (total >= 20) {
    key <- paste0(player, "||", szn)
    season_cache[[key]] <- list(name = player, season = szn, vector = as.list(vec / total))
  }
}

career_sql <- "
  WITH qualifying AS (
    SELECT name FROM shots
    WHERE region != 'Backcourt'
    GROUP BY name
    HAVING COUNT(*) >= ?
  )
  SELECT s.name, s.region, COUNT(*) AS zone_count
  FROM shots s
  INNER JOIN qualifying q ON s.name = q.name
  WHERE s.region != 'Backcourt'
  GROUP BY s.name, s.region
  ORDER BY s.name, s.region
"
career_agg <- dbGetQuery(con, career_sql, params = list(min_attempts))

career_cache <- list()
for (player in unique(career_agg$name)) {
  grp    <- career_agg[career_agg$name == player, ]
  counts <- setNames(grp$zone_count, grp$region)
  vec    <- as.numeric(counts[ZONES])
  vec[is.na(vec)] <- 0
  total  <- sum(vec)
  if (total >= 20) {
    career_cache[[player]] <- list(name = player, vector = as.list(vec / total))
  }
}

cache <- list(zones = ZONES, season = unname(season_cache), career = unname(career_cache))
write_json(cache, "../data/zone-vectors.json", auto_unbox = TRUE, digits = 6)

message(sprintf(
  "Zone cache written: %d player-seasons, %d career profiles -> public/data/zone-vectors.json",
  length(season_cache), length(career_cache)
))

dbDisconnect(con, shutdown = TRUE)
