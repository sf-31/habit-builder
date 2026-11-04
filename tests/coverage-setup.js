const MCR = require('monocart-coverage-reports');
const options = require('./coverage-options');

module.exports = async () => {
  MCR(options).cleanCache();
};
