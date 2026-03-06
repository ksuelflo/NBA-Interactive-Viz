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

// Region Stats

async function fetchLeagueRegionStats(season) {
  const res = await fetch(`${API_BASE}/league/regions?season=${season}`);
  if (!res.ok) {
    throw new Error("Failed to fetch league region stats");
  }
  return await res.json();
}

async function fetchTeamRegionStats(season, team, period) {
  const res = await fetch(`${API_BASE}/team/regions?season=${season}&periodr=${period}&team_name=${team}`);
  if (!res.ok) {
    throw new Error("Failed to fetch team averages by region");
  }
  return await res.json();
}

async function fetchPlayerRegionStats(season, player, period) {
  const res = await fetch(`${API_BASE}/player/regions?season=${season}&periodr=${period}&player_name=${player}`);
  if (!res.ok) {
    throw new Error("Failed to fetch team averages by region");
  }
  return await res.json();
}

async function fetchTeamRegionStatsLineChart(team) {
  const res = await fetch(`${API_BASE}/team/regions/yearly?team_name=${team}`);
  if (!res.ok) {
    throw new Error("Failed to fetch team yearly averages by region");
  }
  return await res.json();
}

async function fetchPlayerRegionStatsLineChart(player) {
  const res = await fetch(`${API_BASE}/player/regions/yearly?player_name=${player}`);
  if (!res.ok) {
    throw new Error("Failed to fetch player yearly averages by region");
  }
  return await res.json();
}

async function fetchStackedBar(player) {
  const res = await fetch(`${API_BASE}/player/shot-distribution/yearly?player_name=${player}`);
  if (!res.ok) {
    throw new Error("Failed to fetch player shot-distribution yearly");
  }
  return await res.json();
}

async function fetchPlayerImage(player) {
  const res = await fetch(`${API_BASE}/player/profile?player_name=${player}`);
  if (!res.ok) {
    throw new Error("Failed to fetch player image");
  }
  return await res.json();
}

