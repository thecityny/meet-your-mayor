// Libraries
const {rollup} = require("d3-array");

// Data
const candidates = require("../../data/candidateData.json");
const positionsData = require("../../data/positionData.json");
const questionData = require("../../data/questionData.json");
const answerData = require("../../data/answerData.json");
const topicDisplayData = require("../../data/topicDisplayData.json");

// Topic data
const printContainer = document.querySelector("#print-container");
const printTitle = document.querySelector("#print-title");
const orderedQuestionsContainer = document.querySelector("#ordered-questions");
const orderedQuestions = JSON.parse(orderedQuestionsContainer && orderedQuestionsContainer.innerHTML || {});

// Candidate data {candidate: {topic: {question: answer}}}
const candidatePositionsMap = new Map();
Object.entries(positionsData).forEach(([topic, questions]) => {
  Object.entries(questions).forEach(([questionSlug, answers]) => {
    Object.entries(answers).forEach(([answerSlug, candidates]) => {
      candidates.forEach(({slug}) => {
        const topics = candidatePositionsMap.get(slug) || {};
        const position = topics[topic] || {};

        candidatePositionsMap.set(slug, {
          ...topics,
          [topic]: {
            ...position,
            [questionSlug]: answerSlug
          }
        });
      });
    })
  });
});
const candidatePositions = Object.fromEntries(Array.from(candidatePositionsMap));

// Constants d
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

