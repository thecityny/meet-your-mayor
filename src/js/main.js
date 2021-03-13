const {rollup, max} = require("d3-array");
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const readMore = require("./read-more.js");

const visual = require("./visual");
const tooltip = require("./tooltip.js");

const candidates = require("../../data/candidateData.json");
const positions = require("../../data/positionData.json");
const questionData = require("../../data/questionData.json");
const answerData = require("../../data/answerData.json");

const topic = "criminal-justice";
const questionText = questionData[topic];
const questionAnswerText = answerData[topic];

const questions = Array.from(document.querySelectorAll(".question"));
const questionSlugs = questions.map(question => question.getAttribute("data-slug"));
const results = document.querySelector("#results");
const resultsContainer = document.querySelector("#results-container");
const resultsChartTarget = document.querySelector("#results-chart");
const resultsChart = visual(resultsChartTarget, tooltip);
const selected = {};

const candidatePositionsMap = new Map();
Object.entries(positions[topic]).forEach(([questionSlug, answers]) => {
  Object.entries(answers).forEach(([answerSlug, candidates]) => {
    candidates.forEach(({slug}) => {
      const position = candidatePositionsMap.get(slug) || {};
      candidatePositionsMap.set(slug, {
        ...position,
        [questionSlug]: answerSlug
      });
    });
  })
});
const candidatePositions = Object.fromEntries(Array.from(candidatePositionsMap));

function main() {
  // Set up each question
  questions.forEach(question => {
    const gridView = "grid";
    var view = gridView;
  
    const answer = question.querySelector(".answer");
    const responseContainer = question.querySelector(".responses");
    const responses = responseContainer.querySelectorAll(".response");
    const chartTarget = question.querySelector(".chart");
  
    const viewButtons = question.querySelectorAll(".responses-button-group button");
  
    const questionSlug = question.getAttribute("data-slug");
    const buttons = Array.from(question.querySelectorAll("form button"));
    const chart = visual(chartTarget, tooltip);
    
    const you = {name: "YOU", label: "YOU", maxRadius: 45};
    const questionPositions = positions[topic][questionSlug];
    const answerPositions = Object.fromEntries(Object.entries(questionPositions).map(([key, answer]) => {
      return [key, answer.map(candidate => {
        const node = {
          ...candidates[candidate.slug],
          ...candidate,
          maxRadius: 30
        };
  
        if (node.image) {
          const image = new Image(100, 100);
          image.src = `assets/images/${node.image}`;
          node.image = image;
        }
  
        return node;
      })];
    }));
  
    Array.from(viewButtons).forEach(button => {
      button.addEventListener("click", e => {
        view = e.target.value;
  
        if (view === gridView) {
          responseContainer.classList.add(gridView);
        } else {
          responseContainer.classList.remove(gridView);
          tooltip.hide();
        }
  
        Array.from(viewButtons).forEach(button => {
          if (button.value === view) {
            button.classList.add("active");
          } else {
            button.classList.remove("active");
          }
        });
      });
    });
  
    attachExpandHandlers(question);
  
    // Add input listeners
    buttons.forEach(button => {
      button.addEventListener("click", e => {
        e.preventDefault();
  
        const slug = e.target.value;
        if (questionPositions[slug]) {
          selected[questionSlug] = questionPositions[slug].map(d => d.slug);
        } else {
          selected[questionSlug] = [];
        }
        getMatches(selected);
  
        buttons.forEach(button => {
          if (button.value === slug) {
            button.classList.add("active");
          } else {
            button.classList.remove("active");
          }
        });
  
        const data = answerPositions[slug] || [];
        answer.classList.add("active");
        
        if (data.length > 0) {
          chartTarget.classList.remove("chart-empty");
          chart([...data, you].map(node => ({...node, radius: 0})));
        } else {
          chartTarget.classList.add("chart-empty");
        }
      });
    });
  
    Array.from(responses).forEach(response => {
      const nodes = response.querySelectorAll("li");
      const slug = response.getAttribute("data-slug");
  
      if (slug && answerPositions[slug]) {
        const positions = answerPositions[slug].reduce((positions, position) => {
          return {
            ...positions,
            [position.slug]: position
          };
        }, {});
    
        Array.from(nodes).forEach(node => {
          const slug = node.getAttribute("data-slug");
          const position = positions[slug];
  
          node.addEventListener("mousemove", e => {
            const rect = node.getBoundingClientRect();
            const x = rect.left + (rect.width / 2) + window.scrollX;
            const y = rect.top + (rect.height * 0.75) + window.scrollY;

            if (view === gridView) {
              tooltip.show();
              tooltip.setPosition(x, y);
              tooltip.setHTML(`<p class="tooltip-name">${position.name}${position.party ? ` (${position.party})` : ""}</p>`
                +`${position.quote 
                  ? `<p class="tooltip-quote">${position.quote}</p>`
                  + `<p class="tooltip-source">from ${position.url ? `<a href="${position.url}">${position.source}</a>` : position.source}`
                  + `${position.date ? `, <span class="tooltip-date">${position.date}</span>` : ""}</p>` 
                  : ""}`);
            }
              
            node.addEventListener("mouseleave", e => {
              tooltip.hide();
            });
          });
        });
      }
    });
  });
}

