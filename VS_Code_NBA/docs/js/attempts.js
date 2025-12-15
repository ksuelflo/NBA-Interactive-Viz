// Inport statements are in the HTML!
import { density2d } from "https://esm.sh/fast-kde@latest";
// import {drawCourt} from "./main.js";

const shots = await d3.csv("./data/shots_by_region_12_15.csv", d => ({
  ...d,
  PLAYER_NAME: d.name.trim(),
  region: d.region.trim(),
  TEAM_NAME: d.team_name.trim(),
  period: d.period_number
}));

//Useful constants
const width = 425;
const height = width*51/50;
const bandwidth = 2
const legendWidth = 800;
const legendHeight = 150;
const bins_left = 50
const bins_right = 47

//Initializing svg
var svg_left = d3.select("#left_chart")
  .append("svg")
    .attr("id", "left_svg_attempts")
    .attr("width", width)
    .attr("height", height)

var svg_right = d3.select("#right_chart")
  .append("svg")
    .attr("id", "right_svg_attempts")
    .attr("width", width)
    .attr("height", height)

// Making x and y coords numeric, and calculating league average KDE (AKA using ALL shots).
// Also doing all the density calculations that will NEVER CHANGE
const shots_xy = shots.map(d => [+d.LOC_X, +d.LOC_Y]);
const density_league = density2d(shots_xy, {
  bandwidth: bandwidth,
  bins: [bins_left, bins_right],
  // extent: [[-250, 250], [-40,470]]
  extent: [[-25, 25], [-5,41.5]]
});
const points_league = Array.from(density_league.points());

const leagueByKey = new Map(
  points_league.map(d => [`${d.x}-${d.y}`, d.z])
);
const xScale = d3.scaleLinear()
  .domain(density_league.extent()[0])    
  .range([0, width]);

const yScale = d3.scaleLinear()
  .domain(density_league.extent()[1])     
  .range([0, height]);        

const rectWidth = (width  / bins_left);
const rectHeight = (height / bins_right);

function drawRectangles(svg, density_data){
  const rects = svg
    .selectAll(".rectangle")
    .data(density_data, d => `${d.x}-${d.y}`);

  rects.enter()
    .append("rect")
    .attr("class", "rectangle")
    .attr("x", d => xScale(d.x))
    .attr("y", d => yScale(d.y))
    .attr("width", rectWidth)
    .attr("height", rectHeight)
    .attr("fill", "none");

  svg.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "none")
  .attr("stroke", "white")
  .attr("stroke-width", 5);
}

const three_pt_angle = function(frac){ // Given a point on the x y plane (0,0 at the basket), what is the angle in radians?
  return (Math.asin(frac))
}

function drawCourt(svg){

  // Paint
  svg.append("rect")
    .attr("class", "court")
    .attr("x", xScale(-8))
    .attr("y", yScale(-5))
    .attr("width", xScale(16)-xScale(0))
    .attr("height", yScale(14)-yScale(-5))

  // Restricted area
  const restricted_area_path = d3.path();
  restricted_area_path.moveTo(xScale(3), yScale(0));
  restricted_area_path.arc(xScale(0), yScale(0), xScale(3)-xScale(0), 0, Math.PI);
  svg.append("path")
      .attr("class", "court")
      .attr("d", restricted_area_path.toString())
      .attr("stroke", "white")

  // Basket
  svg.append("circle")
    .attr("class", "court")  
    .attr("cx", xScale(0))
    .attr("cy", yScale(0))
    .attr("r", xScale(.75)-xScale(0))

  // Backboard
  svg.append("line")
    .attr("class", "court")
    .attr("x1", xScale(-3))
    .attr("y1", yScale(-1.25))
    .attr("x2", xScale(3))
    .attr("y2", yScale(-1.25))

  // Left-Corner 3pt line
  svg.append("line")
    .attr("class", "court")
    .attr("x1", xScale(-22))
    .attr("y1", yScale(-5))
    .attr("x2", xScale(-22))
    .attr("y2", yScale(8.5)) // subtracting 12.5 because we cut off 1 and a quarter ft of behind the basket.

  // Right-Corner 3pt line
  svg.append("line")
    .attr("class", "court")
    .attr("x1", xScale(22))
    .attr("y1", yScale(-5)) 
    .attr("x2", xScale(22))
    .attr("y2", yScale(8.5)) // subtracting 12.5 because we cut off 1 and a quarter ft of behind the basket.

  // 3Pt Arc
  const Three_pt_line = d3.path();
  Three_pt_line.moveTo(xScale(22), yScale(8.5));
  Three_pt_line.arc(xScale(0), yScale(0), xScale(23.75)-xScale(0), three_pt_angle(9/23.75), Math.PI - three_pt_angle(9/23.75));
  svg.append("path")
      .attr("class", "court")
      .attr("d", Three_pt_line.toString())
      .attr("stroke", "white")
}
//FILTER STUFF

