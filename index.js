/**
 * FlagTrack - CTF Progress Tracker and Task Management Tool
 * Main entry point for programmatic usage
 */

const setup = require('./src/commands/setup');
const newtask = require('./src/commands/newtask');
const updateReadme = require('./src/commands/updateReadme');
const { loadConfig } = require('./src/utils/configManager');
const gitHelpers = require('./src/utils/gitHelpers');
const helpers = require('./src/utils/helpers');

module.exports = {
  commands: {
    setup,
    newtask,
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
