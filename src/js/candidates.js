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

const candidateSlug = document.body.getAttribute("data-slug");

async function getFeed() {
  const parser = new DOMParser();
  const response = await fetch(`https://www.thecity.nyc/rss/${candidateSlug}/index.xml`);

  if (response.status === 200) {
    const feed = await response.text();

    const dom = parser.parseFromString(feed, "text/xml");
    const entries = dom.querySelectorAll("entry");
  
    return Array.from(entries).map(entry => ({
      updated: entry.querySelector("updated").innerHTML,
      url: entry.querySelector("link").getAttribute("href"),
      title: entry.querySelector("title").innerHTML
    }));
  } else {
    return [];
  }
}

async function main() {
  const coverageTarget = document.querySelector("#coverage");
  const links = await getFeed();

  if (links.length) {
    const linkMarkup = links.slice(0, 3).map(link => {
      const date = new Date(link.updated);
      const dateString = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });

      return `<li><a href="${link.url}">${link.title}</a><time datatime="%{link.updated}">${dateString}</time></li>`;
    }).join("");

    coverageTarget.innerHTML = `<h3 class="sidebar-header">Coverage</h3><ul>${linkMarkup}</ul><div class="more-link"><a href="https://thecity.nyc/${candidateSlug}">Read more</a></div>`;
    coverageTarget.classList.remove("loading");
  } else {
    coverageTarget.classList.remove("loading");
    coverageTarget.classList.add("empty");
    coverageTarget.innerHTML = "";
  }
}

main();

