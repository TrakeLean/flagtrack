const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const YAML = require('yaml');
const { createGitHubActions, isGitRepo, findRepoRoot } = require('../utils/gitHelpers');
const { createConfig, saveConfig } = require('../utils/configManager');

async function setup() {
  console.log(chalk.blue('🚩 Setting up a new CTF project'));
  
  // Check if we're in a git repository
  if (!await isGitRepo()) {
    console.log(chalk.yellow('⚠️ Warning: Not in a git repository. Some features may not work properly.'));
    console.log(chalk.yellow('Consider initializing a git repository with `git init`.'));
  }
  
  try {
    // Get CTF details from user
    const mainAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'mainCtfName',
        message: 'Main CTF Name (e.g., Cyberlandslaget):',
        validate: input => input.trim() ? true : 'Main CTF name is required'
      },
      {
        type: 'confirm',
        name: 'setupGithubActions',
        message: 'Set up GitHub Actions for automatic README updates?',
        default: true
      },
      {
        type: 'input',
        name: 'parentDir',
        message: 'Parent directory for CTF challenges (optional):',
        default: ''
      },
      {
        type: 'confirm',
        name: 'hasSubEvents',
        message: 'Does this CTF have multiple events/rounds (e.g., Qualification, Finals)?',
        default: true
      }
    ]);
    
    let ctfStructure = {};
    
    if (mainAnswers.hasSubEvents) {
      // Get sub-events
      const subEventsAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'subEvents',
          message: 'Enter sub-events/rounds (comma-separated, e.g., "Qualification, Semi Final, Final"):',
          validate: input => input.trim() ? true : 'At least one sub-event is required',
          filter: input => input.split(',').map(item => item.trim()).filter(item => item)
        }
      ]);
      
      // For each sub-event, prompt for challenge categories
      for (const subEvent of subEventsAnswers.subEvents) {
        const subEventAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'categories',
            message: `Enter challenge categories for "${subEvent}" (comma-separated, e.g., "Web, Crypto, Forensics"):`,
            validate: input => input.trim() ? true : 'At least one category is required',
            filter: input => input.split(',').map(item => item.trim()).filter(item => item)
          }
        ]);
        
        // Add to structure
        ctfStructure[subEvent] = {
          categories: subEventAnswers.categories.reduce((obj, cat, index) => {
            obj[index + 1] = cat;
            return obj;
          }, {})
        };
      }
    } else {
      // Just get categories for the main CTF
      const categoriesAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'categories',
          message: 'Enter challenge categories (comma-separated, e.g., "Web, Crypto, Forensics"):',
          validate: input => input.trim() ? true : 'At least one category is required',
          filter: input => input.split(',').map(item => item.trim()).filter(item => item)
        }
      ]);
      
      // Add to structure
      ctfStructure = {
        categories: categoriesAnswer.categories.reduce((obj, cat, index) => {
          obj[index + 1] = cat;
          return obj;
        }, {})
      };
    }
    
    // Create config object
    const ctfConfig = createConfig({
      ctfName: mainAnswers.mainCtfName,
      structure: ctfStructure,
      parentDir: mainAnswers.parentDir || null
    });
    
    // Save the config
    await saveConfig(ctfConfig);
    console.log(chalk.green('✅ Configuration saved'));
    
    // Set up GitHub Actions if requested
    if (mainAnswers.setupGithubActions) {
      const repoRoot = await findRepoRoot();
      if (repoRoot) {
        await createGitHubActions(repoRoot);
        console.log(chalk.green('✅ GitHub Actions workflow created'));
      } else {
        console.log(chalk.yellow('⚠️ Could not find repository root. GitHub Actions setup skipped.'));
      }
    }
    
    console.log(chalk.blue('\n🏁 Setup complete! Run `flagtrack create` to create your first task.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

module.exports = setup;