//Filter Logic
let selectedPlayer_left = "All";
let selectedTeam_left = "All";
let selectedPlayer_right = "All";
let selectedTeam_right = "All";

function getTeamsForPlayer(player) {
  if (player === "All") {
    return Array.from(new Set(shots.map(d => d.TEAM_NAME))).sort();
  }

  return Array.from(
    new Set(
      shots
        .filter(d => d.PLAYER_NAME === player)
        .map(d => d.TEAM_NAME)
    )
  ).sort();
}

function getPlayersForTeam(team) {
  if (team === "All") {
    return Array.from(new Set(shots.map(d => d.PLAYER_NAME))).sort();
  }

  return Array.from(
    new Set(
      shots
        .filter(d => d.TEAM_NAME === team)
        .map(d => d.PLAYER_NAME)
    )
  ).sort();
}

function updateSelect(selectId, values, selectedValue) {
  const select = d3.select(selectId);

  values = ["All", ...values];

  const options = select
    .selectAll("option")
    .data(values, d => d);

  options.exit().remove();

  options
    .enter()
    .append("option")
    .merge(options)
    .attr("value", d => d)
    .text(d => d)
    .property("selected", d => d === selectedValue);
}


// Player filter
const players = Array.from(new Set(shots.map(d => d.PLAYER_NAME))).sort();
players.unshift("All");
const player_select_left = d3.select("#left-player-select")
  .selectAll('myOptions')
     	.data(players)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

const player_select_right = d3.select("#right-player-select")
  .selectAll('myOptions')
     	.data(players)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

// Team filter
const teams = Array.from(new Set(shots.map(d => d.TEAM_NAME))).sort();
teams.unshift("All");
const team_select_left = d3.select("#left-team-select")
  .selectAll('myOptions')
     	.data(teams)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

const team_select_right = d3.select("#right-team-select")
  .selectAll('myOptions')
     	.data(teams)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

// Opposing Team filter
//....

// Quarter filter
const quarters = Array.from(new Set(shots.map(d => d.period))).sort();
quarters.unshift("All");
const quarter_select_left = d3.select("#left-quarter-select")
  .selectAll('myOptions')
     	.data(quarters)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

const quarter_select_right = d3.select("#right-quarter-select")
  .selectAll('myOptions')
     	.data(quarters)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

// Season filter
const seasons = Array.from(new Set(shots.map(d => d.season))).sort();
seasons.unshift("All");
const season_select_left = d3.select("#left-season-select")
  .selectAll('myOptions')
     	.data(seasons)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

const season_select_right = d3.select("#right-season-select")
  .selectAll('myOptions')
     	.data(seasons)
      .enter()
    	.append('option')
      .text(function (d) { return d; }) // text showed in the menu
      .attr("value", function (d) { return d; })

updateSelect(
  "#left-team-select",
  getTeamsForPlayer("All"),
  "All"
);

updateSelect(
  "#left-player-select",
  getPlayersForTeam("All"),
  "All"
);

updateSelect(
  "#right-team-select",
  getTeamsForPlayer("All"),
  "All"
);

updateSelect(
  "#right-player-select",
  getPlayersForTeam("All"),
  "All"
);

