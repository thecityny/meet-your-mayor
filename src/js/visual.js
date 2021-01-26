const {select} = require("d3-selection");
// const {scaleLinear} = require("d3-scale");
// const {range} = require("d3-array");

module.exports = function (target) {
  var updateFunction;

  const canvas = select(document.createElement("canvas"))
    .attr("width", 0)
    .attr("height", 0);
  const context = canvas.node().getContext("2d");

  target.appendChild(canvas.node());

  function join(candidates) {
    function update() {
      const width = target.offsetWidth;
      const height = target.offsetHeight;

      canvas
        .attr("width", width)
        .attr("height", height);

      context.clearRect(0, 0, width, height);
      context.save();
      candidates.forEach((_, i) => {
        // const r = (width / candidates.length) / 2;
        const r = 10;
        const x = i * r * 2 + r;
        const y = height / 2;
        
        context.beginPath();
        context.moveTo(x, y);
        context.arc(x, y, r, 0, 2 * Math.PI);
        context.fillStyle = "#000";
        context.fill();
      });
      context.restore();
    }

    window.removeEventListener("resize", updateFunction);
    updateFunction = update;
    window.addEventListener("resize", updateFunction);
    updateFunction();
  }

  return join;
}