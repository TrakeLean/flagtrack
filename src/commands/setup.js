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
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'ctfName',
        message: 'CTF Name:',
        validate: input => input.trim() ? true : 'CTF name is required'
      },
      {
        type: 'confirm',
        name: 'setupGithubActions',
        message: 'Set up GitHub Actions for automatic README updates?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'categories',
        message: 'Select categories for this CTF:',
        choices: [
          { name: 'Crypto', checked: true },
          { name: 'Forensics', checked: true },
          { name: 'Misc', checked: true },
          { name: 'Pwn', checked: true },
          { name: 'Rev', checked: true },
          { name: 'Web', checked: true },
          { name: 'OSINT', checked: false },
          { name: 'Steganography', checked: false }
        ],
        validate: input => input.length > 0 ? true : 'Please select at least one category'
      },
      {
        type: 'input',
        name: 'parentDir',
        message: 'Parent directory for CTF challenges (optional):',
        default: ''
      }
    ]);
    
    // Create config object
    const ctfConfig = createConfig({
      ctfName: answers.ctfName,
      categories: answers.categories.reduce((obj, cat, index) => {
        obj[index + 1] = cat;
        return obj;
      }, {}),
      parentDir: answers.parentDir || null
    });
    
    // Save the config
    await saveConfig(ctfConfig);
    console.log(chalk.green('✅ Configuration saved'));
    
    // Set up GitHub Actions if requested
    if (answers.setupGithubActions) {
      const repoRoot = await findRepoRoot();
      if (repoRoot) {
        await createGitHubActions(repoRoot);
        console.log(chalk.green('✅ GitHub Actions workflow created'));
      } else {
        console.log(chalk.yellow('⚠️ Could not find repository root. GitHub Actions setup skipped.'));
      }
    }
    
    console.log(chalk.blue('\n🏁 Setup complete! Run `flagtrack newtask` to create your first task.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

module.exports = setup;
