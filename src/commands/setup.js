const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const YAML = require('yaml');
const { createGitHubActions, isGitRepo, findRepoRoot } = require('../utils/gitHelpers');
const { initConfig, saveConfig, loadConfig, configExists, getConfigPath } = require('../utils/configManager');
const { formatDirectoryName, slugify, pickEvent, getEventContext, addCategoriesToSubEvent } = require('../utils/helpers');

async function setup() {
  console.log(chalk.blue('=== Setting up 🚩🏃‍♂️ ==='));

  // Check if we're in a git repository
  if (!await isGitRepo()) {
    console.log(chalk.yellow('⚠️ Error: Not in a git repository. Some features will not work properly.'));
    console.log(chalk.yellow('Please initialize a git repository with `git init`.'));
    exit(1);
  }
  // Store directory deepness
  const eventContext = await getEventContext();
  
  // Check if we're in an existing event project directory
  const isExistingProject = await configExists();
  const createNewEvent = false;
  const createNewSubEvent = false;

  const eventName = null
  const subEventName = null

  // If we have an existing config
  if (isExistingProject){
    const config =  await loadConfig();
    const configPath = await getConfigPath()

    // Check if we are in root
    if (!eventContext.depth){
      eventName, subEventName = await pickEvent(config);
      // If we want to create new main event
      if (eventName == "New"){
        createNewEvent = true;
        createNewSubEvent = true;
      } else {
        createNewSubEvent = true;
      }
    // We are not in root
    } else {
      // Setup categories
    }

  } else {
    // Setup config structure, github actions
    const config =  await initConfig();
    const configPath = await getConfigPath()
    createNewEvent = true;
    createNewSubEvent = true;
  }
  // Add new event
  if (createNewEvent){
    createGitHubActions()
  }
  // Add categories
  if (createNewSubEvent){
    await addCategoriesToSubEvent(eventName, subEventName, config, configPath);
  }
  // Create categories
}

module.exports = setup;