const visual = require("./visual");
const tooltip = require("./tooltip.js");

const candidates = require("../../data/candidates.json");
const guides = require("../../data/positions.json");
const guideSlug = "criminal-justice";
const questions = Array.from(document.querySelectorAll(".question"));


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
