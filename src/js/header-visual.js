const {select} = require("d3-selection");
const {forceSimulation} = require("d3-force");
const forceSurface = require("d3-force-surface");
const forceBounce = require("d3-force-bounce");

module.exports = function (target) {
  var updateFunction;

  const canvas = select(document.createElement("canvas"))
    .attr("width", 0)
    .attr("height", 0);
  const context = canvas.node().getContext("2d");

  target.appendChild(canvas.node());

  const simulation = forceSimulation()
    .alphaDecay(0)
    .velocityDecay(0);
  
  const refresh = () => simulation.alpha(1).restart();

  function join(candidates = []) {
    simulation.nodes(candidates);

    function update() {
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      const bounds = {
        left: - width / 2,
        right: width / 2,
        top: - height / 2,
        bottom: height / 2
      };

      function draw() {
        context.clearRect(0, 0, width, height);
        context.save();
        context.translate(width / 2, height / 2);

        candidates.forEach((d) => {
          context.save();
          const r = d.r;
          const x = d.x;
          const y = d.y;

          context.beginPath();
          context.moveTo(x, y);

          context.arc(x, y, r, 0, 2 * Math.PI);
          context.globalAlpha = 0.5;
          context.fillStyle = d.color || "#C3CBDD";
          context.fill();

          context.restore();
        });
        context.restore();
      }

      canvas
        .attr("width", width)
        .attr("height", height);

      simulation
        .force("surface", forceSurface()
          .surfaces([
            {from: {x:bounds.left,y:bounds.top}, to: {x:bounds.left,y:bounds.bottom}},
            {from: {x:bounds.left,y:bounds.bottom}, to: {x:bounds.right,y:bounds.bottom}},
            {from: {x:bounds.right,y:bounds.bottom}, to: {x:bounds.right,y:bounds.top}},
            {from: {x:bounds.right,y:bounds.top}, to: {x:bounds.left,y:bounds.top}}
          ])
          .oneWay(true)
          .radius(d => d.r)
          .elasticity(1)
        )
        .force('bounce', forceBounce()
          .radius(d => d.r / 2)
          .elasticity(1)
          .mass(2)
        )
        .on("tick", () => {
          draw();
        });
      
      refresh();
    }

    window.removeEventListener("resize", updateFunction);
    updateFunction = update;
    window.addEventListener("resize", updateFunction);
    updateFunction();
  }

  return {
    join,
    refresh
  };
}