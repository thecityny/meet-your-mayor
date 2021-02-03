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
    // Candidates
    const candidates = validate(candidateSheet, d => {
      return d["candidate-slug"];
    });
    const candidateSlugs = candidates.map(d => d["candidate-slug"]);
    const candidateData = rollup(candidates, v => {
      const {name, label, image} = v[0];
      return {name, label, image};
    }, d => d["candidate-slug"]);

    // Answers
    const answers = validate(answerSheet, d => {
      return d["topic"] && d["question"] && d["answer"];
    });
    const answerData = rollup(
      answers, 
      v => v.map(d => d["answer"]), 
      d => d["topic"], 
      d => d["question"]
    );
    
    // Policies
    const policies = validate(policySheet, d => {
      const questions = answerData.get(d["topic"]);
      const answers = questions && questions.get(d["question"]);

      return answers && answers.indexOf(d["answer"]) > -1 
        && candidateSlugs.indexOf(d["candidate-slug"]);
    });
    const policyData = rollup(
      policies, 
      v => v.reduce((v, d) => d["candidate-slug"] ? v.concat(d["candidate-slug"]) : v, []), 
      d => d["topic"], 
      d => d["question"], 
      d => d["answer"]
    );

    console.log(`Saving data`);
    grunt.file.write(`${path}/candidates.json`, JSON.stringify(candidateData, replacer, 2));
    grunt.file.write(`${path}/positions.json`, JSON.stringify(policyData, replacer, 2));
  }
}