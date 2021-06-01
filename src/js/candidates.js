attachExpandHandlers(document);
const track = require("./lib/tracking");

// Show/hide logic
function attachExpandHandlers(target) {
  const containers = Array.from(target.querySelectorAll(".expandable"));
  const expandedClass = "expanded";
  const collapsedClass = "collapsed";

  containers.forEach(container => {
    var expanded = false;
    const value = container.getAttribute("data-value");
    const link = container.querySelector(".expandable-link");
    const body = container.querySelector(".expandable-body");

    link && body && link.addEventListener("click", async e => {
      e.preventDefault();
      if (expanded) {
        track("click:collapse", value);
        // await readMore.collapse(body);
        container.classList.remove(expandedClass);
        container.classList.add(collapsedClass);
      } else {
        track("click:expand", value);
        container.classList.remove(collapsedClass);
        container.classList.add(expandedClass);
        // await readMore.expand(body);
      }

      expanded = !expanded;
    });
  });
}