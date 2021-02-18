const {rollup} = require("d3-array");
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

const visual = require("./visual");
const tooltip = require("./tooltip.js");

const candidates = require("../../data/candidates.json");
const guides = require("../../data/positions.json");
const guideSlug = "criminal-justice";
const questions = Array.from(document.querySelectorAll(".question"));

const result = document.querySelector("#results");
const resultsContainer = document.querySelector("#results-container");
const selected = {};

// Set up each question
questions.forEach(question => {
  const questionSlug = question.getAttribute("data-slug");
  const inputs = Array.from(question.querySelectorAll(`input[name=${questionSlug}]`));

  const questionData = guides[guideSlug][questionSlug];
  const positions = Object.fromEntries(Object.entries(questionData).map(([key, answer]) => {
    return [key, answer.map(candidate => {
      const node = {
        ...candidates[candidate.slug],
        ...candidate,
        maxRadius: 20
      };

      if (node.image) {
        const image = new Image(100, 100);
        image.src = `assets/images/${node.image}`;
        node.image = image;
      }

      return node;
    })];
  }));

  // Initialize answer charts based on available options
  const answers = inputs.reduce((answers, input) => {
    const slug = input.getAttribute("value");

    const target = document.querySelector(`#answer-${questionSlug}-${slug}`);
    const chart = visual(target, tooltip);
    const data = positions[slug];
    chart(data);

    return {
      [slug]: chart,
      ...answers
    };
  }, {});

  // Add input listeners
  inputs.forEach(input => {
    input.addEventListener("change", e => {
      const slug = e.target.value;
      const you = {name: "YOU", label: "YOU", maxRadius: 30};
      selected[questionSlug] = questionData[slug].map(d => d.slug);
      getMatches(selected);

      // Add YOU to the selected answer, reset the other answers
      Object.entries(answers).forEach(([key, chart]) => {
        const data = positions[key] || [];
  
        if (key === slug) {
          chart([...data, you]);
        } else {
          chart(data);
        }
      });
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
