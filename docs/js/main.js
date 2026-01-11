// Inport statements are in the HTML!

// const shots = await d3.csv("./data/shots_by_region_12_15.csv", d => ({
//   ...d,
//   PLAYER_NAME: d.name.trim(),
//   region: d.region.trim(),
//   TEAM_NAME: d.team_name.trim(),
//   period: d.period_number
// }));

const API_BASE = "http://127.0.0.1:8000";

async function fetchLeagueRegionStats(season) {
  const res = await fetch(`${API_BASE}/league/regions?season=${season}`);
  if (!res.ok) {
    throw new Error("Failed to fetch league region stats");
  }
  return await res.json();
}

async function getLeagueRegionStats(season){
  const data = await fetchLeagueRegionStats(season);
  return (data);
}


async function fetchTeamRegionStats(season, team, period) {
  const res = await fetch(`${API_BASE}/team/regions?season=${season}&periodr=${period}&team_name=${team}`);
  if (!res.ok) {
    throw new Error("Failed to fetch team averages by region");
  }
  return await res.json();
}

async function getTeamRegionStats(season, team, period){
  const data = await fetchTeamRegionStats(season, team, period);
  return (data);
}

async function fetchPlayerRegionStats(season, player, period) {
  const res = await fetch(`${API_BASE}/player/regions?season=${season}&periodr=${period}&player_name=${player}`);
  if (!res.ok) {
    throw new Error("Failed to fetch team averages by region");
  }
  return await res.json();
}

async function getPlayerRegionStats(season, player, period){
  const data = await fetchPlayerRegionStats(season, player, period);
  return (data);
}

//Useful constants
const width = 425;
const height = width*47/50;
const margin = 30;
const legendWidth = 800;
const legendHeight = 150;

//Initializing svg
var svg_left = d3.select("#left_chart")
  .append("svg")
    .attr("id", "left_svg")
    .attr("width", width+margin)
    .attr("height", height+margin+100)

var svg_right = d3.select("#right_chart")
  .append("svg")
    .attr("id", "right_svg")
    .attr("width", width + margin)
    .attr("height", height + margin+100)

// Color Scale
const colorScale = d3.scaleDiverging()
  .domain([-0.15, 0, 0.15])
  .interpolator(d3.interpolatePRGn)
  // .interpolator(t => d3.interpolateRdBu(1 - t))

// FILTER STUFF --------------------------------------------------
async function fetchFilterUniverse(filters) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/filters/universe?${params}`);

  if (!res.ok) {
    throw new Error("Failed to fetch filter universe");
  }
  console.log("hello");
  return await res.json();
}

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


async function recomputeFilters(side, changedKey = null) {
  const data = await fetchFilterUniverse(filters[side]);
  playerUniverse[side] = data.players;

  if (changedKey !== "season") {
    updateSelect(`#${side}-season-select`, data.seasons, filters[side].season);
  }

  if (changedKey !== "player") {
    updateSelect(`#${side}-player-select`, data.players, filters[side].player);
  }

  if (changedKey !== "team") {
    updateSelect(`#${side}-team-select`, data.teams, filters[side].team);
  }

  if (changedKey !== "quarter") {
    updateSelect(`#${side}-quarter-select`, data.quarters, filters[side].quarter);
  }
  setupPlayerAutocomplete(side, data.players, filters);
}


function registerFilter(side, key) {
  d3.select(`#${side}-${key}-select`)
    .on("change", async function () {
      filters[side][key] = this.value;

      await recomputeFilters(side, key);  // 👈 key exclusion
      // await recomputeChart(side);
    });
}
function matchesPlayer(player, query) {
  if (!query) return true;

  const q = query.toLowerCase();
  const parts = player.toLowerCase().split(" ");

  return parts.some(p => p.startsWith(q));
}


function setupPlayerAutocomplete(side, players, filters) {
  const input = d3.select(`#${side}-player-input`);
  const results = d3.select(`#${side}-player-results`);

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
        filters[side].player = d;
        results.selectAll("*").remove();
        results.style("display", "none");
        recomputeFilters(side);
    });
  });
  // hide results on blur
  input.on("blur", () => {
    setTimeout(() => results.selectAll("*").remove(), 150);
    results.style("display", "none");
  });
}


// function setupPlayerAutocomplete(side, players, filters) {
//   const input = d3.select(`#${side}-player-input`);
//   const results = d3.select(`#${side}-player-results`);
//   input.on("input", function () {
//     const query = this.value;
//     const matches = players
//       .filter(p => matchesPlayer(p, query))
//       .slice(0, 15); // limit results

//     results.selectAll(".autocomplete-item").remove();

