// var x = d3.scaleLinear()
//     .domain([-250, 250])
//     .range([ 0, width ]);

// var y = d3.scaleLinear()
//     .domain([-42, 650])
//     .range([ height, 0]);

// var color = d3.scaleOrdinal()
//     .domain(["0", "1"])
//     .range([ "#FF0000", "#00FF00"])

// svg.append('g')
//     .selectAll("dot")
//     .data(wemby_data)
//     .enter()
//     .append("circle")
//       .attr("cx", function (d) { return x(d.LOC_X); } )
//       .attr("cy", function (d) { return y(d.LOC_Y); } )
//       .attr("r", 3)
//       .style("fill", function (d) {return color(d.SHOT_MADE_FLAG)})

const g = svg.append('g')
// .attr('transform', `translate(${[margins,margins]})`)
.style('fill', 'none')
.style('stroke', '#000')

const basket = y(4);
const basketRadius = y(4.75) - basket;

// basket
g.append('circle')
  .attr('r', basketRadius)
  .attr('cx', x(0))
  .attr('cy', y(4.75))

// backboard
g.append('rect')
  .attr('x', x(-3))
  .attr('y', basket)
  .attr('width', x(3) - x(-3))
  .attr('height', 1)

// outer paint
g.append('rect')
  .attr('x', x(-8))
  .attr('y', y(0))
  .attr('width', x(8) - x(-8))
  .attr('height', y(15) + basket)

// inner paint
g.append('rect')
  .attr('x', x(-6))
  .attr('y', y(0))
  .attr('width', x(6) - x(-6))
  .attr('height', y(15) + basket)

// restricted area
const restricted_area = d3.arc()
  .outerRadius(0)
  .innerRadius(0)
  .startAngle(-Math.PI / 2)
  .endAngle(Math.PI / 2);
// console.log(x(3) - x(0));
// console.log(y(3) - y(0));