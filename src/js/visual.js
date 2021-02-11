const {select, pointer} = require("d3-selection");
const {forceSimulation, forceX, forceY, forceCollide, forceManyBody} = require("d3-force");
const {drag} = require("d3-drag");
const {easeQuadIn} = require("d3-ease");

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

function forceGrowth() {
  var nodes;
  const ticks = 10;
  const easeFunction = easeQuadIn;

  function force() {
    for (i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];

      if (node._timer <= ticks) {
        const growth = easeFunction(node._timer / ticks);        
        node.r = growth * (node.maxRadius || 0);
        node._timer += 1;
      }
    }
  }

  force.initialize = function(_) {
    nodes = _;
    nodes.forEach(node => {
      node._timer = node._timer || 0;
    });
  }

  return force;
}

module.exports = function (target, tooltip) {
  var updateFunction;

  const canvas = select(document.createElement("canvas"))
    .attr("width", 0)
    .attr("height", 0);
  const context = canvas.node().getContext("2d");

  target.appendChild(canvas.node());

  const simulation = forceSimulation()
    .velocityDecay(0.1)
    .force("x", forceX().strength(d => d.name === "YOU" ? 0.1 : 0.01))
    .force("y", forceY().strength(d => d.name === "YOU" ? 0.1 : 0.01))
    .force("growth", forceGrowth());
  
  const collide = forceCollide().iterations(3);
  const refresh = () => simulation.alpha(1).restart();

  function join(candidates = []) {
    simulation.nodes(candidates);

    function update() {
      const width = target.offsetWidth;
      const height = target.offsetHeight;

      function findNode(pointerX, pointerY) {
        const x = pointerX - width / 2;
        const y = pointerY - height / 2;

        for (i = candidates.length - 1; i >= 0; --i) {
          const node = candidates[i];
          const r = node.r;
          const dx = x - node.x;
          const dy = y - node.y;
    
          if (dx * dx + dy * dy < r * r) {
            return node;
          }
        }
      }

      const dragHandler = drag()
        .subject(e => {
          return findNode(e.x, e.y);
        })
        .on("start", e => {
          tooltip.hide();
        })
        .on("drag", e => {
          const xExtent = width / 2 - e.subject.r;
          const yExtent = height / 2 - e.subject.r;
          
          e.subject.fx = Math.max(-xExtent, Math.min(xExtent, e.x));
          e.subject.fy = Math.max(-yExtent, Math.min(yExtent, e.y));
          refresh();
        })
        .on("end", e => {
          e.subject.fx = null;
          e.subject.fy = null;
        });
      
      const mouseoverHandler = e => {
        const [x, y] = pointer(e);
        const node = findNode(x, y);

        if (node) {
          tooltip.show();
          tooltip.setPosition(e.pageX, e.pageY);
          tooltip.setHTML(`<p>${node.name}<p>`);
        } else {
          tooltip.hide();
        }
      }

      const mouseleaveHandler = e => {
        tooltip.hide();
      }

      function draw() {
        context.clearRect(0, 0, width, height);
        context.save();
        context.translate(width / 2, height / 2);

        context.font = "600 20px 'Sharp Grotesk', sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        candidates.forEach((d) => {
          const r = d.r;
          const x = d.x;
          const y = d.y;
          
          context.beginPath();
          context.moveTo(x, y);

          if (d.image) {
            context.save();
            context.arc(x, y, r, 0, 2 * Math.PI);
            context.clip();
            context.drawImage(d.image, x - r, y - r, r * 2, r * 2);
            context.restore();
          } else {
            context.arc(x, y, r, 0, 2 * Math.PI);
            context.fillStyle = d.name === "YOU" ? "#A9328A" : "#666";
            context.fill();
            if (r === d.maxRadius) {
              context.fillStyle = "#fff";
              context.fillText(d.label, x, y);
            }
          }
        });
        context.restore();
      }

      canvas
        .attr("width", width)
        .attr("height", height)
        .on("mousemove", mouseoverHandler)
        .on("mouseleave", mouseleaveHandler)
        .call(dragHandler)
        // Undoes default d3-drag behavior 
        .style("touch-action", "auto");

      simulation
        .force("collide", collide)
        .force("charge", forceManyBody().strength((d, i) => 0))
        .force("bounds", forceBounds(width, height))
        .on("tick", () => {
          collide.radius(d => d.r + 1);
          draw();
        });
      
      refresh();
    }

    window.removeEventListener("resize", updateFunction);
    updateFunction = update;
    window.addEventListener("resize", updateFunction);
    updateFunction();
  }

  return join;
}