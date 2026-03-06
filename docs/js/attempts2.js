// API CALLS---------------------------------------------

const API_BASE = "https://nba-api-mjlt.onrender.com";

// FILTERS

async function fetchFilterUniverse(filters) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/filters/universe?${params}`);

  if (!res.ok) {
    throw new Error("Failed to fetch filter universe");
  }
  return await res.json();
}

// PLAYER IMAGE

async function fetchPlayerImage(player) {
  const res = await fetch(`${API_BASE}/player/profile?player_name=${player}`);
  if (!res.ok) {
    throw new Error("Failed to fetch player image");
  }
  return await res.json();
}

// SIMILAR PLAYERS

async function fetchSimilarPlayers(player, season) {
  const res = await fetch(`${API_BASE}/player/similar?player_name=${encodeURIComponent(player)}&season=${season}`);
  if (!res.ok) throw new Error("Failed to fetch similar players");
  return await res.json();
}

// TOTAL ATTEMPTS

async function fetchTotalAttempts(player, season, period) {
  const params = new URLSearchParams({ player_name: player });
  if (season && season !== "All") params.append("season", season);
  if (period && period !== "All") params.append("period", period);
  const res = await fetch(`${API_BASE}/player/total-attempts?${params}`);
  if (!res.ok) throw new Error("Failed to fetch total attempts");
  return await res.json();
}

// POINTS PER SHOT

async function fetchPointsPerShot(player, season, period) {
  const params = new URLSearchParams({ player_name: player });
  if (season && season !== "All") params.append("season", season);
  if (period && period !== "All") params.append("period", period);
  const res = await fetch(`${API_BASE}/player/points-per-shot?${params}`);
  if (!res.ok) throw new Error("Failed to fetch points per shot");
  return await res.json();
}

// ASSIST PCT

async function fetchAssistPct(player) {
  const res = await fetch(`${API_BASE}/player/assist-pct?player_name=${encodeURIComponent(player)}`);
  if (!res.ok) throw new Error("Failed to fetch assist pct");
  return await res.json();
}
// AVG DISTANCE

async function fetchAvgDistance(player) {
  const res = await fetch(`${API_BASE}/player/avg-distance?player_name=${encodeURIComponent(player)}`);
  if (!res.ok) throw new Error("Failed to fetch avg distance");
  return await res.json();
}

// DENSITY

async function fetchPlayerDensity(player, season, period, bandwidth = 5, resolution = .5) {
  const res = await fetch(`${API_BASE}/player/shot-density?player_name=${player}&season=${season}&period=${period}&bandwidth=${bandwidth}&resolution=${resolution}`);
  if (!res.ok) {
    throw new Error("Failed to fetch player density");
  }
  return await res.json();
}

// FILTERS --------------------------------------------------

function updateSelect(selector, values, selected) {
  const sel = d3.select(selector);

  const allValues = ["All", ...values.map(String).filter(d => d !== "All")];

  sel.selectAll("option").remove();

  sel.selectAll("option")
    .data(allValues)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  sel.property(
    "value",
    allValues.includes(String(selected)) ? String(selected) : "All"
  );
}

async function recomputeFilters(changedKey = null) {
  const data = await fetchFilterUniverse(filters);
  playerUniverse = data.players;

  if (changedKey !== "season") {
    updateSelect(`#season-select`, data.seasons, filters.season);
  }

  if (changedKey !== "player") {
    updateSelect(`#player-select`, data.players, filters.player);
  }

  if (changedKey !== "team") {
    updateSelect(`#team-select`, data.teams, filters.team);
  }

  if (changedKey !== "quarter") {
    updateSelect(`#quarter-select`, data.quarters, filters.quarter);
  }
  setupPlayerAutocomplete(data.players, filters);
}

function registerFilter(key) {
  d3.select(`#${key}-select`)
    .on("change", async function () {
      filters[key] = this.value;

      await recomputeFilters(key);  // 👈 key exclusion
      // await recomputeChart(side);
    });
}

function matchesPlayer(player, query) {
  if (!query) return true;

  const q = query.toLowerCase();
  const parts = player.toLowerCase().split(" ");

  return parts.some(p => p.startsWith(q));
}

