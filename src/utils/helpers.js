const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { findRepoRoot } = require('./gitHelpers');
const YAML = require('yaml');

/**
 * Convert a string to slug format (lowercase, underscores for spaces)
 * @param {string} str The string to slugify
 * @returns {string} The slugified string
 */
function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')    // Replace spaces with underscores
    .replace(/[^\w\-_]/g, '') // Remove non-word characters
    .replace(/\-+/g, '_');    // Replace multiple dashes with single underscore
}

/**
 * Checks if we're within a known event structure under the repo root.
 * Returns:
 *  - depth: how far we are from the repo root
 *  - eventName: name of the top-level event folder (if found)
 *  - path: current working directory
 *
 * @param {Object} config - Loaded event config
 * @returns {Promise<{ depth: number, eventName: string|null, path: string }>}
 */
async function getEventContext(config) {
  const repoRoot = await findRepoRoot();
  const cwd = process.cwd();

  const relativePath = path.relative(repoRoot, cwd);
  const depth = relativePath === '' ? 0 : relativePath.split(path.sep).length;
  const segments = relativePath.split(path.sep);

  let eventName = null;

  if (depth >= 1 && config?.events) {
    const possibleevent = segments[0];
    if (config.events[possibleevent]) {
      eventName = possibleevent;
    }
  }

  return {
    depth,
    eventName,
    path: cwd,
  };
}

// Helper function to format directory names with numbering and replace spaces with hyphens
function formatDirectoryName(name, index) {
  // Add numbering prefix
  return `${String(index).padStart(2, '0')}_${slugify(name)}`;
}

/**
 * Lets user pick an event and sub-event, with folder detection logic.
 * @param {Object} config - The parsed config object
 * @returns {Promise<{ eventName: string, subEventName: string }>}
 */
async function pickEvent(config) {
  const eventNames = config?.events ? Object.keys(config.events) : [];

  const NEW_EVENT_LABEL = chalk.greenBright('Create New Event');
  const choices = [NEW_EVENT_LABEL, ...eventNames];

  const { selectedEvent } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedEvent',
      message: chalk.blueBright('Select an event to work with:'),
      choices,
    },
  ]);

  let finalEventName = selectedEvent;
  let subEventName = null;

  if (selectedEvent === NEW_EVENT_LABEL) {
    // Prompt for new event name
    const { newEventName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newEventName',
        message: chalk.yellow('Enter a name for the new event:'),
        validate: (input) => {
          if (!input.trim()) return 'Event name cannot be empty.';
          if (eventNames.includes(input)) return 'Event already exists.';
          return true;
        },
      },
    ]);

    // Prompt for initial sub-event name
    const { newSubEventName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newSubEventName',
        message: chalk.yellow('Enter a name for the first sub-event (e.g. "01_Qualifier"):'),
        validate: (input) => input.trim() ? true : 'Sub-event name cannot be empty.',
      },
    ]);

    finalEventName = newEventName;
    subEventName = newSubEventName;
  } else {
    // Existing event → check current directory for matching sub-event
    const cwd = path.basename(process.cwd());
    const subEvents = Object.keys(config.events[finalEventName]?.sub_events || {});

    if (subEvents.includes(cwd)) {
      subEventName = cwd;
      console.log(chalk.green(`📁 Detected sub-event folder: ${cwd}`));
    } else {
      // Prompt user to pick one
      const { selectedSubEvent } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSubEvent',
          message: chalk.magenta('Select a sub-event to work with:'),
          choices: subEvents,
        },
      ]);
      subEventName = selectedSubEvent;
    }
  }

  return {
    eventName: finalEventName,
    subEventName,
  };
}

/**
 * Prompt user for categories, then add them to the config under the given event and sub-event.
 *
 * @param {string} eventName - Main event name (e.g. "First")
 * @param {string} subEvent - Sub-event or stage name (e.g. "01_Final")
 * @param {Object} config - The loaded config object
 * @param {string} configPath - Full path to the config.yml file
 */
async function addCategoriesToSubEvent(eventName, subEvent, config, configPath) {
  if (!config.events?.[eventName]) {
    throw new Error(`Event "${eventName}" does not exist in config.`);
  }

  const event = config.events[eventName];

  if (!event.sub_events) {
    event.sub_events = {};
  }

  if (!event.sub_events[subEvent]) {
    event.sub_events[subEvent] = {
      originalName: subEvent,
      categories: {}
    };
  }

  const { newCategories } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newCategories',
      message: `Enter categories for ${eventName} > ${subEvent} (comma-separated):`,
      validate: input => input.trim() ? true : 'Please enter at least one category.',
    },
  ]);

  const categoryList = newCategories
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  const existingCats = event.sub_events[subEvent].categories;

  categoryList.forEach(cat => {
    if (!existingCats[cat]) {
      existingCats[cat] = cat;
    }
  });

  const yamlText = YAML.stringify(config);
  await fs.writeFile(configPath, yamlText, 'utf-8');

  console.log(`✅ Categories added to ${eventName} > ${subEvent}:`, categoryList);
}

module.exports = {
  slugify,
  getEventContext,
  formatDirectoryName,
  pickEvent,
  addCategoriesToSubEvent
};