//   results
//     .selectAll(".autocomplete-item")
//     .data(matches)
//     .enter()
//     .append("div")
//     .attr("class", "autocomplete-item")
//     .text(d => d)
//     .on("click", function(event, d) {
//       input.property("value", d);
//       filters[side].player = d;
//       results.selectAll("*").remove();
//       recomputeFilters(side);
//     });
//   });

//   // hide on blur
//   input.on("blur", () => {
//     setTimeout(() => results.selectAll("*").remove(), 150);
//   });
// }




// --------------------------------------------------

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

async function update(selections, svg, tooltip){
  console.log(selections.season);
  const league_avg = await getLeagueRegionStats(selections.season);
  let data;
  if (selections.player == "All"){
    data = await getTeamRegionStats(selections.season, selections.team, selections.quarter);
  }
  else{
    data = await getPlayerRegionStats(selections.season, selections.player, selections.quarter);
  }
  const merged = mergeLeagueAndPlayer(league_avg, data);
  // Update colors.
  // console.log(merged);
  applyRegionData(merged, svg, tooltip);
}

// Functions!
const x = function x(ft){ // Function to convert a given ft into x coordinate, with the basket centered at 0.
  return ((ft+25)*width/50)
}
const y = function y(ft){// Function to convert a given ft into y coordinate.
  return ((ft*height/47)+100)
}
const three_pt_coords = function(p){ //Given an x or y coordinate of the 3pt line, gives the other one.
  return (Math.sqrt(23.75**2 - p**2))
}
const three_pt_angle = function(x,y){ // Given a point on the x y plane (0,0 at the basket), what is the angle in radians?
  return (Math.atan2(y,x))
}

//Drawing the regions/court. Only call this once, then change the fill colors using update().