function setupPlayerAutocomplete(players, filters) {
  const input = d3.select(`#player-input`);
  const results = d3.select(`#player-results`);

  // prevent multiple listeners
  if (input.attr("data-autocomplete-initialized")) return;
  input.attr("data-autocomplete-initialized", true);

  // helper: match query to first or last name
  function matchesPlayer(name, query) {
    const lower = name.toLowerCase();
    const q = query.toLowerCase();
    return lower.startsWith(q) || lower.split(" ")[1]?.startsWith(q);
  }

  input.on("input", function() {
    const query = this.value.trim();

    if (!query) {
      results.selectAll("*").remove();
      results.style("display", "none");
      return;
    }

    // filter players
    const matches = players.filter(p => matchesPlayer(p, query)).slice(0, 15);

    if (matches.length === 0) {
      results.selectAll("*").remove();
      results.style("display", "none");
      return;
    }

    results.style("display", "block");

    // bind data
    const items = results.selectAll(".autocomplete-item")
      .data(matches, d => d);

    items.exit().remove();

    const itemsEnter = items.enter()
      .append("div")
      .attr("class", "autocomplete-item")
      .style("padding", "6px 10px")
      .style("cursor", "pointer")
      .style("border-bottom", "1px solid rgba(0,0,0,0.1)")
      .on("mouseover", function() { d3.select(this).style("background", "#eee"); })
      .on("mouseout", function() { d3.select(this).style("background", "transparent"); });

    // merge enter + update and attach click
    itemsEnter.merge(items)
      .text(d => d)
      .on("mousedown", function(event, d) {
        event.preventDefault(); // prevents focus loss race
        input.property("value", d);
        filters.player = d;
        results.selectAll("*").remove();
        results.style("display", "none");
        recomputeFilters();
    });
  });
  // hide results on blur
  input.on("blur", () => {
    setTimeout(() => results.selectAll("*").remove(), 150);
    results.style("display", "none");
  });
}

// NBA COURT -----------------------------------------------

const svgShotChart = d3
  .select("#shot-chart-svg")
  .attr("viewBox", "-25 -4 50 51")
  .attr("preserveAspectRatio", "xMidYMid meet");

svgShotChart.append("text")
  .attr("x", 0)
  .attr("y", -1)
  .attr("text-anchor", "middle")
  .attr("fill", "white")
  .style("font-size", "2px")
  .style("font-weight", "600")
  .text("Where do Players Shoot From?");

const g = svgShotChart.append("g");

const three_pt_coords = function(p){ //Given an x or y coordinate of the 3pt line, gives the other one.
  return (Math.sqrt(23.75**2 - p**2))
}
const three_pt_angle = function(num){ // Given a point on the x y plane (0,0 at the basket), what is the angle in radians?
  return (Math.asin(num))
}

