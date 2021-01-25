const {select, namespaces} = require("d3-selection");
// const {scaleLinear} = require("d3-scale");
// const {range} = require("d3-array");

module.exports = function (target) {
  var updateFunction;

  const svg = select(document.createElementNS(namespaces.svg, "svg"))
    .attr("width", 0)
    .attr("height", 0);

  const circleParent = svg.append("g");

  target.appendChild(svg.node());

  function join(candidates) {
    const circles = circleParent.selectAll("circle")
      .data(candidates)
      .join("circle");

    function update() {
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      // const circleRadius = (width / candidates.length) / 2;
      circleRadius = 10;

      svg
        .attr("width", width)
        .attr("height", height);

      circles
        .attr("cx", (d, i) => i * circleRadius * 2 + circleRadius)
        .attr("cy", height / 2)
        .attr("r", circleRadius);
    }

    window.removeEventListener("resize", updateFunction);
    updateFunction = update;
    window.addEventListener("resize", updateFunction);
    updateFunction();
  }

  return join;
}