async function fetchPositionRegionStats(position) {
  const res = await fetch(`${API_BASE}/position/regions?position=${encodeURIComponent(position)}`);
  if (!res.ok) throw new Error("Failed to fetch position region stats");
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

// APPLYING DATA TO CHART

function indexPlayerByRegion(playerData) {
  return Object.fromEntries(
    playerData.map(d => [d.region, d])
  );
}

function mergeLeagueAndPlayer(leagueData, playerData) {
  const playerByRegion = indexPlayerByRegion(playerData);

  return leagueData.map(leagueRow => {
    const playerRow = playerByRegion[leagueRow.region];

    const attempts = playerRow?.attempts ?? 0;
    const makes = playerRow?.makes ?? 0;
    const player_pct =
      attempts > 0 ? playerRow.fg_pct : "NA";

    return {
      region: leagueRow.region,
      attempts,
      makes,
      league_pct: leagueRow.fg_pct,
      player_pct,
      diff_pct:
        player_pct !== "NA"
          ? player_pct - leagueRow.fg_pct
          : "NA"
    };
  });
}

async function update(selections) {
  lockedRegion = null;
  clearTooltip();

  const league_avg = await fetchLeagueRegionStats(selections.season);
  let data;
  console.log(selections.player);
  if (selections.player === "All") {
    data = await fetchTeamRegionStats(
      selections.season,
      selections.team,
      selections.quarter
    );
  } else {
    data = await fetchPlayerRegionStats(
      selections.season,
      selections.player,
      selections.quarter
    );
  }

  // player image + position update:
  try {
    const profile = await fetchPlayerImage(selections.player);

    const img = document.getElementById("tooltip-player-photo");
    document.getElementById("tooltip-player").textContent = profile[0].name;

    if (profile.length > 0 && profile[0].image) {
      img.src = profile[0].image;
      img.alt = profile[0].name;
    } else {
      img.src = "";
      img.alt = "No image available";
    }

    const posGroup = profile[0].position;
    console.log("profile[0]:", profile[0]);
    console.log("posGroup:", posGroup);
    if (posGroup) {
      try {
        positionRegionData = await fetchPositionRegionStats(posGroup);
        console.log("positionRegionData:", positionRegionData);
      } catch (err) {
        console.error("Position region fetch failed:", err);
        positionRegionData = null;
      }
    } else {
      positionRegionData = null;
    }

  } catch (err) {
    console.error("Image fetch failed:", err);
    positionRegionData = null;
  }

  const merged = mergeLeagueAndPlayer(league_avg, data);
  applyRegionData(merged);

  const stackedData = await fetchStackedBar(selections.player);
  drawShotDistributionChart(stackedData);
}




// APPLYREGIONALDATA AUXILLARY FUNCTIONS (tooltip interaction, region coloring)

function mouseover(tooltip) {
  return function(event, d) {
    tooltip.style("opacity", 1);

    d3.select(this)
      .style("stroke", "white")
      .style("opacity", 1);
  };
}

function mouseleave(tooltip) {
  return function(event, d) {
    tooltip.style("opacity", 0);

    d3.select(this)
      .style("stroke", "black")
      .style("opacity", 1);
  };
}

function createHashes(){
  const defs = svgShotChart.append("defs");

  defs.append("pattern")
    .attr("id", "diagonal-hatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 12)
    .attr("height", 12)
    .attr("patternTransform", "rotate(45)")
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", 12)
    .attr("stroke", "#000000")
    .attr("stroke-width", 4);
}

function checkNanColor(spot){
  if (isNaN(spot.diff_pct)){
    return "url(#diagonal-hatch)";
  }
  else {
    return colorScale(spot.diff_pct)
  }
}

function handleNanTooltip(type, spot){
  if (type == "makes"){
    if (spot.makes == undefined){
      // spot.makes = 0;
      return ("0");
    }
    else{
      return (spot.makes)
    }
  }
  else if (type == "attempts"){
    if (spot.attempts == undefined){
      // spot.attempts = 0;
      return ("0");
    }
    else{
      return (spot.attempts)
    }
  }
  else if (type == "player_pct"){
    if (spot.player_pct == undefined){
      // spot.player_pct = "N/A";
      return ("N/A");
    }
    else{
      return ((spot.player_pct * 100).toFixed(1) + "%")
    }
  }
  else {
    if (isNaN(spot.diff_pct)){
      // spot.diff = "N/A";
      return ("N/A");
    }
    else{
      return ((spot.diff_pct*100).toFixed(1) + "%")
    }
  }
}

function applyRegionData(data) {
  svgShotChart.selectAll(".region")
    .each(function () {
      const regionName = d3.select(this).attr("data-region");
      const row = data.find(d => d.region === regionName);

      if (!row) return;

      d3.select(this)
        .datum(row)
        .style("fill", checkNanColor(row));
    });

  // Re-register event listeners AFTER data is bound, so `d` is always valid
  svgShotChart.selectAll(".region")
    .on("mouseover", function(event, d) {
      if (!d) return;
      if (lockedRegion) return;
      regionDispatcher.call("regionHover", null, d.region);
      updateTooltip(d);
    })
    .on("mouseout", function(event, d) {
      if (lockedRegion) return;
      clearTooltip();
      regionDispatcher.call("regionOut");
    })
    .on("click", function(event, d) {
      if (!d) return;
      event.stopPropagation();

      svgShotChart.selectAll(".region").classed("locked", false);

      if (lockedRegion === d.region) {
        lockedRegion = null;
        clearTooltip();
        regionDispatcher.call("regionOut");
      } else {
        lockedRegion = d.region;
        d3.select(this).classed("locked", true);
        updateTooltip(d);
        regionDispatcher.call("regionHover", null, d.region);
      }
    });
}



//ColorScale/Legend

const colorScale = d3.scaleDiverging()
  .domain([-0.15, 0, 0.15])
  .interpolator(d3.interpolatePRGn)

// SHOT CHART LEGEND ---------------------------------------------------
function drawShotChartLegend() {
  const container = d3.select(".shot-chart-legend");
  container.selectAll("svg").remove();

  const bounds = container.node().getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;

  const svg = container.append("svg")
    .style("width", "100%")
    .style("height", "100%");

  const legendGroup = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width / 2 - 245}, ${height / 2 - 45})`)

  const legend = d3.legendColor()
    .scale(colorScale)
    .orient("horizontal")
    .shapeWidth(50)
    .shapeHeight(14)
    .cells(9)
    .labelOffset(6)
    .labelFormat(d3.format("+.0%"))
    .title("FG% Difference from League Avg")
    .titleWidth(800);

  legendGroup.call(legend);

  // style the title to match the dark theme
  legendGroup.select(".label.legendTitle")
    .style("fill", "white")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("text-transform", "uppercase")
    .style("opacity", "0.7");

  // style the tick labels
  legendGroup.selectAll(".label")
    .style("fill", "white")
    .style("font-size", "10px");
}

// HANDLING HOVERING EVENTS--------------------------------------------------
const regionDispatcher = d3.dispatch("regionHover", "regionOut");

// SHOT CHART -----------------------------------------------

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
  .text("FG% vs League Avg");

const g = svgShotChart.append("g");

const three_pt_coords = function(p){ //Given an x or y coordinate of the 3pt line, gives the other one.
  return (Math.sqrt(23.75**2 - p**2))
}
const three_pt_angle = function(x,y){ // Given a point on the x y plane (0,0 at the basket), what is the angle in radians?
  return (Math.atan2(y,x))
}

function drawCourt() {
  const x = d => d;
  const y = d => d;

  // Clear existing court (important for redraws)
  g.selectAll(".court").remove();

  const court = g
    .attr("class", "court")
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 0.167); // feet-based now

  // Paint
  court.append("rect")
    .attr("class", "region")
    .attr("x", x(-8))
    .attr("y", y(0))
    .attr("width", x(16) - x(0))
    .attr("height", y(19) - y(0))
    .attr("data-region", "In the Paint (Non-RA)");

  // Restricted Area
  court.append("circle")
    .attr("class", "region")
    .attr("cx", x(0))
    .attr("cy", y(4))
    .attr("r", x(3) - x(0))
    .attr("data-region", "Restricted Area");

  // Left Mid-Range
  court.append("rect")
    .attr("class", "region")
    .attr("x", x(-21.5))
    .attr("y", y(0))
    .attr("width", x(-8) - x(-21.5))
    .attr("height", y(14) - y(0))
    .attr("data-region", "Left Mid-Range");

  // Right Mid-Range
  court.append("rect")
    .attr("class", "region")
    .attr("x", x(8))
    .attr("y", y(0))
    .attr("width", x(21.5) - x(8))
    .attr("height", y(14) - y(0))
    .attr("data-region", "Right Mid-Range");

  // Left Corner 3
  court.append("rect")
    .attr("class", "region")
    .attr("x", x(-25))
    .attr("y", y(0))
    .attr("width", x(-21.5) - x(-25))
    .attr("height", y(14) - y(0))
    .attr("data-region", "Left Corner 3");

  // Right Corner 3
  court.append("rect")
    .attr("class", "region")
    .attr("x", x(21.5))
    .attr("y", y(0))
    .attr("width", x(25) - x(21.5))
    .attr("height", y(14) - y(0))
    .attr("data-region", "Right Corner 3");

  // Backcourt
  court.append("rect")
    .attr("class", "region")
    .attr("x", x(-25))
    .attr("y", y(38))
    .attr("width", x(25) - x(-25))
    .attr("height", y(47) - y(38))
    .attr("data-region", "Backcourt");

  // Helper for arc radius
  const arcRadius = y(23.75) - y(0);

  // Left Wing Mid-Range
  const leftWing = d3.path();
  leftWing.moveTo(x(-8), y(three_pt_coords(-8)));
  leftWing.arc(
    x(0), y(4),
    arcRadius,
    three_pt_angle(-8, three_pt_coords(-8)),
    three_pt_angle(-21.5, 10)
  );
  leftWing.lineTo(x(-8), y(14));
  leftWing.closePath();

  court.append("path")
    .attr("class", "region")
    .attr("d", leftWing)
    .attr("data-region", "Left Wing Mid-Range");

  // Center Mid-Range
  const center = d3.path();
  center.moveTo(x(8), y(three_pt_coords(8)));
  center.arc(
    x(0), y(4),
    arcRadius,
    three_pt_angle(8, three_pt_coords(8)),
    three_pt_angle(-8, three_pt_coords(-8))
  );
  center.lineTo(x(-8), y(19));
  center.lineTo(x(8), y(19));
  center.closePath();

  court.append("path")
    .attr("class", "region")
    .attr("d", center)
    .attr("data-region", "Center Mid-Range");

  // Right Wing Mid-Range
  const rightWing = d3.path();
  rightWing.moveTo(x(21.5), y(14));
  rightWing.arc(
    x(0), y(4),
    arcRadius,
    three_pt_angle(21.5, 10),
    three_pt_angle(8, three_pt_coords(8))
  );
  rightWing.lineTo(x(8), y(14));
  rightWing.closePath();

  court.append("path")
    .attr("class", "region")
    .attr("d", rightWing)
    .attr("data-region", "Right Wing Mid-Range");

  // Left Wing 3
  const leftWing3 = d3.path();
  leftWing3.moveTo(x(-8), y(three_pt_coords(-8)));
  leftWing3.arc(
    x(0), y(4),
    arcRadius,
    three_pt_angle(-8, three_pt_coords(-8)),
    three_pt_angle(-21.5, 10)
  );
  leftWing3.lineTo(x(-25), y(14));
  leftWing3.lineTo(x(-25), y(38));
  leftWing3.lineTo(x(-8), y(38));
  leftWing3.closePath();

  court.append("path")
    .attr("class", "region")
    .attr("d", leftWing3)
    .attr("data-region", "Left Wing 3");
  
  // Right Wing 3
  const rightWing3 = d3.path();
  rightWing3.moveTo(x(21.5), y(14));
  rightWing3.arc(
    x(0), y(4),
    arcRadius,
    three_pt_angle(21.5, 14),
    three_pt_angle(8, three_pt_coords(8))
  );
  rightWing3.lineTo(x(8), y(38));
  rightWing3.lineTo(x(25), y(38));
  rightWing3.lineTo(x(25), y(14));
  rightWing3.closePath();

  court.append("path")
    .attr("class", "region")
    .attr("d", rightWing3)
    .attr("data-region", "Right Wing 3");

  // Center 3
  const center3 = d3.path();
  center3.moveTo(x(8), y(three_pt_coords(8)));
  center3.arc(
    x(0), y(4),
    arcRadius,
    three_pt_angle(8, three_pt_coords(8)),
    three_pt_angle(-8, three_pt_coords(-8))
  );
  center3.lineTo(x(-8), y(38));
  center3.lineTo(x(8), y(38));
  center3.closePath();

  court.append("path")
    .attr("class", "region")
    .attr("d", center3)
    .attr("data-region", "Above the Break 3");

  regionDispatcher.on("regionHover.shotchart", function(region) {

    d3.selectAll(".region")
      .attr("opacity", d => d && d.region === region ? 1 : 0.3)
      .classed("highlighted", d => d && d.region === region);

    // Now raise ONLY the selected one
    d3.selectAll(".region")
      .filter(d => d && d.region === region);
      // .raise();
  });


  regionDispatcher.on("regionOut.shotchart", function() {
    d3.selectAll(".region")
      .attr("opacity", 1)
      .classed("highlighted", false);
  });
}

drawCourt();



// LINE CHART---------------------------------------------------

const REGION_GROUPS = {
  paint: [
    "Restricted Area",
    "In the Paint (Non-RA)"
  ],
  mid: [
    "Right Mid-Range",
    "Left Mid-Range",
    "Center Mid-Range",
    "Left Wing Mid-Range",
    "Right Wing Mid-Range"

  ],
  three: [
    "Left Corner 3",
    "Right Corner 3",
    "Left Wing 3",
    "Right Wing 3",
    "Above the Break 3"
  ]
};

function getRegionGroup(region) {
  if (REGION_GROUPS.paint.includes(region)) return "paint";
  if (REGION_GROUPS.mid.includes(region)) return "mid";
  if (REGION_GROUPS.three.includes(region)) return "three";
  return "other";
}


function drawRegionLineChart(data) {
  const svg = d3.select("#AvgLine");

  // Clear previous chart content
  svg.selectAll("*").remove();

  // Get actual rendered size from CSS/grid
  const bounds = svg.node().getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;

  const margin = { top: 24, right: 20, bottom: 20, left: 40 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title for line chart
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .text("FG% by Region Over Time");
  // Parse numeric values
  data.forEach(d => {
    d.season = +d.season;
    d.fg_pct = +d.fg_pct;
  });

  // ---- Scales ----
  // const x = d3.scaleLinear()
  //   .domain(d3.extent(data, d => d.season))
  //   .range([0, innerWidth]);
  const seasons = [...new Set(data.map(d => d.season))]
  .sort((a, b) => a - b);
  const x = d3.scalePoint()
  .domain(seasons)
  .range([0, innerWidth])
  .padding(0.5);

  const y = d3.scaleLinear()
    // .domain([
    //   d3.min(data, d => d.fg_pct),
    //   d3.max(data, d => d.fg_pct)
    // ])
    .domain([0, 1])
    .nice()
    .range([innerHeight, 0]);

  // ---- Axes ----
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));


  g.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  // ---- Group by region ----
  const regions = d3.group(data, d => d.region);

  const groupColor = d3.scaleOrdinal()
    .domain(["paint", "mid", "three"])
    .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);


  const line = d3.line()
    .x(d => x(d.season))
    .y(d => y(d.fg_pct));
    // .curve(d3.curveMonotoneX);

  // ---- Draw lines ----
  g.selectAll(".region-line")
    .data(regions)
    .enter()
    .append("path")
    .attr("class", "region-line")
    .attr("fill", "none")
    .attr("stroke", d => {
      const group = getRegionGroup(d[0]);
      return groupColor(group);
    })
    .attr("stroke-width", 2)
    .attr("d", d => {
      const sorted = d[1].sort((a, b) => a.season - b.season);
      return line(sorted);
    })
    .on("mouseover", function(event, d) {
      if (lockedRegion) return;
      const region = d[0];
      regionDispatcher.call("regionHover", null, region);
    })
    .on("mouseout", function() {
      if (lockedRegion) return;
      regionDispatcher.call("regionOut");
    });

    regionDispatcher.on("regionHover.linechart", function(region) {

      d3.selectAll(".region-line")
        .attr("opacity", d => d[0] === region ? 1 : 0.15)
        .attr("stroke-width", d => d[0] === region ? 4 : 2);

      // Raise the selected line so it sits on top
      d3.selectAll(".region-line")
        .filter(d => d[0] === region)
        .raise();
    });

    regionDispatcher.on("regionOut.linechart", function() {
      d3.selectAll(".region-line")
        .attr("opacity", 1)
        .attr("stroke-width", 2);
    });

    
}

// STACKED BAR CHART---------------------------------------------------
function drawShotDistributionChart(data) {

  const svg = d3.select("#ShotDist");
  svg.selectAll("*").remove();

  const bounds = svg.node().getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;

  const margin = { top: 24, right: 20, bottom: 20, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title for stacked bar chart
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .text("Shot Distribution by Season");
  // --- Clean numeric types ---
  data.forEach(d => {
    d.season = +d.season;
    d.freq = +d.freq;
  });

  const shotGroups = ["paint", "mid", "three"];

  // --- Reshape data into wide format ---
  const stackedData = d3.rollups(
    data,
    v => {
      const obj = {};
      shotGroups.forEach(k => {
        const found = v.find(d => d.shot_group === k);
        obj[k] = found ? found.freq : 0;
      });
      return obj;
    },
    d => d.season
  ).map(([season, values]) => ({
    season,
    ...values
  }))
  .sort((a, b) => d3.ascending(a.season, b.season));

  // --- Stack generator ---
  const stack = d3.stack()
    .keys(shotGroups)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(stackedData);

  // --- Scales ---
  const x = d3.scaleBand()
    .domain(stackedData.map(d => d.season))
    .range([0, innerWidth])
    .padding(0.15);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(shotGroups)
    .range([
      "#1f77b4",  // paint
      "#ff7f0e",  // mid
      "#2ca02c"   // three
    ]);

  // --- Axes ---
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  g.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  // --- Bars ---
  const group = g.selectAll(".series")
    .data(series)
    .enter()
    .append("g")
    .attr("fill", d => color(d.key));

  group.selectAll("rect")
    .data(d => d)
    .enter()
    .append("rect")
    .attr("x", d => x(d.data.season))
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth());
}

// STACKED BAR CHART + LINE CHART LEGEND---------------------------------------------------
function drawShotLegend() {

  const legendData = [
    { label: "Paint", color: "#1f77b4" },
    { label: "Mid-Range", color: "#ff7f0e" },
    { label: "3PT", color: "#2ca02c" }
  ];

  const container = d3.select(".line-chart-legend");
  container.selectAll("*").remove();

  const items = container
    .selectAll(".legend-item")
    .data(legendData)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  items.append("div")
    .attr("class", "legend-swatch")
    .style("background-color", d => d.color);

  items.append("div")
    .text(d => d.label);
}
drawShotLegend();
drawShotChartLegend();

// Handling clear button ----------------------------------------

function clearChart(){
  // 1. Force-hide tooltip
  // hideTooltip(svg.select(".Tooltip"));

  // 2. Remove all region interaction handlers
    svgShotChart
      .selectAll(".region")
      .style("fill", "#FFFFFF")
      .style("fill-opacity", 0.8)
      .on("mouseover", null)
      .on("mousemove", null)
      .on("mouseleave", null);

}

function hideTooltip(tooltip) {
  tooltip
    .style("opacity", 0)
    .style("pointer-events", "none")
    .html("");
}

d3.select("#clear-button").on("click", async () => {
  const btn = d3.select("#clear-button");
  btn.property("disabled", true);

  // Reset all filter values to "All"
  for (let key in filters) filters[key] = "All";

  // Recompute all dropdowns from scratch
  await recomputeFilters();
  // clearChart();

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
  var selections = {
    season: selectedSeason,
    player: selectedPlayer,
    team: selectedTeam,
    quarter: selectedQuarter,
  }
  return(selections);
}

d3.select("#filter-button").on("click", async function(event, d) {
  const selections = getSelections();
  let data;
  if (selections.player !== "All") {
    data = await fetchPlayerRegionStatsLineChart(selections.player);
  } else if (selections.team !== "All"){
    data = await fetchTeamRegionStatsLineChart(selections.team);
  }
  else{
    data = await fetchPlayerRegionStatsLineChart(selections.player);
  }
  drawRegionLineChart(data);
  update(selections);
})

const filters = {
    season: "All",
    player: "All",
    team: "All",
    quarter: "All",
};

let playerUniverse = [];


["season", "player", "team", "quarter"].forEach(key => {
  registerFilter(key);
});

(async function init() {
  await recomputeFilters();
})();

//TOOLTIP----------------------------------------------------------

const pct = d3.format(".1%");

function updateTooltip(d) {
  if (d === undefined){
    return
  }
  console.log(d);
  d3.select("#tooltip-region").text(d.region);

  d3.select("#tooltip-fgm")
    .text(`${d.makes} / ${d.attempts}`);

  d3.select("#tooltip-fg")
    .text(d.player_pct === "NA" ? "NA" : pct(d.player_pct));

  d3.select("#tooltip-league")
    .text(pct(d.league_pct));

  d3.select("#tooltip-diff")
    .text(
      d.diff_pct === "NA"
        ? "NA"
        : pct(d.diff_pct)
    );

  if (positionRegionData) {
    const posRow = positionRegionData.find(r => r.region === d.region);
    d3.select("#tooltip-position").text(posRow ? pct(posRow.fg_pct) : "N/A");
  } else {
    d3.select("#tooltip-position").text("N/A");
  }
}


let lockedRegion = null;
let positionRegionData = null;





function clearTooltip() {
  d3.select("#tooltip-region").text("Hover a region");
  d3.select("#tooltip-fgm").text("");
  d3.select("#tooltip-fg").text("");
  d3.select("#tooltip-league").text("");
  d3.select("#tooltip-diff").text("");
  d3.select("#tooltip-position").text("");
}


//Click outside to unlock
d3.select('body').on('click', () => {
  lockedRegion = null;
  clearTooltip();
  svgShotChart.selectAll(".region").classed("locked", false);
  regionDispatcher.call("regionOut");
});


