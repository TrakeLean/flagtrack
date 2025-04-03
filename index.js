/**
 * FlagTrack - CTF Progress Tracker and Task Management Tool
 * Main entry point for programmatic usage
 */

const setup = require('./src/commands/setup');
const newtask = require('./src/commands/newtask');
const endtask = require('./src/commands/endtask');
const updateReadme = require('./src/commands/updateReadme');
const { loadConfig } = require('./src/utils/configManager');
const gitHelpers = require('./src/utils/gitHelpers');
const helpers = require('./src/utils/helpers');

module.exports = {
  commands: {
    setup,
    newtask,
    endtask,
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
