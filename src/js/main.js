// Libraries
const {rollup, max} = require("d3-array");
const visual = require("./visual");
const resultsImage = require("./results-image.js");
const tooltip = require("./tooltip.js");
const auth = require("./auth.js");
const track = require("./lib/tracking");

// Data
const candidates = require("../../data/candidateData.json");
const positionsData = require("../../data/positionData.json");
const questionData = require("../../data/questionData.json");
const answerData = require("../../data/answerData.json");
const topicData = require("../../data/topicDisplayData.json");

// Topic data
const body = document.querySelector("body");
const topic = body.getAttribute("data-topic");
const positions = positionsData[topic] || {};
const questionText = questionData[topic];
const questionAnswerText = answerData[topic];

// Candidate data
const candidatePositionsMap = new Map();
Object.entries(positions).forEach(([questionSlug, answers]) => {
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

// Constants
const localStorageSlug = `mym-${topic}`;
const activeColor = topicData[topic].color;
const loadingClass = "loading";
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const profileImage = new Image(100, 100);
const you = {name: "YOU", label: "YOU", maxRadius: 45, image: profileImage};
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

// Set up each question
const questionTargets = Array.from(document.querySelectorAll(".question"));

const questions = questionTargets.reduce((questions, question) => {
  // Question data
  const questionSlug = question.getAttribute("data-slug");
  const questionPositions = positions[questionSlug] || {};
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
        selected[questionSlug] = value;
        getMatches(selected);

        if ((answerSlug !== value || answerSlug === "") && triggerUpdate) {
          localStorage.setItem(localStorageSlug, JSON.stringify(selected, null, 2));
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
  
  // Initialize answer elements
  const answer = question.querySelector(".answer");
  const chartTarget = question.querySelector(".chart");  
  const chart = visual(chartTarget, tooltip, activeColor);
  visualCollection.push(chart);
  
  // On answer selection, update visual
  addAnswerSlugListener((answerSlug) => {
    const emptyChartClass = "chart-empty";
    track("click:question", questionSlug);

    if (answerSlug) {
      answer.classList.add("active");

      const answerNodes = questionNodes[answerSlug] || [];
      if (answerNodes.length > 0) {
        chartTarget.classList.remove(emptyChartClass);
        chart.join([...answerNodes, you].map(node => ({...node, radius: 0})));
      } else {
        chartTarget.classList.add(emptyChartClass);
      }
    } else {
      answer.classList.remove("active");
    }
  });

  // Set up expandable responses view
  viewControl(question.querySelector(".responses-button-group"), setView);
  responses(question.querySelector(".responses"), questionNodes, getView, addViewListener);
  attachExpandHandlers(question);

  return {
    ...questions,
    [questionSlug]: setAnswerSlug
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
function viewControl(target, setView) {
  const viewButtons = target.querySelectorAll("button");

  Array.from(viewButtons).forEach(button => {
    button.addEventListener("click", e => {
      const view = e.target.value;
      setView(view);

      Array.from(viewButtons).forEach(button => {
        if (button.value === view) {
          button.classList.add("active");
        } else {
          button.classList.remove("active");
        }
      });
    });
  });
}

// Set up responses view
function responses(target, questionNodes, getView, addViewListener) {
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
const resultsChartTarget = document.querySelector("#results-chart");
const resultsChart = visual(resultsChartTarget, tooltip, activeColor);
visualCollection.push(resultsChart);

const resultsImageTarget = document.querySelector("#results-image");
const resultsImageChart = resultsImage(resultsImageTarget, topicData[topic]);
visualCollection.push(resultsImageChart);

const resultsLinkContainer = document.querySelector("#results-link-container");
const resultsLink = document.querySelector("#results-link");
var resultsImageObjectURL = "";
window.downloadImage = function () {
  URL.revokeObjectURL(resultsImageObjectURL);
  const dataUrl = resultsImageTarget.toDataURL("image/png");
  resultsImageObjectURL = URL.createObjectURL(dataURItoBlob(dataUrl));
  resultsLink.href = resultsImageObjectURL;
};

function getMatches(selected) {
  const selectedQuestions = Object.entries(selected)
    .filter(([key, value]) => value)
    .map(([key, value]) => key);
  const selectedCandidates = selectedQuestions.reduce((candidates, questionSlug) => {
    const answerSlug = selected[questionSlug];
    const answerPositions = positions[questionSlug] && positions[questionSlug][answerSlug] || [];
    const answerCandidates = answerPositions.map(d => d.slug);
    
    return {
      ...candidates,
      [questionSlug]: answerCandidates
    };
  }, {});
  const candidateOccurrences = Object.values(selectedCandidates)
    .reduce((candidates, answerCandidates) => [
      ...candidates, 
      ...answerCandidates
    ], []);

  const orderedQuestionSlugs = questionTargets
    .map(question => question.getAttribute("data-slug"))
    .filter(d => selectedQuestions.indexOf(d) > -1);;
  const otherCandidates = Object.keys(candidates).filter(d => candidateOccurrences.indexOf(d) < 0);

  resultsContainer.classList.add("active");
  
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
  const maxMatches = max(rankedEntries, d => d[1]);
  const topMatches = rankedEntries.filter(d => maxMatches !== 0 && d[1] === maxMatches);
  const otherMatches = rankedEntries.filter(d => maxMatches === 0 || d[1] !== maxMatches);

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
          + `<p class="match-rank">Matched you on ${matches} of ${selectedQuestions.length} questions</p>`
        + `</div>`
        + `<div class="display-open"><i class="up-arrow"></i></div><div class="display-closed"><i class="down-arrow"></i></div>`
      + `</div>`
      + `<div class="expandable-body">`
        + `<p class="match-links"><a href="candidates/${candidateSlug}.html">More on this candidate</a></p>`
        + `<ul class="match-position-list">${orderedQuestionSlugs.map(questionSlug => {
          const answerSlug = candidatePositions[candidateSlug] && candidatePositions[candidateSlug][questionSlug];
          return `<li class="match-position">`
            + `<div class="match-position-agree ${selectedCandidates[questionSlug].indexOf(candidateSlug) > -1 ? "check" : "cross"}"></div>`
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
  const otherMarkup = `<div class="all-matches expandable collapsed" data-value="candidates">`
    + `<div class="matches-header expandable-header">`
      + `<p class="matches-link-group expandable-link"><span class="display-closed">+ Show ${topMatches.length > 0 ? "other" : "all"} candidates</span><span class="display-open">- Hide ${topMatches.length > 0 ? "other" : "all"} candidates</span></p>`
    + `</div>`
    + `<ul class="matches-list expandable-body">${otherMatches.map(d => candidateCard(d)).join("")}</ul>`
    + `</div>`;
  results.innerHTML = (topMatches.length > 0 ? "<h3 class=\"matches-title\">Match details</h3>" : "")
    + (topMatches.length > 0 ? topMarkup : "")
    + (otherMatches.length > 0 ? otherMarkup : "");

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
    resultsLinkContainer.classList.add("active");
    resultsChart.join([...nodes, you].map(node => ({...node, radius: 0})));
    resultsImageChart.join([...nodes, you]);
  } else {
    resultsLinkContainer.classList.remove("active");
    resultsChartTarget.classList.add("chart-empty");
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
  const dataString = localStorage.getItem(localStorageSlug) || "{}";
  const data = JSON.parse(dataString);

  try {
    Object.entries(questions).forEach(([questionSlug, setAnswerSlug]) => {
      if (typeof data[questionSlug] !== "undefined") {
        setAnswerSlug(data[questionSlug]);
      }
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

function dataURItoBlob(dataURI) {
  var byteString = atob(dataURI.split(',')[1]);
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }
  var blob = new Blob([ab], {type: mimeString});
  return blob;
}

