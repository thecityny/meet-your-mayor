const {select} = require("d3-selection");
const {forceSimulation, forceX, forceY, forceCollide, forceManyBody} = require("d3-force");

const youSlug = "YOU";
const logoImg = new Image(100, 750);
logoImg.src = "assets/logo_url.png";

function forceBounds(width, height) {
  var nodes;

  function force() {
    for (i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const xExtent = width / 2 - node.r * 2;
      const yExtent = height / 2 - node.r * 2;
      
      node.x = Math.max(-xExtent, Math.min(xExtent, node.x));
      node.y = Math.max(-yExtent, Math.min(yExtent, node.y));
    }
  }

  force.initialize = function(_) {
    nodes = _;
  }

  return force;
}

module.exports = function (target, topic) {
  const activeColor = topic.color || "#999999";

  const width = 2320;
  const height = 1305;

  const canvas = select(target);
  const context = canvas.node().getContext("2d");

  canvas
    .attr("width", width)
    .attr("height", height);

  const simulation = forceSimulation()
    .velocityDecay(0.1)
    .force("x", forceX().strength(d => d.name === youSlug ? 0.1 : 0.01))
    .force("y", forceY().strength(d => d.name === youSlug ? 0.1 : 0.01));
  
  const collide = forceCollide().iterations(3);
  const refresh = () => simulation.alpha(1).restart();

  function join(candidates = []) {
    candidates.forEach(d => {
      d.r = d.name === youSlug ? 160 : 120;
    });
    simulation.nodes(candidates);

    function draw() {
      context.clearRect(0, 0, width, height);
      context.save();

      context.fillStyle = "#ebebeb";
      context.fillRect(0, 0, width, height);

      context.font = "900 110px 'Sharp Grotesk', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "#404040";
      context.fillText(`MEET YOUR MAYOR: My ${topic.label} Matches`, width / 2, 45);
      context.drawImage(logoImg, (width - 750) / 2, height - 125, 750, 100);

      context.fillStyle = "#ffffff";
      context.globalAlpha = 0.4;
      context.fillRect(50, 200, width - 100, height - 350);
      context.globalAlpha = 1;

      context.translate(width / 2, height / 2);
      context.font = "600 60px 'Sharp Grotesk', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      candidates.forEach((d) => {
        context.save();
        const r = d.r;
        const x = d.x;
        const y = d.y;
        
        context.beginPath();
        context.moveTo(x, y);

        context.arc(x, y, r, 0, 2 * Math.PI);
        context.fillStyle = d.name === youSlug ? activeColor : d.party === "D" ? "#C3CBDD" : d.party === "R" ? "#F6D5D8" : "#e6e6e6";
        context.fill();

        if (d.droppedOut) {
          context.globalAlpha = 0.3;
        }

        if (!d.image || d.name === youSlug) {
          context.fillStyle = d.name === youSlug ? "#ffffff" : "#404040";
          context.fillText(d.label, x, y);
        }

        if (d.image) {
          context.save();
          context.arc(x, y, r, 0, 2 * Math.PI);
          context.clip();
          context.drawImage(d.image, x - r, y - r, r * 2, r * 2);
          context.restore();
        } 

        context.restore();
      });
      context.restore();
    }

    simulation
      .force("collide", collide)
      .force("charge", forceManyBody().strength((d, i) => 0))
      .force("bounds", forceBounds(width - 80, height - 350))
      .on("tick", () => {
        collide.radius(d => d.r + 1);
        draw();
      });
    
    refresh();
  }

  return {
    join,
    refresh
  };
}