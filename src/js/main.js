const visual = require("./visual");
const tooltip = require("./tooltip.js");

const guides = require("../../data/positions.json");
const guideSlug = "criminal-justice";
const questions = Array.from(document.querySelectorAll(".question"));


// Set up each question
questions.forEach(question => {
  const questionSlug = question.getAttribute("data-slug");
  const inputs = Array.from(question.querySelectorAll(`input[name=${questionSlug}]`));

  const questionData = guides[guideSlug][questionSlug];
  const positions = Object.fromEntries(Object.entries(questionData).map(([key, answer]) => {
    return [key, answer.map(candidate => {
      const node = {
        ...candidate,
        maxRadius: 20
      };

      if (candidate.image) {
        const image = new Image(100, 100);
        image.src = `assets/images/${candidate.image}`;
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
      const you = {name: "YOU", label: "YOU", maxRadius: 40};

      // Add YOU to the selected answer, reset the other answers
      Object.entries(answers).forEach(([key, chart]) => {
        const data = positions[key];
  
        if (key === slug) {
          chart([...data, you]);
        } else {
          chart(data);
        }
      });
    });
  });
});