function drawCourt(){

  const x = d => d;
  const y = d => d;

  // Clear existing court (important for redraws)
  g.selectAll(".court").remove();
  g.selectAll(".line").remove();
  const court = g
  .attr("class", "court")
  .attr("fill", "none")
  .attr("stroke", "#000")
  .attr("stroke-width", 0.167); // feet-based now

  // Court outline
  court.append("rect")
    .attr("class", "line")
    .attr("x", x(-25))
    .attr("y", y(0))
    .attr("width", x(25)-x(-25))
    .attr("height", y(47)-y(0))

  // Paint
  court.append("rect")
    .attr("class", "line")
    .attr("x", x(-8))
    .attr("y", y(0))
    .attr("width", x(16)-x(0))
    .attr("height", y(19)-y(0))

  // Restricted area
  const restricted_area_path = d3.path();
  restricted_area_path.moveTo(x(4), y(4));
  restricted_area_path.arc(x(0), y(4.75), x(4)-x(0), 0, Math.PI);
  restricted_area_path.lineTo(x(-4), y(4));
  court.append("path")
      .attr("class", "line")
      .attr("d", restricted_area_path.toString())
      .attr("stroke", "white")

  // Basket
  court.append("circle")
    .attr("class", "line")  
    .attr("cx", x(0))
    .attr("cy", y(4.75))
    .attr("r", x(.75)-x(0))

  // Backboard
  court.append("line")
    .attr("class", "line")
    .attr("x1", x(-3))
    .attr("y1", y(4))
    .attr("x2", x(3))
    .attr("y2", y(4))

  // Left-Corner 3pt line
  court.append("line")
    .attr("class", "line")
    .attr("x1", x(-22))
    .attr("y1", y(0))
    .attr("x2", x(-22))
    .attr("y2", y(14)) // subtracting 12.5 because we cut off 1 and a quarter ft of behind the basket.

  // Right-Corner 3pt line
  court.append("line")
    .attr("class", "line")
    .attr("x1", x(22))
    .attr("y1", y(0)) 
    .attr("x2", x(22))
    .attr("y2", y(14)) // subtracting 12.5 because we cut off 1 and a quarter ft of behind the basket.

  // Helper for arc radius
  const arcRadius = y(23.75) - y(0);

  // 3Pt Arc
  const Three_pt_line = d3.path();
  Three_pt_line.moveTo(x(22), y(14));
  Three_pt_line.arc(x(0), y(4.75), arcRadius, three_pt_angle(9.25/23.75), Math.PI - three_pt_angle(9.25/23.75));
  court.append("path")
      .attr("class", "line")
      .attr("d", Three_pt_line.toString())
      .attr("stroke", "white")

  // Half court circle
  const half_court_circle = d3.path();
  half_court_circle.moveTo(x(6), y(47));
  half_court_circle.arc(x(0), y(47), y(6)-y(0), Math.PI, Math.PI*2);
  court.append("path")
      .attr("class", "line")
      .attr("d", half_court_circle.toString())
      .attr("stroke", "white")

  const half_court_small_circle = d3.path();
  half_court_small_circle.moveTo(x(2), y(47));
  half_court_small_circle.arc(x(0), y(47), y(2)-y(0), Math.PI, Math.PI*2);
  court.append("path")
      .attr("class", "line")
      .attr("d", half_court_small_circle.toString())
      .attr("stroke", "white")

  // Top of the key
  const top_key = d3.path();
  top_key.moveTo(x(6), y(19));
  top_key.arc(x(0), y(19), y(6)-y(0), Math.PI, Math.PI*2);
  court.append("path")
      .attr("class", "line")
      .attr("d", top_key.toString())
      .attr("stroke", "white")
      .attr("stroke-dasharray", "1 1")
  
  const top_key_solid = d3.path();
  top_key_solid.moveTo(x(6), y(19));
  top_key_solid.arc(x(0), y(19), y(6)-y(0), 0, Math.PI);
  court.append("path")
      .attr("class", "line")
      .attr("d", top_key_solid.toString())
      .attr("stroke", "white")
}

drawCourt();

// APPLYING DATA TO CHART

// Square rooting the density values to smooth out the distribution
const colorScale = d3.scaleSequential()
  .domain([0, 1])
  .interpolator(t => d3.interpolatePlasma(Math.sqrt(t)));

const cellSize = 0.5; // must match the `resolution` param you sent the API

// Basket position in court coordinates
const BASKET_X = 0;
const BASKET_Y = 4.75;
const RA_RADIUS = 4; // restricted area radius in feet

let hideRestrictedArea = false;
let lastData = null; // cache last data so we can redraw on toggle

function filterData(data) {
  if (!hideRestrictedArea) return data;
  return data.filter(d => {
    const inPaint = d.x >= -8 && d.x <= 8 && d.y >= 0 && d.y <= 19;
    return !inPaint;
  });
}

function normalizeDensity(data) {
  // Re-normalize to [0,1] after filtering so color scale stays meaningful
  const max = d3.max(data, d => d.density);
  if (!max) return data;
  return data.map(d => ({ ...d, density: d.density / max }));
}

// SIMILAR PLAYERS UI ---------------------------------------------------

function updateSimilarPlayers(data) {
  // data.player and data.similar have arrays as values (R serialization quirk)
  const playerName  = Array.isArray(data.player.name)  ? data.player.name[0]  : data.player.name;
  const playerImage = Array.isArray(data.player.image) ? data.player.image[0] : data.player.image;

  // Selected player hero section
  d3.select("#similar-player-name").text(playerName);
  const heroImg = d3.select("#similar-player-photo");
  if (playerImage) {
    heroImg.attr("src", playerImage).attr("alt", playerName).style("display", "block");
  } else {
    heroImg.style("display", "none");
  }

  // Similar players row
  const container = d3.select("#similar-players-row");
  container.selectAll(".similar-card").remove();

  data.similar.forEach(p => {
    const name       = Array.isArray(p.name)       ? p.name[0]       : p.name;
    const image      = Array.isArray(p.image)      ? p.image[0]      : p.image;
    const similarity = Array.isArray(p.similarity) ? p.similarity[0] : p.similarity;
    const pct        = Math.round(similarity * 100);

    const card = container.append("div").attr("class", "similar-card");

    if (image) {
      card.append("img")
        .attr("src", image)
        .attr("alt", name)
        .attr("class", "similar-card-photo");
    } else {
      card.append("div").attr("class", "similar-card-photo similar-card-no-photo").text("?");
    }

    card.append("div").attr("class", "similar-card-name").text(name);
    card.append("div").attr("class", "similar-card-score").text(`${pct}% match`);
  });
}

