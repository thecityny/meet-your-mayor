// Libraries
const {rollup, max, intersection} = require("d3-array");
const visual = require("./visual");
const tooltip = require("./tooltip.js");
const auth = require("./auth.js");
const track = require("./lib/tracking");
const headerVisual = require("./header-visual");

// Data
const candidates = require("../../data/candidateData.json");
const positionsData = require("../../data/positionData.json");
const questionData = require("../../data/questionData.json");
const answerData = require("../../data/answerData.json");
const topicDisplayData = require("../../data/topicDisplayData.json");

// const headerVisualTarget = document.querySelector(".splash-screen-visual");
// const splashScreen = headerVisual(headerVisualTarget);
// const splashScreenWidth = headerVisualTarget.getBoundingClientRect().width;
// const splashScreenHeight = headerVisualTarget.getBoundingClientRect().height;
// const splashScreenArea = splashScreenWidth * splashScreenHeight;
// const radiusRange = [Math.sqrt(splashScreenArea / 400), Math.sqrt(splashScreenArea / 50)];

// splashScreen.join(Object.values(topicDisplayData).map(node => {
//   const angle = Math.random() * 2 * Math.PI;
//   const velocity = 1;
//   const radius = Math.round(Math.random() * (radiusRange[1] - radiusRange[0]) + radiusRange[0]);
//   const width = splashScreenWidth - radius * 2;
//   const height = splashScreenHeight - radius * 2;

//   return {
//     x: Math.random() * width - width / 2,
//     y: Math.random() * height - height / 2,
//     vx: Math.cos(angle) * velocity,
//     vy: Math.sin(angle) * velocity,
//     r: radius,
//     color: node.background
//   }
// }));

// Topic data
const body = document.querySelector("body");
const topic = body.getAttribute("data-topic");

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


// Constants
const activeColor = "#666666";
const loadingClass = "loading";
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const profileImage = new Image(100, 100);
const visualCollection = [];
var selected = {};

function setProfileImage (url) {
  profileImage.crossOrigin = "anonymous";

  if (!url) {
    profileImage.src = emptyImage;
  } else {
    profileImage.src = url;
  }
  visualCollection.forEach(visual => {
    visual.refresh();
  });
};

// Init login options
auth(setProfileImage, track);

const shareLinks = Array.from(document.querySelectorAll(".share-container a"));
shareLinks.forEach(link => {
  link.addEventListener("click", e => {
    const value = e.target.getAttribute("data-value");
    track("click:share", value);
  });
})

attachExpandHandlers(document);

const topicCounts = Array.from(document.querySelectorAll(".topic-section"))
  .reduce((topicCounts, section) => {
    const slug = section.getAttribute("data-value");
    const target = section.querySelector(".topic-header-count");
    const count = section.querySelectorAll(".question").length;

    return {
      ...topicCounts,
      [slug]: {
        target,
        count
      }
    }
  }, {});

// Set up each question
const questionTargets = Array.from(document.querySelectorAll(".question"));