const drawCourt = function(svg){

const g = svg.append('g')
  .style('fill', 'none')
  .style('stroke', '#000')
  .style('stroke-width', 50)

  // Paint
  g.append("rect")
    .attr("class", "region")  
    .attr("x", x(-8))
    .attr("y", y(-4))
    .attr("width", x(16)-x(0))
    .attr("height", y(15)-y(-4))
    .attr("data-region", "In the Paint (Non-RA)")
    // .attr('fill', colorScale(data.find(d => d.spot === "In the Paint (Non-RA)").diff))

      // Restricted area
  g.append("circle")
    .attr("class", "region")  
    .attr("cx", x(0))
    .attr("cy", y(0))
    .attr("r", x(3)-x(0))
    .attr("data-region", "Restricted Area")
    // .attr('fill', colorScale(data.find(d => d.spot === "Restricted Area").diff))

  // Left Mid-Range
  g.append("rect")
    .attr("class", "region")
    .attr("x", x(-21.5))
    .attr("y", y(-4))
    .attr("width", x(-8)-x(-21.5))
    .attr("height", y(10)-y(-4))
    .attr("data-region", "Left Mid-Range")
    // .attr('fill', colorScale(data.find(d => d.spot === "Left Mid-Range").diff))

  // Right Mid-Range
  g.append("rect")
    .attr("class", "region")
    .attr("x", x(8))
    .attr("y", y(-4))
    .attr("width", x(21.5)-x(8))
    .attr("height", y(10)-y(-4))
    .attr("data-region", "Right Mid-Range")
    // .attr('fill', colorScale(data.find(d => d.spot === "Right Mid-Range").diff))

  //Left Corner 3
  g.append("rect")
    .attr("class", "region")
    .attr("x", x(-25))
    .attr("y", y(-4))
    .attr("width", x(-21.5)-x(-25))
    .attr("height", y(10)-y(-4))
    .attr("data-region", "Left Corner 3")
    // .attr('fill', colorScale(data.find(d => d.spot === "Left Corner 3").diff))

  // Right Corner 3
  g.append("rect")
    .attr("class", "region")
    .attr("x", x(21.5))
    .attr("y", y(-4))
    .attr("width", x(25)-x(21.5))
    .attr("height", y(10)-y(-4))
    .attr("data-region", "Right Corner 3")
    // .attr('fill', colorScale(data.find(d => d.spot === "Right Corner 3").diff))

  // Backcourt
  g.append("rect")
    .attr("class", "region")
    .attr("x", x(-25))
    .attr("y", y(34))
    .attr("width", x(25)-x(-25))
    .attr("height", y(43)-y(34))
    .attr("data-region", "Backcourt")
    // .attr('fill', colorScale(data.find(d => d.spot === "Backcourt").diff))

  // Left Wing Mid-Range
  const left_wing = d3.path()
  left_wing.moveTo(x(-8), y(three_pt_coords(-8)));
  left_wing.arc(x(0), y(0), y(23.75)-y(0), three_pt_angle(-8, three_pt_coords(-8)), three_pt_angle(-21.5, 10));
  left_wing.lineTo(x(-8), y(10));
  left_wing.closePath();
    
  g.append("path")
    .attr("class", "region")
    .attr("d", left_wing.toString())
    .attr("stroke", "#000")
    .attr("data-region", "Left Wing Mid-Range")
    // .attr('fill', colorScale(data.find(d => d.spot === "Left Wing Mid-Range").diff))

  // Center Mid-Range
  const center = d3.path()
  center.moveTo(x(8), y(three_pt_coords(8)));
  center.arc(x(0), y(0), y(23.75)-y(0), three_pt_angle(8, three_pt_coords(8)), three_pt_angle(-8, three_pt_coords(-8)));
  center.lineTo(x(-8), y(15));
  center.lineTo(x(8), y(15));
  center.closePath();

  g.append("path")
    .attr("class", "region")
    .attr("d", center.toString())
    .attr("stroke", "#000")
    .attr("data-region", "Center Mid-Range")
    // .attr('fill', colorScale(data.find(d => d.spot === "Center Mid-Range").diff))

  // Right Wing Mid-Range
  const right_wing = d3.path()
  right_wing.moveTo(x(21.5), y(10));
  right_wing.arc(x(0), y(0), y(23.75)-y(0), three_pt_angle(21.5, 10), three_pt_angle(8, three_pt_coords(8)));
  right_wing.lineTo(x(8), y(10));
  right_wing.closePath();
    
  g.append("path")
    .attr("class", "region")
    .attr("d", right_wing.toString())
    .attr("stroke", "#000")
    .attr("data-region", "Right Wing Mid-Range")
    // .attr('fill', colorScale(data.find(d => d.spot === "Right Wing Mid-Range").diff))

  // Left Wing 3
  const left_wing_3 = d3.path()
  left_wing_3.moveTo(x(-8), y(three_pt_coords(-8)));
  left_wing_3.arc(x(0), y(0), y(23.75)-y(0), three_pt_angle(-8, three_pt_coords(-8)), three_pt_angle(-21.5, 10));
  left_wing_3.lineTo(x(-25), y(10));
  left_wing_3.lineTo(x(-25), y(34));
  left_wing_3.lineTo(x(-8), y(34));
  left_wing_3.closePath();
  g.append("path")
    .attr("class", "region")
    .attr("d", left_wing_3.toString())
    .attr("stroke", "#000")
    .attr("data-region", "Left Wing 3")
    // .attr('fill', colorScale(data.find(d => d.spot === "Left Wing 3").diff))

  // Right Wing 3
  const right_wing_3 = d3.path()
  right_wing_3.moveTo(x(8), y(34));
  right_wing_3.lineTo(x(25), y(34));
  right_wing_3.lineTo(x(25), y(10));
  right_wing_3.lineTo(x(21.5), y(10));
  right_wing_3.arc(x(0), y(0), y(23.75)-y(0), three_pt_angle(21.5,10), three_pt_angle(8, three_pt_coords(8)));
  right_wing_3.closePath();
  g.append("path")
    .attr("class", "region")
    .attr("d", right_wing_3.toString())
    .attr("stroke", "#000")
    .attr("data-region", "Right Wing 3")
    // .attr('fill', colorScale(data.find(d => d.spot === "Right Wing 3").diff))

  // Center 3
  const center_3 = d3.path()
  center_3.moveTo(x(8), y(three_pt_coords(8)));
  center_3.arc(x(0), y(0), y(23.75)-y(0), three_pt_angle(8,three_pt_coords(8)), three_pt_angle(-8, three_pt_coords(-8)));
  center_3.lineTo(x(-8), y(34));
  center_3.lineTo(x(8), y(34));
  center_3.closePath();
  g.append("path")
    .attr("class", "region")
    .attr("d", center_3.toString())
    .attr("stroke", "#000")
    .attr("data-region", "Above the Break 3")
    // .attr('fill', colorScale(data.find(d => d.spot === "Above the Break 3").diff))
}

// Documentation for legend!: https://d3-legend.susielu.com/#color-doc

