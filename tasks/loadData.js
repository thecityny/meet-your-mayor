/*

Parses data

*/

const {rollup} = require("d3-array");

const policySheet = require("../data/policy.sheet.json");
const answerSheet = require("../data/q-and-a.sheet.json");
const candidateSheet = require("../data/candidates.sheet.json");

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
    const questionColumn = "question-slug";
    const answerColumn = "answer-slug";

    // Candidates
    const candidates = validate(candidateSheet, d => {
      return d[candidateColumn];
    });
    const candidateSlugs = candidates.map(d => d[candidateColumn]);
    const candidateData = rollup(candidates, v => {
      const {name, label, image} = v[0];
      return {name, label, image};
    }, d => d[candidateColumn]);

    // Answers
    const answers = validate(answerSheet, d => {
      return d[topicColumn] && d[questionColumn] && d[answerColumn];
    });
    const answerData = rollup(
      answers, 
      v => v.map(d => d[answerColumn]), 
      d => d[topicColumn], 
      d => d[questionColumn]
    );
    
    // Policies
    const policies = validate(policySheet, d => {
      const questions = answerData.get(d[topicColumn]);
      const answers = questions && questions.get(d[questionColumn]);

      return answers && answers.indexOf(d[answerColumn]) > -1 
        && candidateSlugs.indexOf(d[candidateColumn]) > -1;
    });
    const policyData = rollup(
      policies, 
      v => v.reduce((v, d) => d[candidateColumn] ? v.concat({
        slug: d["candidate-slug"],
        quote: d["quote"],
        source: d["setting"],
        url: d["source"]
      }) : v, []), 
      d => d[topicColumn], 
      d => d[questionColumn], 
      d => d[answerColumn]
    );

    console.log(`Saving data`);
    grunt.file.write(`${path}/candidates.json`, JSON.stringify(candidateData, replacer, 2));
    grunt.file.write(`${path}/positions.json`, JSON.stringify(policyData, replacer, 2));
  }
}