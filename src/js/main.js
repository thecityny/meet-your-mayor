// const pym = require("./lib/pym");
// const ai2html = require("./lib/ai2html-resizer");
const visual = require("./visual");

const positions = require("../../data/positions.json");
const guideSlug = "criminal-justice";
const answers = Array.from(document.querySelectorAll(".answers"));

answers.forEach(answers => {
  const id = answers.getAttribute("id");
  const questionSlugMatches = id.match(/^answers-([a-zA-Z0-9\-]+)$/);
  const questionSlug = questionSlugMatches && questionSlugMatches[1];

  const answer = Array.from(answers.querySelectorAll(".answer"));
  answer.forEach(answer => {
    const id = answer.getAttribute("id");
    const slugMatches = id.match(new RegExp(`^answer-${questionSlug}-([a-zA-Z0-9\-]+)$`));
    const slug = slugMatches && slugMatches[1];
    const candidates = positions[guideSlug][questionSlug][slug];
    console.log(questionSlug, slug, candidates);
    
    const chartTarget = answer.querySelector(".chart");
    const updateVisual = visual(chartTarget);
    updateVisual(candidates);
  });
});

const inputs = document.querySelectorAll(".question input[type=radio]");

Array.from(inputs).forEach(input => {
  input.addEventListener("change", e => {
    // console.log(input.value);
  });
});