const drawLegend = function(svg){
  const legendGroup = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${0}, ${50})`);

  const legend = d3.legendColor()
    .scale(colorScale)
    .orient("horizontal")
    .shapeWidth(60)                
    .shapeHeight(12)
    .cells(9)                    
    .labelFormat(d3.format("+.0%"))
    .title("FG% Difference \n from League Avg");
  // Render it
  legendGroup.call(legend);
}

var tooltipLeft = d3.select("#left_chart").select(".Tooltip")
var tooltipRight = d3.select("#right_chart").select(".Tooltip")

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

function createHashes(svg){
  const defs = svg.append("defs");

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
createHashes(svg_left);
createHashes(svg_right);

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

function applyRegionData(data, svg, tooltip) {
  svg.selectAll(".region").each(function() {
    
    const regionName = d3.select(this).attr("data-region");
    const row = data.find(d => d.region === regionName);
    // update fill
    d3.select(this).style("fill", checkNanColor(row))
    // d3.select(this).attr("fill", row ? colorScale(row.diff_pct) : "");
    // tooltips
    d3.select(this)
      .on("mouseover", mouseover(tooltip))
      .on("mousemove", (event) => {
        if (!row) return;

        tooltip
          .html(`
            <b>${regionName}</b><br>
            FGM/FGA: ${handleNanTooltip("makes", row)}/${handleNanTooltip("attempts", row)}<br>
            FG%: ${(handleNanTooltip("player_pct", row))}<br>
            League Avg: ${(row.league_pct * 100).toFixed(1)}%<br>
            Diff: ${(handleNanTooltip("diff_pct", row))}
          `)
          .style("left", 10)
          .style("top", this.screen);
      })
      .on("mouseleave", mouseleave(tooltip));
  });
}

function updatePlayerSubtitle(side, playerRow) {
  const sel = d3.select(`.${side}-player`);

  sel.select(".player-name")
    .text(playerRow ? playerRow.PLAYER_NAME : "League Average");

  sel.select(".player-headshot")
    .attr(
      "src",
      playerRow
        ? playerRow.image
        : "photos/nba-logo.jpg"
    );
}

drawCourt(svg_left);
drawCourt(svg_right);

var svgLegend = d3.select("#legend")
  .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)

drawLegend(svgLegend);

d3.select("#left-filter-button").on("click", function(event, d) {
  var selectedPlayer = d3.select("#left-player-input").property("value")
  var selectedTeam = d3.select("#left-team-select").property("value")
  var selectedQuarter = d3.select("#left-quarter-select").property("value")
  var selectedSeason = d3.select("#left-season-select").property("value")
  var selections = {
    season: selectedSeason,
    player: selectedPlayer,
    team: selectedTeam,
    quarter: selectedQuarter
  }
  update(selections, svg_left, tooltipLeft, "left");
})

d3.select("#right-filter-button").on("click", function(event, d) {
  var selectedPlayer = d3.select("#right-player-input").property("value")
  var selectedTeam = d3.select("#right-team-select").property("value")
  var selectedQuarter = d3.select("#right-quarter-select").property("value")
  var selectedSeason = d3.select("#right-season-select").property("value")
  var selections = {
    season: selectedSeason,
    player: selectedPlayer,
    team: selectedTeam,
    quarter: selectedQuarter
  }
  update(selections, svg_right, tooltipRight, "right");
})

// d3.select("#left-clear-button").on("click", function () {

//   // // 1. Reset internal state
//   // selectedPlayer_left = "All";
//   // selectedTeam_left = "All";

//   // 2. Reset dropdowns (options + selection)
//   updateSelect(
//     "#left-player-select",
//     getPlayersForTeam("All"),
//     "All"
//   );

//   updateSelect(
//     "#left-team-select",
//     getTeamsForPlayer("All"),
//     "All"
//   );

//   d3.select("#left-quarter-select")
//     .property("value", "All");
//   d3.select("#left-season-select")
//     .property("value", "All");
//   // 3. Clear the chart
//   d3.select("#left_svg")
//     .selectAll(".region")
//     .style("fill", "#FFFFFF")
//     .style("fill-opacity", 0.8);
//   updatePlayerSubtitle("left", null);
// });
function clearChart(svg){
  // 1. Force-hide tooltip
  hideTooltip(svg.select(".Tooltip"));

  // 2. Remove all region interaction handlers
    svg
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

d3.select("#left-clear-button").on("click", async () => {
  const btn = d3.select("#left-clear-btn");
  btn.property("disabled", true);

  for (let key in filters.left) filters.left[key] = "All";

  await recomputeFilters("left");
  clearChart(svg_left);
  btn.property("disabled", false);
  d3.select("#left-player-input").property("value", "Search player...");
  d3.select("#left-player-result").selectAll("*").remove();
});

d3.select("#right-clear-button").on("click", async () => {
  const btn = d3.select("#left-clear-btn");
  btn.property("disabled", true);

  for (let key in filters.left) filters.left[key] = "All";

  await recomputeFilters("left");
  clearChart(svg_right);
  btn.property("disabled", false);
  d3.select("#right-player-input").property("value", "Search player...");
  d3.select("#right-player-result").selectAll("*").remove();
});

const filters = {
  left: {
    season: "All",
    player: "All",
    team: "All",
    quarter: "All"
  },
  right: {
    season: "All",
    player: "All",
    team: "All",
    quarter: "All"
  }
};

let playerUniverse = {
  left: [],
  right: []
};

["left", "right"].forEach(side => {
  ["season", "player", "team", "quarter"].forEach(key => {
    registerFilter(side, key);
  });
});

(async function init() {
  await recomputeFilters("left");
  await recomputeFilters("right");
})();



