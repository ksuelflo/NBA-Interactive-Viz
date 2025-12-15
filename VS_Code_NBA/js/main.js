// Inport statements are in the HTML!

const shots = await d3.csv("../data/shots_by_region_12_14.csv", d => ({
  ...d,
  PLAYER_NAME: d.name.trim(),
  region: d.region.trim(),
  TEAM_NAME: d.team_name.trim(),
  period: d.period_number
}));

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
  // .append("g")
  //   .attr("transform",
  //         "translate(" + 230 + "," + margin + ")");

var svg_right = d3.select("#right_chart")
  .append("svg")
    .attr("id", "right_svg")
    .attr("width", width + margin)
    .attr("height", height + margin+100)
  // .append("g")
  //   .attr("transform",
  //         "translate(" + 230 + "," + margin + ")");

// Computing League averages
const average_fg_pct = function (data) {
  const entries = d3.rollups(
    data,
    v => d3.mean(v, d => d.scoring_play === "TRUE"),
    d => d.region
  );

  return Object.fromEntries(entries);
};


// Getting total FG attempts/ total FG makes.
const get_fgs = function (data, type) {
  const entries = d3.rollups(
    data,
    v => d3.sum(v, d => d[type] === "TRUE"),
    d => d.region
  );

  return Object.fromEntries(entries);
};

//Computes league avg (only need to run this once!)
const league_avg = average_fg_pct(shots)
console.log(league_avg);
// Color Scale
const colorScale = d3.scaleDiverging()
  .domain([-0.15, 0, 0.15])
  .interpolator(d3.interpolatePRGn)
  // .interpolator(t => d3.interpolateRdBu(1 - t))

// FILTERS

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
const quarters = Array.from(new Set(shots.map(d => d.PERIOD))).sort();
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

// Refresh chart when new selection is made
function update(selections, svg, tooltip, side) {
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

  const avg = average_fg_pct(filtered);
  const attempts = get_fgs(filtered, "shooting_play");
  const makes = get_fgs(filtered, "scoring_play");
  const diff_data = Object.keys(league_avg).map(region => ({
    spot: region,
    makes: makes[region],
    attempts: attempts[region],
    league_pct: league_avg[region],
    player_pct: avg[region],
    diff_pct: avg[region] - league_avg[region]
  }));
  // Update colors.
  console.log(diff_data);
  applyRegionData(diff_data, svg, tooltip);
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
    .attr("width", 6)
    .attr("height", 6)
    .attr("patternTransform", "rotate(45)")
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", 6)
    .attr("stroke", "#999")
    .attr("stroke-width", 2);
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
    const row = data.find(d => d.spot === regionName);
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
  update(selections, svg_left, tooltipLeft, "left");
})

d3.select("#right-filter-button").on("click", function(event, d) {
  var selectedPlayer = d3.select("#right-player-select").property("value")
  var selectedTeam = d3.select("#right-team-select").property("value")
  var selectedQuarter = d3.select("#right-quarter-select").property("value")
  var selectedSeason = d3.select("#right-season-select").property("value")
  var selections = [selectedPlayer, selectedQuarter, selectedTeam, selectedSeason];
  update(selections, svg_right, tooltipRight, "right");
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
  d3.select("#left_svg")
    .selectAll(".region")
    .style("fill", "#FFFFFF")
    .style("fill-opacity", 0.8);
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
  d3.select("#right_svg")
    .selectAll(".region")
    .style("fill", "#FFFFFF")
    .style("fill-opacity", 0.8);
  updatePlayerSubtitle("right", null);
});