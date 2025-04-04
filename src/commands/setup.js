const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const YAML = require('yaml');
const { createGitHubActions, isGitRepo, findRepoRoot } = require('../utils/gitHelpers');
const { createConfig, saveConfig, loadConfig, configExists } = require('../utils/configManager');
const { formatDirectoryName } = require('../utils/helpers');

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
    let proceedWithExisting = false;
    
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
      
      if (continueAnswer.addEvent) {
        proceedWithExisting = true;
      } else {
        // If they don't want to add to existing project, start a new one
        console.log(chalk.blue('Starting setup for a new CTF project instead.'));
        existingConfig = null;
        proceedWithExisting = false;
      }
    }
    
    if (proceedWithExisting) {
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
          validate: input => {
            const value = String(input).trim();
            return value ? true : 'At least one category is required';
          },
          filter: input => {
            // Convert the input string to an array of trimmed, non-empty strings
            return String(input)
              .split(',')
              .map(item => item.trim())
              .filter(Boolean);
          }
        }
      ]);
      
      // Create structure for new event if it doesn't exist yet
      if (!existingConfig.structure) {
        existingConfig.structure = {};
      }
      
      // Get the highest existing index to determine the next index
      let maxIndex = 0;
      Object.keys(existingConfig.structure || {}).forEach(key => {
        // Extract index from keys like "01_EventName"
        const match = key.match(/^(\d+)_/);
        if (match && match[1]) {
          const index = parseInt(match[1], 10);
          if (index > maxIndex) {
            maxIndex = index;
          }
        }
      });
      
      const formattedEventName = formatDirectoryName(eventAnswer.eventName, maxIndex + 1);
      
      // Create a copy of the existing structure and add the new event
      const updatedStructure = {
        ...existingConfig.structure
      };
      
      updatedStructure[formattedEventName] = {
        originalName: eventAnswer.eventName, // Add the original name
        categories: categoriesAnswer.categories.reduce((obj, cat, index) => {
          const formattedCatName = formatDirectoryName(cat, index + 1);
          obj[formattedCatName] = cat;
          return obj;
        }, {})
      };
      
      // Update the structure in the config (don't replace the entire config)
      existingConfig.structure = updatedStructure;
      
      // Remove unnecessary fields
      delete existingConfig.createdAt;
      
      // Fix parentDir - try to find git repo root first, then fallback to current directory
      try {
        const repoRoot = await findRepoRoot();
        if (repoRoot) {
          // Use relative path from current directory to repo root
          existingConfig.parentDir = path.relative(process.cwd(), repoRoot) || '.';
        } else if (existingConfig.parentDir === existingConfig.ctfName) {
          // If no repo root and parentDir is set to CTF name, use current directory
          existingConfig.parentDir = '.';
        }
      } catch (error) {
        // If any error occurs and parentDir is equal to CTF name, use current directory
        if (existingConfig.parentDir === existingConfig.ctfName) {
          existingConfig.parentDir = '.';
        }
      }
      
      // Save updated config with verification
      try {
        await saveConfig(existingConfig);
        
        // Verify the save was successful
        const verifyConfig = await loadConfig();
        if (!verifyConfig || !verifyConfig.structure || !verifyConfig.structure[formattedEventName]) {
          console.log(chalk.yellow('⚠️ Config verification failed - forcing config rewrite'));
          await saveConfig(existingConfig);
        }
      } catch (saveError) {
        console.error(chalk.red('❌ Error saving configuration:'), saveError.message);
        
        // Retry saving with direct file writing
        try {
          console.log(chalk.yellow('Retrying configuration save directly...'));
          const configPath = path.join(process.cwd(), '.flagtrackrc');
          const yamlContent = YAML.stringify(existingConfig);
          await fs.writeFile(configPath, yamlContent, 'utf8');
          console.log(chalk.green('✅ Configuration saved on retry'));
        } catch (retryError) {
          console.error(chalk.red('❌ Final error saving configuration:'), retryError.message);
        }
      }
      
      // Create directory structure for the new event
      try {
        // Determine parent directory path
        const parentDirPath = existingConfig.parentDir === '.' 
          ? path.resolve(process.cwd())
          : path.resolve(process.cwd(), existingConfig.parentDir);
        
        // Create event directory
        const eventDirPath = path.join(parentDirPath, existingConfig.ctfName, formattedEventName);
        await fs.ensureDir(eventDirPath);
        console.log(chalk.green(`✅ Created event directory: ${formattedEventName}`));
        
        // Create category directories
        let catIndex = 1;
        for (const cat of categoriesAnswer.categories) {
          const formattedCatName = formatDirectoryName(cat, catIndex);
          const catDirPath = path.join(eventDirPath, formattedCatName);
          await fs.ensureDir(catDirPath);
          console.log(chalk.green(`✅ Created category directory: ${formattedCatName}`));
          catIndex++;
        }
      } catch (dirError) {
        console.error(chalk.red('❌ Error creating directory structure:'), dirError.message);
      }
      
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
      
      // Set parent directory to the repository root or current directory
      let parentDir;
      try {
        // Try to find the git repository root as the parent directory
        const repoRoot = await findRepoRoot();
        if (repoRoot) {
          // Use relative path from current directory to repo root
          parentDir = path.relative(process.cwd(), repoRoot) || '.';
        } else {
          // Fallback to current directory
          parentDir = '.';
        }
      } catch (error) {
        // If any error occurs, fallback to current directory
        parentDir = '.';
      }
      
      const categoriesAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'categories',
          message: `Enter challenge categories for "${mainAnswers.eventName}" (comma-separated, e.g., "Web, Crypto, Forensics"):`,
          validate: input => {
            const value = String(input).trim();
            return value ? true : 'At least one category is required';
          },
          filter: input => {
            // Convert the input string to an array of trimmed, non-empty strings
            return String(input)
              .split(',')
              .map(item => item.trim())
              .filter(Boolean);
          }
        }
      ]);
      
      // Format the event name with numbering
      const formattedEventName = formatDirectoryName(mainAnswers.eventName, 1);
      if (!formattedEventName) {
        console.error(chalk.red('❌ formatDirectoryName() returned empty or invalid string'));
      }
      
      // Create structure for the new CTF
      const ctfStructure = {};
      ctfStructure[formattedEventName] = {
        originalName: mainAnswers.eventName, // Add the original name
        categories: categoriesAnswer.categories.reduce((obj, cat, index) => {
          const formattedCatName = formatDirectoryName(cat, index + 1);
          obj[formattedCatName] = cat;
          return obj;
        }, {})
      };
      
      // Create config object directly with all needed properties
      const ctfConfig = {
        ctfName: mainAnswers.mainCtfName,
        parentDir,
        structure: ctfStructure
      };
      
      // Save the config before creating directories to ensure it exists
      try {
        await saveConfig(ctfConfig);
        console.log(chalk.green('✅ Configuration saved'));
      } catch (configError) {
        console.error(chalk.red('❌ Error saving configuration:'), configError.message);
        console.log(chalk.yellow('Retrying configuration save...'));
        
        // Retry with a delay and more verbose error handling
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Try to manually create the config file if the normal save failed
          const configPath = path.join(process.cwd(), '.flagtrackrc');
          const yamlContent = YAML.stringify(ctfConfig);
          await fs.writeFile(configPath, yamlContent, 'utf8');
          console.log(chalk.green('✅ Configuration saved on retry'));
        } catch (retryError) {
          console.error(chalk.red('❌ Final error saving configuration:'), retryError.message);
          throw new Error('Unable to save configuration file');
        }
      }
      
      // Create the main directory structure
      try {
        // Create the main CTF directory
        const mainDirPath = parentDir === '.' 
          ? path.resolve(process.cwd(), mainAnswers.mainCtfName)
          : path.resolve(process.cwd(), parentDir, mainAnswers.mainCtfName);

        await fs.ensureDir(mainDirPath);
        console.log(chalk.green(`✅ Created main directory: ${mainAnswers.mainCtfName}`));
        
        // Create event directory
        const eventDirPath = path.join(mainDirPath, formattedEventName);
        await fs.ensureDir(eventDirPath);
        console.log(chalk.green(`✅ Created event directory: ${formattedEventName}`));
        
        // Create category directories
        let catIndex = 1;
        for (const cat of categoriesAnswer.categories) {
          const formattedCatName = formatDirectoryName(cat, catIndex);
          const catDirPath = path.join(eventDirPath, formattedCatName);
          await fs.ensureDir(catDirPath);
          console.log(chalk.green(`✅ Created category directory: ${formattedCatName}`));
          catIndex++;
        }
        
        // Verify the config was properly written
        try {
          const verifyConfig = await loadConfig();
          if (!verifyConfig || !verifyConfig.structure || !verifyConfig.structure[formattedEventName]) {
            console.log(chalk.yellow('⚠️ Config verification failed - forcing config rewrite'));
            await saveConfig(ctfConfig);
          }
        } catch (verifyError) {
          console.error(chalk.red('⚠️ Config verification error:'), verifyError.message);
          // One final attempt to save the config
          await saveConfig(ctfConfig);
        }
      } catch (dirError) {
        console.error(chalk.red('❌ Error creating directory structure:'), dirError.message);
      }
      
      // Check if GitHub Actions are already set up
      try {
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
      } catch (githubError) {
        console.error(chalk.yellow('⚠️ Error setting up GitHub Actions:'), githubError.message);
      }
    }
    
    console.log(chalk.blue('\n🏁 Setup complete! Run `flagtrack create` to create your first task.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

module.exports = setup;