function handleFilters(filters) {
  let filtered = shots;

  if (filters[0] !== "All") {
    filtered = filtered.filter(d => d.PLAYER_NAME === filters[0]);
  }

  if (filters[1] !== "All") {
    filtered = filtered.filter(d => d.period === filters[1]);
  }

  if (filters[2] !== "All") {
    filtered = filtered.filter(d => d.TEAM_NAME === filters[2]);
  }

  if (filters[3] !== "All") {
    filtered = filtered.filter(d => d.season === filters[3]);
  }

  return filtered;
}

drawRectangles(svg_left, points_league);
drawRectangles(svg_right, points_league);
drawCourt(svg_left);
drawCourt(svg_right);

const maxLeague = d3.max(points_league, d => d.z);
const ε = maxLeague * 1e-6;

function compute_diff(player_density){
  const diffData = player_density.map(d => {
    const key = `${d.x}-${d.y}`;
    const leagueZ = leagueByKey.get(key) ?? 0;

  return {
    x: d.x,
    y: d.y,
    playerZ: d.z,
    leagueZ: leagueZ,
    diff: Math.log((d.z + ε) / (leagueZ + ε))
  };
});
  return (diffData);
}

function update(selections, svg, side) {
  const filtered = handleFilters(selections);

const sel = d3.select(`.${side}-player`);

  sel.select(".player-name")
    .text(
      filtered && filtered.length
        ? filtered[0].PLAYER_NAME
        : "League Average"
    );

      sel.select(".player-headshot")
    .attr(
      "src",
      filtered && filtered.length
        ? filtered[0].image
        : "photos/nba-logo.jpg"
    );

  if (selections[0] == "All"){
    if (selections[2] != "All"){
        sel.select(".player-name")
          .text(
            filtered && filtered.length
              ? filtered[0].TEAM_NAME
              : "League Average"
          );
        sel.select(".player-headshot")
          .attr("src", "photos/nba-logo.jpg")
    }
    else {
      sel.select(".player-name").text("League Average")
      sel.select(".player-headshot").attr("src", "photos/nba-logo.jpg")
      console.log("Set league avg")
    }
  }

  const shots_xy = filtered.map(d => [+d.LOC_X, +d.LOC_Y]);
  const density_filtered = density2d(shots_xy, {
  bandwidth: bandwidth,
  bins: [bins_left, bins_right],
  // extent: [[-250, 250], [-40, 470]]
  extent: [[-25, 25], [-5, 41.5]]
  });
  const array_density = Array.from(density_filtered.points());
  const filtered_map = compute_diff(array_density);
  // Update colors.
  applyRegionData(filtered_map, svg);
}
// const colorScale = d3.scaleDiverging()
//   .domain([-Math.log(4), 0, Math.log(4)])
//   .interpolator(d3.interpolateRdYlGn)

// Flatten all league density values
const leagueZ = points_league.map(d => d.z);

// Sort once
leagueZ.sort(d3.ascending);

// Robust max
const leagueMaxRobust = d3.quantile(leagueZ, 0.97);

const colorScale = d3.scaleSequential()
  .domain([0, leagueMaxRobust])
  .interpolator(d3.interpolatePlasma)