function clearSimilarPlayers() {
  d3.select("#similar-player-name").text("Select a player");
  d3.select("#similar-player-photo").attr("src", "").style("display", "none");
  d3.select("#similar-players-row").selectAll(".similar-card").remove();
}

async function drawRectangles(data){
    lastData = data; // cache for toggle redraws
    svgShotChart.selectAll("rect").remove();

    const filtered = normalizeDensity(filterData(data));

    svgShotChart.selectAll("rect")
    .data(filtered)
    .enter()
    .append("rect")
    .attr("x", d => d.x - cellSize / 2)
    .attr("y", d => d.y - cellSize / 2)
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("fill", d => colorScale(d.density))

    g.raise(); // bring court lines on top of heatmap
}


// AVG DISTANCE LINE CHART ---------------------------------------------------

function drawDistanceLine(data) {
  const svg = d3.select("#DistanceLine");
  svg.selectAll("*").remove();

  const bounds = svg.node().getBoundingClientRect();
  const width  = bounds.width;
  const height = bounds.height;

  const margin = { top: 28, right: 20, bottom: 28, left: 20 };
  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = height - margin.top  - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text("Avg Shot Distance by Season (ft)");

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.season))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(data, d => d.avg_distance) * 0.9,
      d3.max(data, d => d.avg_distance) * 1.1
    ])
    .range([innerHeight, 0]);

  // Gridlines
  g.append("g")
    .call(
      d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .call(gg => gg.select(".domain").remove())
    .call(gg => gg.selectAll("line")
      .attr("stroke", "#333")
      .attr("stroke-dasharray", "3 3")
    );

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(data.length))
    .call(gg => gg.select(".domain").attr("stroke", "#555"))
    .call(gg => gg.selectAll("text")
      .attr("fill", "white")
      .style("font-size", "10px")
      .attr("transform", "rotate(45)")
      .attr("text-anchor", "start")
      .attr("dx", "0.4em")
      .attr("dy", "0.4em")
    )
    .call(gg => gg.selectAll("line").attr("stroke", "#555"));

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .call(gg => gg.select(".domain").attr("stroke", "#555"))
    .call(gg => gg.selectAll("text").attr("fill", "white").style("font-size", "10px"))
    .call(gg => gg.selectAll("line").attr("stroke", "#555"));

  // Gradient area under line
  const areaGen = d3.area()
    .x(d => x(d.season))
    .y0(innerHeight)
    .y1(d => y(d.avg_distance))
    .curve(d3.curveMonotoneX);

  const gradId = "dist-gradient";
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient")
    .attr("id", gradId)
    .attr("x1", "0").attr("y1", "0")
    .attr("x2", "0").attr("y2", "1");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "steelblue").attr("stop-opacity", 0.4);
  grad.append("stop").attr("offset", "100%").attr("stop-color", "steelblue").attr("stop-opacity", 0);

  g.append("path")
    .datum(data)
    .attr("fill", `url(#${gradId})`)
    .attr("d", areaGen);

  // Line
  const line = d3.line()
    .x(d => x(d.season))
    .y(d => y(d.avg_distance))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Dots
  g.selectAll(".dist-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dist-dot")
    .attr("cx", d => x(d.season))
    .attr("cy", d => y(d.avg_distance))
    .attr("r", 4)
    .attr("fill", "steelblue")
    .attr("stroke", "#111")
    .attr("stroke-width", 1.5);

  // Value labels on dots
  g.selectAll(".dist-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "dist-label")
    .attr("x", d => x(d.season))
    .attr("y", d => y(d.avg_distance) - 9)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "9px")
    .text(d => d.avg_distance.toFixed(1));
}

function clearDistanceLine() {
  d3.select("#DistanceLine").selectAll("*").remove();
}

// ASSIST LINE CHART ---------------------------------------------------