// Count the number of matches for each candidate, create result cards,
// format result lists and display final visual
function getMatches(selected) {
  // Filter skipped questions from the "selected" {topic: [questionSlug, ...]}
  const selectedQuestions = Object.fromEntries(Object.entries(selected)
    .map(([topic, answers]) => {
      const filteredAnswers = Object.entries(answers)
        .filter(([question, answer]) => answer)
        .map(([question, answer]) => question);
      return [topic, filteredAnswers];
    }));

  const selectedQuestionCount = Object.values(selectedQuestions).reduce((count, questions) => {
    return count + questions.length;
  }, 0);

  // Get the candidate slugs for the selected answers {topic: {questionSlug: [candidate, ...]}}
  const selectedCandidates = Object.fromEntries(Object.entries(selected)
    .map(([topic, answers]) => {
      const candidates = selectedQuestions[topic].reduce((candidates, questionSlug) => {
        const answerSlug = selected[topic][questionSlug];
        const answerPositions = positionsData[topic] && positionsData[topic][questionSlug] && positionsData[topic][questionSlug][answerSlug] || [];
        const answerCandidates = answerPositions.map(d => d.slug);
        
        return {
          ...candidates,
          [questionSlug]: answerCandidates
        };
      }, {});

      return [topic, candidates];
    }));

  // Flat array of every candidate occurrence [candidate2, candidate1, candidate1, candidate3, ...]
  const candidateOccurrences = Object.values(selectedCandidates)
    .reduce((candidates, questions) => {
      const answerCandidates = [].concat(...Object.values(questions))
      return [...candidates, ...answerCandidates];
    }, []);

  // Array of question slugs in order of appearance {topic: [questionSlug, ...]}
  const orderedQuestionSlugs = orderedQuestions
    .filter(([topic, questionSlug]) => selectedQuestions[topic] && selectedQuestions[topic].indexOf(questionSlug) > -1)
    .reduce((orderedQuestionSlugs, [topic, questionSlug]) => {
      return {
        ...orderedQuestionSlugs,
        [topic]: [...(orderedQuestionSlugs[topic] || []), questionSlug]
      }
    }, {});

  // Every candidate that doesn't appear in candidateOccurrences
  const otherCandidates = Object.keys(candidates).filter(d => candidateOccurrences.indexOf(d) < 0);
  
  // Count slug occurrences and order by count and last name
  const entries = Array.from(rollup(candidateOccurrences, v => v.length, d => d));
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
  // Match display data
  // const maxMatches = max(rankedEntries, d => d[1]);
  const maxMatches = rankedEntries[(rankedEntries.length >= 5 ? 5 : rankedEntries.length) - 1][1];
  const topMatches = rankedEntries.filter(d => maxMatches === 0 ? d[1] > 0 : d[1] >= maxMatches);
  const otherMatches = rankedEntries.filter(d => maxMatches === 0 ? d[1] === 0 : d[1] < maxMatches);

  // Match card template
  function candidateCard([candidateSlug, matches], expanded) {
    const candidate = candidates[candidateSlug];
    
    const header = `<div class="match-header expandable-header expandable-link">`
      + `<figure class="circle-image match-image ${candidate.party === "D" ? "dem" : candidate.party === "R" ? "rep" : ""} ${candidate.droppedOut ? "dropped-out" : ""}">`
        + `<img src="${candidate.image ? `assets/images/${candidate.image}` : emptyImage}" alt="${candidate.name}" />`
        + `<div class="circle-image-label">${candidate.image ? "" : candidate.label}</div>`
      + `</figure>`
      + `<div>`
        + `<p class="match-name">${candidate.name} (${candidate.party})${candidate.droppedOut ? `<span class="match-status">Dropped out ${candidate.droppedOut}</span>` : ""}</p>`
        + `<p class="match-rank">Matched you on ${matches} of ${selectedQuestionCount} questions</p>`
      + `</div>`
      + `</div>`;

    const body = `<div class="expandable-body">`
      + Object.entries(orderedQuestionSlugs).map(([topic, questionSlugs]) => {
        const agreeCount = questionSlugs.filter(questionSlug => selectedCandidates[topic] && selectedCandidates[topic][questionSlug].indexOf(candidateSlug) > -1).length;
        return `<h4 class="match-topic">${topicDisplayData[topic].label} &middot; ${agreeCount} of ${questionSlugs.length} matched</h4><ul class="match-position-list">${questionSlugs.map(questionSlug => {
          const answerSlug = candidatePositions[candidateSlug] && candidatePositions[candidateSlug][topic] && candidatePositions[candidateSlug][topic][questionSlug];
          return `<li class="match-position">`
            + `<div class="match-position-agree ${selectedCandidates[topic] && selectedCandidates[topic][questionSlug].indexOf(candidateSlug) > -1 ? "check" : "cross"}"></div>`
            + `<div class="match-position-text">`
              + `<p class="match-question">${questionData[topic][questionSlug]}</p>`
              + `<p class="match-answer">${answerSlug ? answerData[topic][questionSlug][answerSlug] : "No response / no position"}</p>`
            + `</div></li>`;
        }).join("")}</ul>`;
      }).join("")
      + `</div>`

      return `<li class="match" data-value="candidate">${expanded ? header + body : header}</li>`;
  };

  // Match list templates
  const topMarkup = `<ul class="matches-list">${topMatches.map(d => candidateCard(d)).join("")}</ul>`;
  const otherMarkup = `<div class="all-matches" data-value="candidates">`
    + `<ul class="matches-list expandable-body">${otherMatches.map(d => candidateCard(d)).join("")}</ul>`
    + `</div>`;

  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get("view");
  const viewCandidate = urlParams.get("candidate");

  if (view === "all") {
    printTitle.innerHTML = "Meet Your Mayor Matches";
    printContainer.innerHTML = `<ul class="matches-list">${rankedEntries.map(d => candidateCard(d, false)).join("")}</ul>`;
  } else if (view === "single") {
    printTitle.innerHTML = `Meet Your Mayor Candidate Summary`;
    printContainer.innerHTML = `<ul class="matches-list">${rankedEntries.filter(([candidateSlug, matches]) => candidateSlug === viewCandidate).map(d => candidateCard(d, true)).join("")}</ul>`;
  }
}

function loadAnswers() {
  const data = Object.entries(localStorage).reduce((localData, [key, data]) => {
    if (key.startsWith("mym-") && key !== "mym-final") {
      return {
        ...localData,
        [key.match(/^mym\-(.+)$/)[1]]: JSON.parse(data)
      };
    } else {
      return localData;
    }
  }, {});

  getMatches(data);
}

loadAnswers();