const drawLegend = function(svg){
  const labels = Array(9).fill("");
  labels[0] = "Lower";
  labels[labels.length - 1] = "Higher";

  const legendGroup = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${0}, ${50})`);

  const legend = d3.legendColor()
    .scale(colorScale)
    .orient("horizontal")
    .shapeWidth(60)                
    .shapeHeight(12)
    .cells(9)                    
    .labels(labels)
    .title("Shot Frequency");
  // Render it
  legendGroup.call(legend);
}

var svgLegend = d3.select("#legend")
  .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight)

drawLegend(svgLegend);

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

function applyRegionData(density, svg) {
  svg.selectAll(".rectangle")
  .data(density, d => `${d.x}-${d.y}`)
  .transition()
  .duration(750)
  .ease(d3.easeCubicInOut)
  .attr("opacity", 1)
  .attr("fill", d => colorScale(d.playerZ));
  // .attr("fill", d => colorScale(d.diff));
}

d3.select("#left-player-select")
  .on("change", function () {
    selectedPlayer_left = this.value;

    const validTeams = getTeamsForPlayer(selectedPlayer_left);

    // AUTO-SELECT if only one valid team
    if (validTeams.length === 1) {
      selectedTeam_left = validTeams[0];
    } else if (!validTeams.includes(selectedTeam_left)) {
      selectedTeam_left = "All";
    }

    updateSelect(
      "#left-team-select",
      validTeams,
      selectedTeam_left
    );
  });

d3.select("#left-team-select")
  .on("change", function () {
    selectedTeam_left = this.value;

    const validPlayers = getPlayersForTeam(selectedTeam_left);

    if (selectedPlayer_left !== "All" && !validPlayers.includes(selectedPlayer_left)) {
      selectedPlayer_left = "All";
    }

    updateSelect(
      "#left-player-select",
      validPlayers,
      selectedPlayer_left
    );

  });

  d3.select("#right-player-select")
  .on("change", function () {
    selectedPlayer_right = this.value;

    const validTeams = getTeamsForPlayer(selectedPlayer_right);

    // AUTO-SELECT if only one valid team
    if (validTeams.length === 1) {
      selectedTeam_right = validTeams[0];
    } else if (!validTeams.includes(selectedTeam_right)) {
      selectedTeam_right = "All";
    }

    updateSelect(
      "#right-team-select",
      validTeams,
      selectedTeam_right
    );
  });

d3.select("#right-team-select")
  .on("change", function () {
    selectedTeam_right = this.value;

    const validPlayers = getPlayersForTeam(selectedTeam_right);

    if (selectedPlayer_right !== "All" && !validPlayers.includes(selectedPlayer_right)) {
      selectedPlayer_right = "All";
    }

    updateSelect(
      "#right-player-select",
      validPlayers,
      selectedPlayer_right
    );

  });


d3.select("#left-filter-button").on("click", function(event, d) {
  var selectedPlayer = d3.select("#left-player-select").property("value")
  var selectedTeam = d3.select("#left-team-select").property("value")
  var selectedQuarter = d3.select("#left-quarter-select").property("value")
  var selectedSeason = d3.select("#left-season-select").property("value")
  var selections = [selectedPlayer, selectedQuarter, selectedTeam, selectedSeason];
  update(selections, svg_left, "left");
})

d3.select("#right-filter-button").on("click", function(event, d) {
  var selectedPlayer = d3.select("#right-player-select").property("value")
  var selectedTeam = d3.select("#right-team-select").property("value")
  var selectedQuarter = d3.select("#right-quarter-select").property("value")
  var selectedSeason = d3.select("#right-season-select").property("value")
  var selections = [selectedPlayer, selectedQuarter, selectedTeam, selectedSeason];
  update(selections, svg_right, "right");
})

d3.select("#left-clear-button").on("click", function () {

  // 1. Reset internal state
  selectedPlayer_left = "All";
  selectedTeam_left = "All";

  // 2. Reset dropdowns (options + selection)
  updateSelect(
    "#left-player-select",
    getPlayersForTeam("All"),
    "All"
  );

  updateSelect(
    "#left-team-select",
    getTeamsForPlayer("All"),
    "All"
  );

  d3.select("#left-quarter-select")
    .property("value", "All");
  d3.select("#left-season-select")
    .property("value", "All");

  // 3. Clear the chart
  d3.select("#left_svg_attempts")
    .selectAll(".rectangle")
    .attr("fill", "none")

  updatePlayerSubtitle("left", null);
});


d3.select("#right-clear-button").on("click", function () {

  // 1. Reset internal state
  selectedPlayer_right = "All";
  selectedTeam_right = "All";

  // 2. Reset dropdowns (options + selection)
  updateSelect(
    "#right-player-select",
    getPlayersForTeam("All"),
    "All"
  );

  updateSelect(
    "#right-team-select",
    getTeamsForPlayer("All"),
    "All"
  );

  d3.select("#right-quarter-select")
    .property("value", "All");
  d3.select("#right-season-select")
    .property("value", "All");

  // 3. Clear the chart
  d3.select("#right_svg_attempts")
    .selectAll(".rectangle")
    .attr("fill", "none")

  updatePlayerSubtitle("right", null);
});
