const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const YAML = require('yaml');
const { createGitHubActions, isGitRepo, findRepoRoot } = require('../utils/gitHelpers');
const { createConfig, saveConfig, loadConfig, configExists } = require('../utils/configManager');

async function setup() {
  console.log(chalk.blue('🚩 Setting up a CTF project'));
  
  // Check if we're in a git repository
  if (!await isGitRepo()) {
    console.log(chalk.yellow('⚠️ Warning: Not in a git repository. Some features may not work properly.'));
    console.log(chalk.yellow('Consider initializing a git repository with `git init`.'));
  }
  
  try {
    // Check if we're in an existing CTF project directory
    const isExistingProject = await configExists();
    let existingConfig = null;
    
    if (isExistingProject) {
      existingConfig = await loadConfig();
      console.log(chalk.blue(`Found existing CTF project: ${existingConfig.ctfName}`));
      
      const continueAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addEvent',
          message: `Do you want to add a new event/round to "${existingConfig.ctfName}"?`,
          default: true
        }
      ]);
      
      if (!continueAnswer.addEvent) {
        // If they don't want to add to existing project, start a new one
        console.log(chalk.blue('Starting setup for a new CTF project instead.'));
        existingConfig = null;
      }
    }
    
    if (existingConfig) {
      // Add a new event to existing CTF project
      const eventAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'eventName',
          message: 'Name of the new event/round:',
          validate: input => input.trim() ? true : 'Event name is required'
        }
      ]);
      
      const categoriesAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'categories',
          message: `Enter challenge categories for "${eventAnswer.eventName}" (comma-separated, e.g., "Web, Crypto, Forensics"):`,
          validate: input => input.trim() ? true : 'At least one category is required',
          filter: input => {
            if (!input) return [];
            
            if (typeof input === 'string') {
              return input.split(',').map(item => item.trim()).filter(Boolean);
            }
            
            if (Array.isArray(input)) {
              return input.map(item => 
                typeof item === 'string' ? item.trim() : String(item)
              ).filter(Boolean);
            }
            
            return [String(input)];
          }
        }
      ]);
      
      // Create structure for new event
      if (!existingConfig.structure) {
        existingConfig.structure = {};
      }
      
      existingConfig.structure[eventAnswer.eventName] = {
        categories: categoriesAnswer.categories.reduce((obj, cat, index) => {
          obj[index + 1] = cat;
          return obj;
        }, {})
      };
      
      // Save updated config
      await saveConfig(existingConfig);
      console.log(chalk.green(`✅ Added "${eventAnswer.eventName}" to "${existingConfig.ctfName}"`));
      
    } else {
      // Set up a new CTF project
      const mainAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'mainCtfName',
          message: 'CTF Name:',
          validate: input => input.trim() ? true : 'CTF name is required'
        },
        {
          type: 'input',
          name: 'eventName',
          message: 'Name of the first event/round:',
          validate: input => input.trim() ? true : 'Event name is required'
        }
      ]);
      
      // Set parent directory to the main CTF name
      const parentDir = mainAnswers.mainCtfName;
      
      const categoriesAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'categories',
          message: `Enter challenge categories for "${mainAnswers.eventName}" (comma-separated, e.g., "Web, Crypto, Forensics"):`,
          validate: input => input.trim() ? true : 'At least one category is required',
          filter: input => {
            if (!input) return [];
            
            if (typeof input === 'string') {
              return input.split(',').map(item => item.trim()).filter(Boolean);
            }
            
            if (Array.isArray(input)) {
              return input.map(item => 
                typeof item === 'string' ? item.trim() : String(item)
              ).filter(Boolean);
            }
            
            return [String(input)];
          }
        }
      ]);
      
      // Create structure for the new CTF
      const ctfStructure = {};
      ctfStructure[mainAnswers.eventName] = {
        categories: categoriesAnswer.categories.reduce((obj, cat, index) => {
          obj[index + 1] = cat;
          return obj;
        }, {})
      };
      
      // Create config object
      const ctfConfig = createConfig({
        ctfName: mainAnswers.mainCtfName,
        structure: ctfStructure,
        parentDir
      });
      
      // Save the config
      await saveConfig(ctfConfig);
      console.log(chalk.green('✅ Configuration saved'));
      
      // Check if GitHub Actions are already set up
      const repoRoot = await findRepoRoot();
      if (repoRoot) {
        const githubDirExists = await fs.pathExists(path.join(repoRoot, '.github'));
        
        if (!githubDirExists) {
          const githubAnswer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'setupGithubActions',
              message: 'Set up GitHub Actions for automatic README updates?',
              default: true
            }
          ]);
          
          if (githubAnswer.setupGithubActions) {
            await createGitHubActions(repoRoot);
            console.log(chalk.green('✅ GitHub Actions workflow created'));
          }
        } else {
          console.log(chalk.blue('ℹ️ GitHub directory already exists. Skipping GitHub Actions setup.'));
        }
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