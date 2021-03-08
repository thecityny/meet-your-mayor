const {rollup} = require("d3-array");
const {pointer} = require("d3-selection");
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

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
const result = document.querySelector("#results");
const resultsContainer = document.querySelector("#results-container");
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

// Set up each question
questions.forEach(question => {
  const gridView = "grid";
  var view = gridView;

  const answer = question.querySelector(".answer");
  const responseContainer = question.querySelector(".responses");
  const responses = responseContainer.querySelectorAll(".response");
  const chartTarget = question.querySelector(".chart");

  const expandHeader = question.querySelector(".expand-header");
  const expandLink = expandHeader.querySelector(".link-group a");
  const viewButtons = expandHeader.querySelectorAll(".button-group button");

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

  expandLink.addEventListener("click", e => {
    e.preventDefault();
    const activeClass = "active";

    if (responseContainer.classList.contains(activeClass)) {
      responseContainer.classList.remove(activeClass);
      expandHeader.classList.remove("expanded");
      expandHeader.classList.add("collapsed");
    } else {
      responseContainer.classList.add(activeClass);
      expandHeader.classList.remove("collapsed");
      expandHeader.classList.add("expanded");
    }
  });

  // Add input listeners
  buttons.forEach(button => {
    button.addEventListener("click", e => {
      e.preventDefault();

      const slug = e.target.value;
      selected[questionSlug] = questionPositions[slug].map(d => d.slug);
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
      chart([...data, you].map(node => ({...node, radius: 0})));
    });
  });

  Array.from(responses).forEach(response => {
    const nodes = response.querySelectorAll("li");
    const slug = response.getAttribute("data-slug");

    if (slug) {
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
          if (view === gridView) {
            tooltip.show();
            tooltip.setPosition(e.pageX, e.pageY);
            tooltip.setHTML(`<p>${position.name}<p>${position.quote ? `<p>${position.quote}</p><p>from ${position.url ? `<a href="${position.url}">${position.source}</a>` : position.source}</p>` : ""}`);
          }
        });

        node.addEventListener("mouseleave", e => {
          tooltip.hide();
        });
      });
    }
  });
});

function getMatches(selected) {
  const selectedQuestions = Object.values(selected);
  const selectedCandidates = selectedQuestions.reduce((candidates, question) => {
    return [].concat(candidates, question);
  }, []);
  const selectedSlugs = questionSlugs.filter(d => Object.keys(selected).indexOf(d) > -1);

  if (selectedCandidates.length > 0) {
    resultsContainer.classList.add("active");
  } else {
    resultsContainer.classList.remove("active");
  }
  
  const entries = Array.from(rollup(selectedCandidates, v => v.length, d => d));
  const rankedEntries = Array.from(rollup(entries, v => {
    return v.map(d => d[0]).sort((a, b) => {
      const aText = a[0].toLowerCase();
      const bText = b[0].toLowerCase();
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
  }, d => d[1]))
  .sort((a, b) => b[0] - a[0]);

  const markup = rankedEntries.map((d, i) => `<div class="result collapsed">`
    + `<h4 class="result-title">Matched ${d[0]} of ${selectedQuestions.length} <span class="open">-</span><span class="closed">+</span></h4>`
    + `<ul class="result-list">${d[1].map(d => 
      `<li><img class="result-image" alt="${candidates[d].name}" src="${candidates[d].image ? `assets/images/${candidates[d].image}` : emptyImage}" /><div class="result-text">${
        `<p class="result-name">${candidates[d].name}</p>`
        + `<ul>${selectedSlugs.map(questionSlug => {
            const answerSlug = candidatePositions[d][questionSlug];
            return `<li class="result-position">`
              + `<div class="result-position-agree ${selected[questionSlug].indexOf(d) > -1 ? "check" : "cross"}"></div>`
              + `<div class="result-position-text">`
                + `<p class="result-question">${questionText[questionSlug]}</p>`
                + `<p class="result-answer">${answerSlug ? questionAnswerText[questionSlug][answerSlug] : "No response / no position"}</p>`
              + `</div></li>`;
          }).join("")}`     
      }</ul></div></li>`).join("")
    }</ul></div>`).join("");
  result.innerHTML = markup;

  const results = Array.from(result.querySelectorAll(".result"));
  results.forEach(result => {
    var expanded = false;
    const header = result.querySelector(".result-title");

    header.addEventListener("click", e => {
      if (expanded) {
        result.classList.remove("expanded");
        result.classList.add("collapsed");
      } else {
        result.classList.add("expanded");
        result.classList.remove("collapsed");
      }

      expanded = !expanded;
    });
  });
}
