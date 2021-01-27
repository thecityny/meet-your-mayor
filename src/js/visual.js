const {select} = require("d3-selection");
const {forceSimulation, forceX, forceY, forceCollide, forceManyBody} = require("d3-force");
const {drag} = require("d3-drag");
// const {scaleLinear} = require("d3-scale");
// const {range} = require("d3-array");

module.exports = function (target) {
  var updateFunction;

  const canvas = select(document.createElement("canvas"))
    .attr("width", 0)
    .attr("height", 0);
  const context = canvas.node().getContext("2d");

  target.appendChild(canvas.node());

  const simulation = forceSimulation()
    .alphaTarget(0.3)
    .velocityDecay(0.1)
    .force("x", forceX().strength(0.01))
    .force("y", forceY().strength(0.01));

  function join(candidates) {
    simulation.nodes(candidates);

    function update() {
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      // const radius = (width / candidates.length) / 2;
      const radius = 20;

      const dragHandler = drag()
        .subject(e => {
          const x = e.x - width / 2;
          const y = e.y - height / 2;

          return simulation.find(x, y, radius);
        })
        .on("drag", e => {
          const xExtent = width / 2 - radius;
          const yExtent = height / 2 - radius;
          
          e.subject.fx = Math.max(-xExtent, Math.min(xExtent, e.x));
          e.subject.fy = Math.max(-yExtent, Math.min(yExtent, e.y));
        })
        .on("end", e => {
          e.subject.fx = null;
          e.subject.fy = null;
        });

      function draw() {
        context.clearRect(0, 0, width, height);
        context.save();
        context.translate(width / 2, height / 2);
        candidates.forEach((d) => {
          const r = radius;
          const x = d.x;
          const y = d.y;
          
          context.beginPath();
          context.moveTo(x, y);
          context.arc(x, y, r, 0, 2 * Math.PI);
          context.fillStyle = "#000";
          context.fill();
        });
        context.restore();
      }

      canvas
        .attr("width", width)
        .attr("height", height)
        .call(dragHandler);

      simulation
        .force("collide", forceCollide().radius(d => radius + 1).iterations(3))
        .force("charge", forceManyBody().strength((d, i) => 0))
        .on("tick", draw);
    }

    window.removeEventListener("resize", updateFunction);
    updateFunction = update;
    window.addEventListener("resize", updateFunction);
    updateFunction();
  }

  return join;
}