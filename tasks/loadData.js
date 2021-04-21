/*

Parses data

*/

const {rollup} = require("d3-array");

const policySheet = require("../data/policy-published.sheet.json");
const topicSheet = require("../data/topics.sheet.json");
const questionSheet = require("../data/questions.sheet.json");
const answerSheet = require("../data/answers.sheet.json");
const candidateSheet = require("../data/candidates.sheet.json");
const activeSheet = require("../data/active-candidates.sheet.json");

const apMonths = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function replacer(key, value) {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  } else {
    return value;
  }
}

function validate(data, validator) {
  const validated = data.reduce((validated, d) => {
    if (validator(d)) {
      validated.valid.push(d);
    } else {
      validated.invalid.push(d);
    }

    return validated;
  }, {valid: [], invalid: []});

  if (validated.invalid.length) {
    console.error(`${validated.invalid.length} invalid records!`, validated.invalid);
  }

  return validated.valid;
};

module.exports = function(grunt) {
  grunt.registerTask("data", "Builds data from downloaded Google Sheets", async function() {
    const done = this.async();

    try {
      await parse("data");
      done();
    } catch (error) {
      console.error(error);
      return grunt.fail.fatal("Download failed");
    }
  });

  async function parse(path) {
    const topicColumn = "topic";
    const candidateColumn = "candidate-slug";
    const candidateActiveColumn = "active";
    const topicActiveColumn = "active";
    const questionColumn = "question-slug";
    const answerColumn = "answer-slug";
    const questionTextColumn = "question-text";
    const answerTextColumn = "answer-text";
    const docColumn = "doc";
    const droppedOutColumn = "dropped-out";

    // Candidates
    const candidates = validate(candidateSheet, d => {
      return d[candidateColumn] && d[candidateActiveColumn] && d["first-name"] && d["last-name"] && d["label"] && d["party"];
    });
    const activeCandidates = candidates.filter(d => d[candidateActiveColumn] === "yes");
    const candidateSlugs = candidates.map(d => d[candidateColumn]);
    const activeCandidateSlugs = activeCandidates.map(d => d[candidateColumn]);
    const candidateData = rollup(activeCandidates, v => {
      const candidate = v[0];
      const droppedOut = candidate[droppedOutColumn] && new Date(candidate[droppedOutColumn]);
      const droppedOutString = droppedOut && `${apMonths[droppedOut.getUTCMonth()]} ${droppedOut.getUTCDate()}` || "";

      return {
        name: candidate["first-name"] + " " + candidate["last-name"],
        lastName: candidate["last-name"], 
        label: candidate["label"],
        image: candidate["image"],
        party: candidate["party"],
        droppedOut: droppedOutString,
        droppedOutDate: candidate[droppedOutColumn]
      };
    }, d => d[candidateColumn]);

    // Topics
    const topics = validate(topicSheet, d => {
      return d[topicColumn] && d[topicActiveColumn];
    });
    const activeTopics = topics.filter(d => d[topicActiveColumn] === "yes");
    const topicSlugs = topics.map(d => d[topicColumn]);

    // Topic candidates
    const topicCandidates = validate(activeSheet, d => {
      return activeCandidateSlugs.indexOf(d[candidateColumn]) > -1
        && topicSlugs.indexOf(d[topicColumn]) > -1;
    });
    const topicCandidateData = rollup(
      topicCandidates,
      v => v.map(d => d[candidateColumn]),
      d => d[topicColumn]
    );
    
    // Topic data
    const topicData = activeTopics.map(d => {
      const idMatches = d[docColumn].match(/docs\.google\.com\/document\/d\/(.+)\//i);
      const id = idMatches && idMatches[1];

      return {
        topic: d[topicColumn],
        doc: id,
        candidates: topicCandidateData.get(d[topicColumn])
      };
    });

    const topicDisplayData = Object.fromEntries(activeTopics.map(d => {
      return [d[topicColumn], {
        color: d["color"],
        background: d["background"],
        label: d["label"]
      }];
    }));

    // Questions
    const questions = validate(questionSheet, d => {
      return topicSlugs.indexOf(d[topicColumn]) > -1
        && d[questionColumn] && d[questionTextColumn];
    });
    const questionSlugs = rollup(
      questions,
      v => v.map(d => d[questionColumn]),
      d => d[topicColumn]
    );
    const questionData = rollup(
      questions,
      v => v[0][questionTextColumn],
      d => d[topicColumn],
      d => d[questionColumn]
    );

    // Answers
    const answers = validate(answerSheet, d => {
      const questions = questionSlugs.get(d[topicColumn]);
      return questions && questions.indexOf(d[questionColumn]) > -1 
        && d[answerColumn] && d[answerTextColumn];
    });
    const answerSlugs = rollup(
      answers, 
      v => v.map(d => d[answerColumn]), 
      d => d[topicColumn], 
      d => d[questionColumn]
    );
    const answerData = rollup(
      answers,
      v => v[0][answerTextColumn],
      d => d[topicColumn],
      d => d[questionColumn],
      d => d[answerColumn]
    );
    
    // Positions
    const positions = validate(policySheet, d => {
      const questions = answerSlugs.get(d[topicColumn]);
      const answers = questions && questions.get(d[questionColumn]);

      return answers && answers.indexOf(d[answerColumn]) > -1 
        && candidateSlugs.indexOf(d[candidateColumn]) > -1;
    });
    const positionData = rollup(
      positions, 
      v => v.reduce((v, d) => {
        const date = d.date && new Date(d.date);
        const dateString = date && `${apMonths[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}` || "";

        if (activeCandidateSlugs.indexOf(d[candidateColumn]) > -1) {
          return v.concat({
            slug: d["candidate-slug"],
            quote: d["quote"],
            source: d["setting"],
            date: dateString,
            url: d["source"]
          });
        } else {
          return v;
        }
      }, []), 
      d => d[topicColumn], 
      d => d[questionColumn], 
      d => d[answerColumn]
    );

    console.log(`Saving data`);
    grunt.file.write(`${path}/topicData.json`, JSON.stringify(topicData, replacer, 2));
    grunt.file.write(`${path}/topicDisplayData.json`, JSON.stringify(topicDisplayData, replacer, 2));
    grunt.file.write(`${path}/candidateData.json`, JSON.stringify(candidateData, replacer, 2));
    grunt.file.write(`${path}/questionData.json`, JSON.stringify(questionData, replacer, 2));
    grunt.file.write(`${path}/answerData.json`, JSON.stringify(answerData, replacer, 2));
    grunt.file.write(`${path}/answerSlugs.json`, JSON.stringify(answerSlugs, replacer, 2));
    grunt.file.write(`${path}/positionData.json`, JSON.stringify(positionData, replacer, 2));
  }
}