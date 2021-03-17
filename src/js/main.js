// Libraries
const {rollup, max} = require("d3-array");
const visual = require("./visual");
const tooltip = require("./tooltip.js");

// Data
const candidates = require("../../data/candidateData.json");
const positionsData = require("../../data/positionData.json");
const questionData = require("../../data/questionData.json");
const answerData = require("../../data/answerData.json");

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
const activeColors = {
  "nypd": "#f78e65",
  "education": "#848c73",
  "corona-recovery": "#b98fc1"
}
const activeColor = activeColors[topic];
const loadingClass = "loading";
const emptyImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const profileImage = new Image(100, 100);
const you = {name: "YOU", label: "YOU", maxRadius: 45, image: profileImage};
const visualCollection = [];
var selected = {};

function setProfileImage (url) {
  if (!url) {
    profileImage.src = emptyImage;
  } else {
    profileImage.src = url;
  }
  visualCollection.forEach(visual => {
    visual.refresh();
  });
};

const endpoint = "https://lh48uaczhk.execute-api.us-east-1.amazonaws.com/Prod/";

// Facebook login
const fbButton = document.querySelector("#fb-button");
var fbToken = "";

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

        if (answerSlug !== value && fbToken && triggerUpdate) {
          fetch(`${endpoint}/answers?auth=facebook&topic=${topic}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${fbToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(selected, null, 2)
          });
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
          tooltip.setHTML(`<p class="tooltip-name">${position.name}${position.party ? ` (${position.party})` : ""}</p>`
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
    return `<li class="match expandable collapsed">`
      + `<div class="match-header expandable-header expandable-link">`
        + `<img class="match-image ${candidate.party === "D" ? "dem" : candidate.party === "R" ? "rep" : ""}" alt="${candidate.name}" src="${candidate.image ? `assets/images/${candidate.image}` : emptyImage}" />`
        + `<div>`
          + `<p class="match-name">${candidate.name}</p>`
          + `<p class="match-rank">Matched you on ${matches} of ${selectedQuestions.length} questions</p>`
        + `</div>`
        + `<div class="display-open"><i class="up-arrow"></i></div><div class="display-closed"><i class="down-arrow"></i></div>`
      + `</div>`
      + `<div class="expandable-body">`
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
  const otherMarkup = `<div class="all-matches expandable collapsed">`
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
    resultsChart.join([...nodes, you].map(node => ({...node, radius: 0})));
  } else {
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
    const link = container.querySelector(".expandable-link");
    const body = container.querySelector(".expandable-body");

    link && body && link.addEventListener("click", async e => {
      if (expanded) {
        // await readMore.collapse(body);
        container.classList.remove(expandedClass);
        container.classList.add(collapsedClass);
      } else {
        container.classList.remove(collapsedClass);
        container.classList.add(expandedClass);
        // await readMore.expand(body);
      }

      expanded = !expanded;
    });
  });
}

const fbButtonText = fbButton.querySelector(".fb-button-text");
const loginPrompt = document.querySelector(".login-prompt");

try {
  FB.getLoginStatus(response => {
    if (response.status === 'connected') {
      fbLogin(response.authResponse);
    } else {
      fbLogout();
    }
  });
} catch (e) {
  console.error(e);
  body.classList.remove(loadingClass);
}


async function fbLogin(authResponse) {
  fbButtonText.innerHTML = "Log out"
  fbToken = authResponse.signedRequest;

  try {
    FB.api(
      `/${authResponse.userID}/picture`,
      'GET',
      {
        redirect: 0,
        width: 200,
        height: 200
      },
      response => {
        setProfileImage(response.data.url);
      }
    );

    FB.api('/me', function(response) {
      loginPrompt.innerHTML = "You are currently logged in as " + response.name;
    });
  } catch (e) {
    loginPrompt.innerHTML = "You are currently logged in"
    console.error(e);
  }

  
  try {
    const data = await fetch(`${endpoint}/answers?auth=facebook&topic=${topic}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${fbToken}`
      }
    }).then(response => response.json());

    Object.entries(questions).forEach(([questionSlug, setAnswerSlug]) => {
      setAnswerSlug(data[questionSlug] || "");
    });

    getMatches(data);
  } catch (e) {
    console.error(e);
  }

  body.classList.remove(loadingClass);
}

function fbLogout () {
  setProfileImage("");
  fbToken = "";
  loginPrompt.innerHTML = "Log in to save your answers"
  fbButtonText.innerHTML = "Log in with Facebook"
  body.classList.remove(loadingClass);
}

fbButton.addEventListener("click", e => {
  FB.getLoginStatus(response => {
    if (response.status !== 'connected') {
      body.classList.add(loadingClass);

      FB.login(response => {
        if (response.status === 'connected') {
          fbLogin(response.authResponse);
        } else {
          body.classList.remove(loadingClass);
        }
      });
    } else {
      FB.logout();
      fbLogout();
    }
  });
});