function getMatches(selected) {
  const selectedQuestions = Object.values(selected);
  const selectedCandidates = selectedQuestions.reduce((candidates, question) => {
    return [].concat(candidates, question);
  }, []);
  const selectedSlugs = questionSlugs.filter(d => Object.keys(selected).indexOf(d) > -1);
  const otherCandidates = Object.keys(candidates).filter(d => selectedCandidates.indexOf(d) < 0);

  resultsContainer.classList.add("active");
  
  const entries = Array.from(rollup(selectedCandidates, v => v.length, d => d));
  const rankedEntries = [...entries, ...otherCandidates.map(d => [d, 0])].sort((a, b) => {
    const aText = candidates[a[0]].lastName.toLowerCase();
    const bText = candidates[b[0]].lastName.toLowerCase();
    const aInt = a[1];
    const bInt = b[1];

    if (aInt === bInt) {
      if (aText < bText) {
        return -1;
      }
      if (aText > bText) {
        return 1;
      }
      return 0;
    }

    return bInt - aInt;
  });
  const maxMatches = max(rankedEntries, d => d[1]);
  const topMatches = rankedEntries.filter(d => maxMatches !== 0 && d[1] === maxMatches);
  const otherMatches = rankedEntries.filter(d => maxMatches === 0 || d[1] !== maxMatches);

  function candidateCard([d, i]) {
    return `<li class="match expandable collapsed">`
      + `<div class="match-header expandable-header expandable-link">`
        + `<img class="match-image ${candidates[d].party === "D" ? "dem" : candidates[d].party === "R" ? "rep" : ""}" alt="${candidates[d].name}" src="${candidates[d].image ? `assets/images/${candidates[d].image}` : emptyImage}" />`
        + `<div>`
          + `<p class="match-name">${candidates[d].name}</p>`
          + `<p class="match-rank">Matched ${i} of ${selectedQuestions.length} questions</p>`
        + `</div>`
        + `<div class="display-open"><i class="up-arrow"></i></div><div class="display-closed"><i class="down-arrow"></i></div>`
      + `</div>`
      + `<div class="expandable-body">`
        + `<ul class="match-position-list">${selectedSlugs.map(questionSlug => {
          const answerSlug = candidatePositions[d] && candidatePositions[d][questionSlug];
          return `<li class="match-position">`
            + `<div class="match-position-agree ${selected[questionSlug].indexOf(d) > -1 ? "check" : "cross"}"></div>`
            + `<div class="match-position-text">`
              + `<p class="match-question">${questionText[questionSlug]}</p>`
              + `<p class="match-answer">${answerSlug ? questionAnswerText[questionSlug][answerSlug] : "No response / no position"}</p>`
            + `</div></li>`;
          }).join("")}`
        + `</ul>`
      + `</div>`
    + `</li>`
  };

  const topMarkup = `<ul class="matches-list">${topMatches.map(d => candidateCard(d)).join("")}</ul>`;
  const otherMarkup = `<div class="all-matches expandable collapsed">`
    + `<div class="matches-header expandable-header">`
      + `<p class="matches-link-group expandable-link"><span class="display-closed">+ Show other candidates</span><span class="display-open">- Hide other candidates</span></p>`
    + `</div>`
    + `<ul class="matches-list expandable-body">${otherMatches.map(d => candidateCard(d)).join("")}</ul>`
    + `</div>`;
  results.innerHTML = (topMatches.length > 0 ? "<h3 class=\"matches-title\">Match details</h3>" : "")
    + (topMatches.length > 0 ? topMarkup : "")
    + (otherMatches.length > 0 ? otherMarkup : "");

  const you = {name: "YOU", label: "YOU", maxRadius: 45};
  const nodes = topMatches.map(([slug, index]) => {
    // candidatePositions has more data
    const node = {
      ...candidates[slug],
      maxRadius: 30
    };

    if (node.image) {
      const image = new Image(100, 100);
      image.src = `assets/images/${node.image}`;
      node.image = image;
    }

    return node;
  });

  if (nodes.length > 0) {
    resultsChartTarget.classList.remove("chart-empty");
    resultsChart([...nodes, you]);
  } else {
    resultsChartTarget.classList.add("chart-empty");
  }
  
  attachExpandHandlers(results);
}

function attachExpandHandlers(target) {
  const containers = Array.from(target.querySelectorAll(".expandable"));
  const expandedClass = "expanded";
  const collapsedClass = "collapsed";

  containers.forEach(container => {
    var expanded = false;
    const link = container.querySelector(".expandable-link");
    const body = container.querySelector(".expandable-body");

    link && body && link.addEventListener("click", async e => {
      if (expanded) {
        // await readMore.collapse(body);
        container.classList.remove(expandedClass);
        container.classList.add(collapsedClass);
      } else {
        container.classList.remove(collapsedClass);
        container.classList.add(expandedClass);
        // await readMore.expand(body);
      }

      expanded = !expanded;
    });
  });
}

main();