const questions = questionTargets.reduce((questions, question) => {
  // Question data
  const topic = question.getAttribute("data-topic");
  const questionSlug = question.getAttribute("data-slug");
  const questionPositions = positionsData[topic] && positionsData[topic][questionSlug] || {};
  const questionNodes = Object.fromEntries(Object.entries(questionPositions).map(([key, answer]) => {
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

  // Selected answer slug
  const [getAnswerSlug, setAnswerSlug, addAnswerSlugListener] = function () {
    var answerSlug = "";
    var listeners = [];
    
    return [
      () => answerSlug,
      (value, triggerUpdate = false) => {
        // When an answer is selected, update matches
        if (!selected[topic]) {
          selected[topic] = {};
        }
        selected[topic][questionSlug] = value;

        // If the answer is different or "Skip," update local storage
        if ((answerSlug !== value || answerSlug === "") && triggerUpdate) {
          localStorage.setItem(`mym-${topic}`, JSON.stringify(selected[topic], null, 2));
          getMatches(selected);
        }

        answerSlug = value;
        listeners.forEach(fun => fun(value));
      },
      (fun) => listeners.push(fun)
    ]
  }();

  // Responses view
  const [getView, setView, addViewListener] = function () {
    var view = "grid";
    var listeners = [];
    
    return [
      () => view,
      (value) => {
        view = value;
        listeners.forEach(fun => fun(view));
      },
      (fun) => listeners.push(fun)
    ]
  }();

  // Initialize answer buttons
  answerSelection(question.querySelector("form"), setAnswerSlug, addAnswerSlugListener);
  
  // On answer selection, show responses
  const agreed = question.querySelector(".agreed");
  addAnswerSlugListener((answerSlug) => {
    if (answerSlug !== "") {
      agreed.classList.add("active");
    } else {
      agreed.classList.remove("active");
    }
  });

  // Set up expandable responses view
  viewControl(question.querySelector(".expand-answers"), getView, setView, addViewListener);
  responses(question.querySelector(".responses"), questionNodes, getView, addViewListener, addAnswerSlugListener);
  attachExpandHandlers(question);

  const topicObject = questions[topic] || {};
  return {
    ...questions,
    [topic]: {
      ...topicObject,
      [questionSlug]: setAnswerSlug
    }
  }
}, {});

// Add radio selection to answer buttons
function answerSelection(target, setAnswerSlug, addAnswerSlugListener) {
  const buttons = Array.from(target.querySelectorAll("button"));
  const activeClass = "active";

  buttons.forEach(button => {
    button.addEventListener("click", e => {
      e.preventDefault();

      const slug = e.target.value;
      setAnswerSlug(slug, true);
    });
  });

  addAnswerSlugListener((slug) => {
    buttons.forEach(button => {
      if (button.value === slug) {
        button.classList.add(activeClass);
      } else {
        button.classList.remove(activeClass);
      }
    });
  });
}

// Set up response grid/list view toggle
function viewControl(target, getView, setView, addViewListener) {
  target.addEventListener("click", e => {
    e.preventDefault();
    
    if (getView() === "grid") {
      setView("list");
    } else {
      setView("grid");
    }
  });

  addViewListener(view => {
    if (view === "list") {
      target.classList.add("expanded");
      target.classList.remove("collapsed");
    } else {
      target.classList.remove("expanded");
      target.classList.add("collapsed");
    }
  });
}

// Set up responses view
function responses(target, questionNodes, getView, addViewListener, addAnswerSlugListener) {
  const gridView = "grid";

  addViewListener((view) => {
    if (view === gridView) {
      target.classList.add(gridView);
    } else {
      target.classList.remove(gridView);
      tooltip.hide();
    }
  });

  const responses = Array.from(target.querySelectorAll(".response"));
  responses.forEach(response => {
    const answerSlug = response.getAttribute("data-slug");
    const positions = answerSlug && questionNodes[answerSlug] || [];

    addAnswerSlugListener((slug) => {
      if (slug === answerSlug) {
        response.classList.add("active");
      } else {
        response.classList.remove("active");
      }
    });

    // Index positions by candidate slug
    const candidatePositions = positions.reduce((positions, position) => {
      return {
        ...positions,
        [position.slug]: position
      };
    }, {});

    // Add tooltips in grid view
    const nodes = Array.from(response.querySelectorAll("li"));
    nodes.forEach(node => {
      const candidateSlug = node.getAttribute("data-slug");
      const position = candidatePositions[candidateSlug];

      node.addEventListener("mousemove", e => {
        const rect = node.getBoundingClientRect();
        const x = rect.left + (rect.width / 2) + window.scrollX;
        const y = rect.top + (rect.height * 0.75) + window.scrollY;

        if (getView() === gridView) {
          tooltip.show();
          tooltip.setPosition(x, y);
          tooltip.setHTML(`<p class="tooltip-name"><a href="candidates/${position.slug}.html" target="_blank">${position.name}${position.party ? ` (${position.party})` : ""}${position.droppedOut ? `<span class="tooltip-status">Dropped out ${position.droppedOut}</span>` : ""}</a></p>`
            +`${position.quote 
              ? `<p class="tooltip-quote">${position.quote}</p>`
              + `<p class="tooltip-source">from ${position.url ? `<a href="${position.url}" target="_blank">${position.source}</a>` : position.source}`
              + `${position.date ? `, <span class="tooltip-date">${position.date}</span>` : ""}</p>` 
              : ""}`);
        }
          
        node.addEventListener("mouseleave", e => {
          tooltip.hide();
        });
      });
    });
  });
}

// Results elements
const results = document.querySelector("#results");
const resultsContainer = document.querySelector("#results-container");

const sidebarHeader = document.querySelector(".sidebar-box-chart-header");
const mobileFooterHeader = document.querySelector(".mobile-footer-header");
const mobileChartTarget = document.querySelector(".mobile-candidate-icons");
const sidebarChartTarget = document.querySelector("#sidebar-chart");
const sidebarChart = visual(sidebarChartTarget, tooltip, activeColor);
visualCollection.push(sidebarChart);

const you = {name: "YOU", label: "YOU", maxRadius: 40, image: profileImage};
var sidebarChartNodes = [you];

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

  // Update answered section counts
  Object.entries(topicCounts).forEach(([slug, count]) => {
    const value = selectedQuestions[slug] && selectedQuestions[slug].length || 0;
    count.target.innerHTML = `Answered ${value} of ${count.count}`;
  });

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
  const orderedQuestionSlugs = questionTargets
    .map(question => [question.getAttribute("data-topic"), question.getAttribute("data-slug")])
    .filter(([topic, questionSlug]) => selectedQuestions[topic] && selectedQuestions[topic].indexOf(questionSlug) > -1)
    .reduce((orderedQuestionSlugs, [topic, questionSlug]) => {
      return {
        ...orderedQuestionSlugs,
        [topic]: [...(orderedQuestionSlugs[topic] || []), questionSlug]
      }
    }, {});

  // Every candidate that doesn't appear in candidateOccurrences
  const otherCandidates = Object.keys(candidates).filter(d => candidateOccurrences.indexOf(d) < 0);

  resultsContainer.classList.add("active");
  
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
  function candidateCard([candidateSlug, matches]) {
    const candidate = candidates[candidateSlug];
    return `<li class="match expandable collapsed" data-value="candidate">`
      + `<div class="match-header expandable-header expandable-link">`
        + `<figure class="circle-image match-image ${candidate.party === "D" ? "dem" : candidate.party === "R" ? "rep" : ""} ${candidate.droppedOut ? "dropped-out" : ""}">`
          + `<img src="${candidate.image ? `assets/images/${candidate.image}` : emptyImage}" alt="${candidate.name}" />`
          + `<div class="circle-image-label">${candidate.image ? "" : candidate.label}</div>`
        + `</figure>`
        + `<div>`
          + `<p class="match-name">${candidate.name} (${candidate.party})${candidate.droppedOut ? `<span class="match-status">Dropped out ${candidate.droppedOut}</span>` : ""}</p>`
          + `<p class="match-rank">Matched you on ${matches} of ${selectedQuestionCount} questions</p>`
        + `</div>`
        + `<div class="display-open"><i class="up-arrow"></i></div><div class="display-closed"><i class="down-arrow"></i></div>`
      + `</div>`
      + `<div class="expandable-body">`
        + `<p class="match-links"><a href="candidates/${candidateSlug}.html">More on this candidate</a> &middot; <a href="printable.html?view=single&candidate=${candidateSlug}">Print view</a></p>`
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
    + `</li>`
  };

  // Match list templates
  const topMarkup = `<ul class="matches-list">${topMatches.map(d => candidateCard(d)).join("")}</ul>`;
  const otherMarkup = `<div class="all-matches expandable collapsed" data-value="candidates">`
    + `<div class="matches-header expandable-header">`
      + `<p class="matches-link-group expandable-link"><span class="display-closed">+ Show ${topMatches.length > 0 ? "other" : "all"} candidates</span><span class="display-open">- Hide ${topMatches.length > 0 ? "other" : "all"} candidates</span></p>`
    + `</div>`
    + `<ul class="matches-list expandable-body">${otherMatches.map(d => candidateCard(d)).join("")}</ul>`
    + `</div>`;
  results.innerHTML = selectedQuestionCount === 0 
    ? "<p class=\"no-matches\">Answer questions to see matches</p>" 
    : (topMatches.length > 0 ? topMarkup : "<p class=\"no-matches\">No matches</p>") + (otherMatches.length > 0 ? otherMarkup : "");

  const sidebarChartNodesList = sidebarChartNodes.map(({slug}) => slug);
  const noChange = topMatches.length === sidebarChartNodes.length && 
    topMatches.reduce((noChange, [slug]) => {
      return noChange && sidebarChartNodesList.indexOf(slug) > -1;
    }, true);

  // Nodes for final visual
  if (!noChange) {
    sidebarChartNodes = topMatches.map(([slug, index]) => {
      const existing = sidebarChartNodes.filter(node => node.slug === slug)[0];
  
      if (existing) {
        return existing;
      }
  
      const node = {
        ...candidates[slug],
        slug,
        maxRadius: 25
      };
    
      if (node.image) {
        const image = new Image(100, 100);
        image.src = `assets/images/${node.image}`;
        node.image = image;
      }
  
      return node;
    });
  
    // Final result display formatting
    sidebarChart.join([...sidebarChartNodes, you]);
    mobileChartTarget.innerHTML = sidebarChartNodes.map(({slug}) => {
      const candidate = candidates[slug];
      return `<li>
        <div class="circle-image ${candidate.party === "D" ? "dem" : candidate.party === "R" ? "rep" : ""} ${candidate.droppedOut ? "dropped-out" : ""}">
          <img src="${candidate.image ? `assets/images/${candidate.image}` : emptyImage}" alt="${candidate.name}" />
        </div>
      </li>`;
    }).join("");
  }

  const resultsHeaderString = selectedQuestionCount === 0 
    ? "Answer questions to see matches"
    : topMatches.length === 0 
    ? `No matches on ${selectedQuestionCount > 1 ? `${selectedQuestionCount} questions` : "one question"}`
    : selectedQuestionCount === 1 
    ? "Matched you on at least one question" 
    : `Matched you on at least ${maxMatches === 0 ? "1" : maxMatches} of ${selectedQuestionCount} questions`;
  sidebarHeader.innerHTML = resultsHeaderString;
  mobileFooterHeader.innerHTML = resultsHeaderString;

  if (sidebarChartNodes.length === 0) {
    mobileChartTarget.classList.add("empty");
    sidebarChartTarget.classList.add("empty");
  } else {
    mobileChartTarget.classList.remove("empty");
    sidebarChartTarget.classList.remove("empty");
  }
  
  attachExpandHandlers(results);
}

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

  try {
    Object.entries(questions).forEach(([topic, questions]) => {
      Object.entries(questions).forEach(([questionSlug, setAnswerSlug]) => {
        if (data[topic] && typeof data[topic][questionSlug] !== "undefined") {
          setAnswerSlug(data[topic][questionSlug]);
        }
      });
    });

    getMatches(data);
  } catch (e) {
    console.error(e);
  }
  
  body.classList.remove(loadingClass);
}

loadAnswers();

const changeList = document.querySelector("#change-list");
const changeLink = document.querySelector("#changed-link");
changeLink && changeLink.addEventListener("click", e => {
  e.preventDefault();
  changeList.scrollIntoView(true);
});

document.querySelector(".newsletter-link a").addEventListener("click", e => {
  track("click:newsletter");
});

Array.from(document.querySelectorAll(".topics-list a")).forEach(link => {
  link.addEventListener("click", e => {
    track("click:topics", link.href);
  });
});

const questionContainer = document.querySelector("#questions");
const mobileFooter = document.querySelector(".mobile-footer");

const exitObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.target === questionContainer) {
      if (entry.isIntersecting && entry.intersectionRect.y > 0) {
        mobileFooter.classList.add("active");
      } else {
        mobileFooter.classList.remove("active");
      }
    }
    if (entry.target === resultsContainer) {
      if (entry.isIntersecting) {
        mobileFooter.classList.remove("active");
      } else if (entry.boundingClientRect.y > 0 && entry.time > 1000) {
        mobileFooter.classList.add("active");
      }
    }
  });
}, {});
exitObserver.observe(questionContainer);
exitObserver.observe(resultsContainer);