function drawAssistLine(data) {
  const svg = d3.select("#AssistLine");
  svg.selectAll("*").remove();

  const bounds = svg.node().getBoundingClientRect();
  const width  = bounds.width;
  const height = bounds.height;

  const margin = { top: 28, right: 20, bottom: 28, left: 36 };
  const innerWidth  = width  - margin.left - margin.right;
  const innerHeight = height - margin.top  - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text("% of Makes Assisted by Season");

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.season))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerHeight, 0]);

  // Gridlines
  g.append("g")
    .call(
      d3.axisLeft(y)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .call(gg => gg.select(".domain").remove())
    .call(gg => gg.selectAll("line")
      .attr("stroke", "#333")
      .attr("stroke-dasharray", "3 3")
    );

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(data.length))
    .call(gg => gg.select(".domain").attr("stroke", "#555"))
    .call(gg => gg.selectAll("text")
      .attr("fill", "white")
      .style("font-size", "10px")
      .attr("transform", "rotate(45)")
      .attr("text-anchor", "start")
      .attr("dx", "0.4em")
      .attr("dy", "0.4em")
    )
    .call(gg => gg.selectAll("line").attr("stroke", "#555"));

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`))
    .call(gg => gg.select(".domain").attr("stroke", "#555"))
    .call(gg => gg.selectAll("text").attr("fill", "white").style("font-size", "10px"))
    .call(gg => gg.selectAll("line").attr("stroke", "#555"));

  // Gradient area under line
  const areaGen = d3.area()
    .x(d => x(d.season))
    .y0(innerHeight)
    .y1(d => y(d.assist_pct))
    .curve(d3.curveMonotoneX);

  const gradId = "assist-gradient";
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient")
    .attr("id", gradId)
    .attr("x1", "0").attr("y1", "0")
    .attr("x2", "0").attr("y2", "1");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "#e07b39").attr("stop-opacity", 0.4);
  grad.append("stop").attr("offset", "100%").attr("stop-color", "#e07b39").attr("stop-opacity", 0);

  g.append("path")
    .datum(data)
    .attr("fill", `url(#${gradId})`)
    .attr("d", areaGen);

  // Line
  const line = d3.line()
    .x(d => x(d.season))
    .y(d => y(d.assist_pct))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#e07b39")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Dots
  g.selectAll(".assist-dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "assist-dot")
    .attr("cx", d => x(d.season))
    .attr("cy", d => y(d.assist_pct))
    .attr("r", 4)
    .attr("fill", "#e07b39")
    .attr("stroke", "#111")
    .attr("stroke-width", 1.5);

  // Value labels on dots
  g.selectAll(".assist-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "assist-label")
    .attr("x", d => x(d.season))
    .attr("y", d => y(d.assist_pct) - 9)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "9px")
    .text(d => `${Math.round(d.assist_pct * 100)}%`);
}

function clearAssistLine() {
  d3.select("#AssistLine").selectAll("*").remove();
}

// STAT PANELS (bottom middle + bottom right) ---------------------------------------------------

function ordinalSuffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function drawAttemptsPanel(data) {
  const panel = d3.select(".shot-chart-legend");
  panel.selectAll("*").remove();
  if (!data || data.error) return;

  const pct = Math.round(data.percentile * 100);
  const card = panel.append("div").attr("class", "stat-card");
  card.append("div").attr("class", "stat-label").text("Total Attempts");
  card.append("div").attr("class", "stat-value").text(parseInt(data.attempts).toLocaleString());
  card.append("div").attr("class", "stat-bar-wrap")
    .append("div").attr("class", "stat-bar-fill stat-bar-blue").style("width", `${pct}%`);
  card.append("div").attr("class", "stat-percentile").text(`${ordinalSuffix(pct)} percentile`);
}

function clearAttemptsPanel() {
  d3.select(".shot-chart-legend").selectAll("*").remove();
}

function drawPointsPerShotPanel(data) {
  const panel = d3.select(".line-chart-legend");
  panel.selectAll("*").remove();
  if (!data || data.error) return;

  const pct = Math.round(data.percentile * 100);
  const card = panel.append("div").attr("class", "stat-card");
  card.append("div").attr("class", "stat-label").text("Points Per Shot");
  card.append("div").attr("class", "stat-value").text(parseFloat(data.points_per_shot).toFixed(3));
  card.append("div").attr("class", "stat-bar-wrap")
    .append("div").attr("class", "stat-bar-fill stat-bar-green").style("width", `${pct}%`);
  card.append("div").attr("class", "stat-percentile").text(`${ordinalSuffix(pct)} percentile`);
}

function clearPointsPerShotPanel() {
  d3.select(".line-chart-legend").selectAll("*").remove();
}

async function update(selections){
    const player_density = await fetchPlayerDensity(selections.player, selections.season, selections.quarter);
    drawRectangles(player_density);
    drawCourt();

    if (selections.player && selections.player !== "All" && selections.player !== "") {
      // Similar players
      try {
        const similarData = await fetchSimilarPlayers(selections.player, selections.season);
        if (similarData && !similarData.error) {
          updateSimilarPlayers(similarData);
        } else {
          clearSimilarPlayers();
        }
      } catch(err) {
        console.error("Similar players fetch failed:", err);
        clearSimilarPlayers();
      }

      // Avg distance line chart
      try {
        const distData = await fetchAvgDistance(selections.player);
        if (distData && distData.length > 0) {
          drawDistanceLine(distData);
        } else {
          clearDistanceLine();
        }
      } catch(err) {
        console.error("Avg distance fetch failed:", err);
        clearDistanceLine();
      }

      // Assist pct line chart
      try {
        const assistData = await fetchAssistPct(selections.player);
        if (assistData && assistData.length > 0) {
          drawAssistLine(assistData);
        } else {
          clearAssistLine();
        }
      } catch(err) {
        console.error("Assist pct fetch failed:", err);
        clearAssistLine();
      }

      // Total attempts panel
      try {
        const attemptsData = await fetchTotalAttempts(selections.player, selections.season, selections.quarter);
        if (attemptsData && !attemptsData.error) {
          drawAttemptsPanel(attemptsData);
        } else {
          clearAttemptsPanel();
        }
      } catch(err) {
        console.error("Total attempts fetch failed:", err);
        clearAttemptsPanel();
      }

      // Points per shot panel
      try {
        const ppsData = await fetchPointsPerShot(selections.player, selections.season, selections.quarter);
        if (ppsData && !ppsData.error) {
          drawPointsPerShotPanel(ppsData);
        } else {
          clearPointsPerShotPanel();
        }
      } catch(err) {
        console.error("Points per shot fetch failed:", err);
        clearPointsPerShotPanel();
      }

    } else {
      clearSimilarPlayers();
      clearDistanceLine();
      clearAssistLine();
      clearAttemptsPanel();
      clearPointsPerShotPanel();
    }
}

// Handling clear button ----------------------------------------

function clearChart(){

  // 2. Remove all region interaction handlers
    // svgShotChart
    //   .selectAll(".region")
    //   .style("fill", "#FFFFFF")
    //   .style("fill-opacity", 0.8)
    //   .on("mouseover", null)
    //   .on("mousemove", null)
    //   .on("mouseleave", null);

}

d3.select("#clear-button").on("click", async () => {
  const btn = d3.select("#clear-button");
  btn.property("disabled", true);

  // Reset all filter values to "All"
  for (let key in filters) filters[key] = "All";

  // Recompute all dropdowns from scratch
  await recomputeFilters();
  clearChart();

  // Reset player autocomplete input
  d3.select("#player-input").property("value", "");
  d3.select("#player-results").selectAll("*").remove();

  btn.property("disabled", false);
});

//Handling filter changes------------------------------------------

function getSelections(){
  var selectedPlayer = d3.select("#player-input").property("value")
  var selectedTeam = d3.select("#team-select").property("value")
  var selectedQuarter = d3.select("#quarter-select").property("value")
  var selectedSeason = d3.select("#season-select").property("value")
  var selectedDefendingTeam = d3.select("#defending_team-select").property("value")
  var selections = {
    season: selectedSeason,
    player: selectedPlayer,
    team: selectedTeam,
    quarter: selectedQuarter,
    defending_team: selectedDefendingTeam
  }
  return(selections);
}

d3.select("#filter-button").on("click", async function(event, d) {
  const selections = getSelections();
  update(selections);
})

const filters = {
    season: "All",
    player: "All",
    team: "All",
    quarter: "All",
    defending_team: "All"
};

let playerUniverse = [];


["season", "player", "team", "quarter", "defending_team"].forEach(key => {
  registerFilter(key);
});

(async function init() {
  await recomputeFilters();
})();