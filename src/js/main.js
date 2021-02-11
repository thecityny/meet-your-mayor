const {rollup} = require("d3-array");

const visual = require("./visual");
const tooltip = require("./tooltip.js");

const candidates = require("../../data/candidates.json");
const guides = require("../../data/positions.json");
const { select } = require("d3-selection");
const guideSlug = "criminal-justice";
const questions = Array.from(document.querySelectorAll(".question"));

const result = document.querySelector("#result");

const selected = {};

// Set up each question
questions.forEach(question => {
  const questionSlug = question.getAttribute("data-slug");
  const inputs = Array.from(question.querySelectorAll(`input[name=${questionSlug}]`));

  const questionData = guides[guideSlug][questionSlug];
  const positions = Object.fromEntries(Object.entries(questionData).map(([key, answer]) => {
    return [key, answer.map(slug => {
      const node = {
        ...candidates[slug],
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
      selected[questionSlug] = questionData[slug];

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
  const candidates = Object.values(selected).reduce((candidates, question) => {
    return [].concat(candidates, question);
  }, []);
  
  const entries = Array.from(rollup(candidates, v => v.length, d => d))
    .sort((a, b) => {
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
    })
    .map((d) => `<li>${d[0]} (${d[1]})</li>`)
    .join("");

  result.innerHTML = entries;
}
