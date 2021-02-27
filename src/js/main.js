const {rollup} = require("d3-array");
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

const visual = require("./visual");
const tooltip = require("./tooltip.js");

const candidates = require("../../data/candidateData.json");
const positions = require("../../data/positionData.json");
const topic = "criminal-justice";
const questions = Array.from(document.querySelectorAll(".question"));

const result = document.querySelector("#results");
const resultsContainer = document.querySelector("#results-container");
const selected = {};

// Set up each question
questions.forEach(question => {
  const answer = question.querySelector(".answer");
  const responses = question.querySelector(".responses");
  const chartTarget = question.querySelector(".chart");
  const expandLink = question.querySelector(".expand-link a");

  const questionSlug = question.getAttribute("data-slug");
  const inputs = Array.from(question.querySelectorAll(`input[name=${questionSlug}]`));
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

  expandLink.addEventListener("click", e => {
    e.preventDefault();
    const activeClass = "active";

    if (responses.classList.contains(activeClass)) {
      responses.classList.remove(activeClass);
      expandLink.classList.remove("expanded");
      expandLink.classList.add("collapsed");
    } else {
      responses.classList.add(activeClass);
      expandLink.classList.remove("collapsed");
      expandLink.classList.add("expanded");
    }
  });

  // Add input listeners
  inputs.forEach(input => {
    input.addEventListener("change", e => {
      const slug = e.target.value;
      selected[questionSlug] = questionPositions[slug].map(d => d.slug);
      getMatches(selected);

      const data = answerPositions[slug] || [];
      answer.classList.add("active");
      chart([...data, you].map(node => ({...node, radius: 0})));
    });
  });
});

function getMatches(selected) {
  const questions = Object.values(selected);
  const selectedCandidates = questions.reduce((candidates, question) => {
    return [].concat(candidates, question);
  }, []);

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

  const markup = rankedEntries.map((d) => `<div class="result">`
    + `<span class="result-number">Matched ${d[0]} of ${questions.length}</span>`
    + `<ul class="result-list">${d[1].map(d => 
      `<li>${`<img class="candidate-image" alt="${candidates[d].name}" src="${candidates[d].image ? `assets/images/${candidates[d].image}` : emptyImage}" />`}${candidates[d].name}</li>`).join("")
    }</ul></div>`).join("");
  result.innerHTML = markup;
}
