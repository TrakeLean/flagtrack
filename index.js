/**
 * FlagTrack - CTF Progress Tracker and Task Management Tool
 * Main entry point for programmatic usage
 */

const setup = require('./src/commands/setup');
const create = require('./src/commands/create');
const solve = require('./src/commands/solve');
const updateReadme = require('./src/commands/updateReadme');
const { loadConfig } = require('./src/utils/configManager');
const gitHelpers = require('./src/utils/gitHelpers');
const helpers = require('./src/utils/helpers');

module.exports = {
  commands: {
    setup,
    create,
    solve,
    updateReadme
  },
  utils: {
    config: {
      loadConfig
    },
    git: gitHelpers,
    helpers
  }
};
