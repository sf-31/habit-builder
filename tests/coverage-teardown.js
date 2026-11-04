const MCR = require('monocart-coverage-reports');
const options = require('./coverage-options');

// Fails the run unless every line of app/js/*.js and tasks.js was executed.
module.exports = async () => {
  const results = await MCR(options).generate();
  const pct = results?.summary?.lines?.pct;
  if (pct !== 100) {
    throw new Error(`Line coverage is ${pct}%, expected 100%. See coverage/index.html.`);
  }
};
