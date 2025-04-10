const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const simpleGit = require('simple-git');
const { loadConfig } = require('../utils/configManager');
const { findRepoRoot, isGitRepo, getCurrentBranch, getGitUserName } = require('../utils/gitHelpers');
const { slugify, getEventContext } = require('../utils/helpers');

async function create() {
  console.log(chalk.blue('🧩 Creating a new event challenge task'));
  
  try {
    // Load config
    const config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('⚠️ No configuration found. Run `flagtrack setup` first.'));
      process.exit(1);
    }
    
    // Determine current working directory and check if we're in a event directory
    const currentDir = process.cwd();
    const eventRoot = config.parentDir ? path.resolve(config.parentDir) : null;
    
    // Get the event structure from config
    const structure = config.structure || {};
    
    // Get all event names from the structure
    const eventNames = Object.keys(structure);
    
    // Detect if we're in an event directory by checking if current directory name matches any event
    const currentDirName = path.basename(currentDir);
    let selectedEvent = null;
    
    // Check if we're in a event directory
    const isInEvent = eventNames.includes(currentDirName);
    
    if (isInEvent) {
      // We're already in an event directory
      selectedEvent = currentDirName;
      console.log(chalk.blue(`Working in event directory: ${selectedEvent}`));
    } else {
      // We're not in an event directory, check if we're in the event root or somewhere else
      const parentDir = path.dirname(currentDir);
      const parentDirName = path.basename(parentDir);
      
      if (parentDirName === config.eventName || currentDirName === config.eventName) {
        // We're either in the event root directory or one level below it
        // Ask user which event to work with
        const { event } = await inquirer.prompt([
          {
            type: 'list',
            name: 'event',
            message: 'Select an event/round to create a task for:',
            choices: eventNames
          }
        ]);
        selectedEvent = event;
      } else {
        // We're not in any recognizable event directory
        console.log(chalk.yellow('⚠️ Not in a recognized event directory.'));
        
        // Ask user which event to work with
        const { event } = await inquirer.prompt([
          {
            type: 'list',
            name: 'event',
            message: 'Select an event/round to create a task for:',
            choices: eventNames
          }
        ]);
        selectedEvent = event;
      }
    }
    
    // Get categories for the selected event
    const eventCategories = structure[selectedEvent]?.categories || {};
    
    // Format categories for display
    const categoryChoices = Object.entries(eventCategories).map(([key, value]) => ({
      name: `${value}`,
      value: value
    }));
    
    if (categoryChoices.length === 0) {
      console.log(chalk.red(`❌ No categories found for event "${selectedEvent}".`));
      process.exit(1);
    }
    
    // Get category choice
    const { category } = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: `Choose a category for ${selectedEvent}:`,
        choices: categoryChoices
      }
    ]);
    
    // Get task number
    const { taskNum } = await inquirer.prompt([
      {
        type: 'input',
        name: 'taskNum',
        message: 'Enter task number (e.g. 1, 2, 10):',
        validate: input => {
          const num = parseInt(String(input).trim());
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
        },
        filter: input => parseInt(String(input).trim())        
      }
    ]);
    
    // Get task name
    const { taskName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'taskName',
        message: 'Enter task name:',
        validate: input => input.trim() ? true : 'Task name cannot be empty'
      }
    ]);
    
    // Determine the task root directory (where tasks will be created)
    let taskRoot;
    
    if (isInEvent) {
      // If we're in the event directory, use the current directory
      taskRoot = currentDir;
    } else if (eventRoot) {
      // If we have a event root, use that plus the selected event
      taskRoot = path.join(eventRoot, selectedEvent);
    } else {
      // Fallback: use current directory plus event name plus selected event
      taskRoot = path.join(currentDir, config.eventName, selectedEvent);
    }
    
    // Ensure the task root directory exists
    await fs.ensureDir(taskRoot);
    console.log(chalk.blue(`Creating task in directory: ${taskRoot}`));
    
    // Create task structure
    await createTaskStructure(taskRoot, category, taskName, taskNum, {
      categories: eventCategories
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Task creation failed:'), error.message);
    process.exit(1);
  }
}

async function createTaskStructure(eventRoot, category, taskName, taskNum, config) {
  // Find category number
  const catNum = Object.entries(config.categories)
    .find(([key, value]) => value === category)[0];
  
  const categoryFolder = path.join(eventRoot, `${String(catNum).padStart(2, '0')}_${category}`);
  await fs.ensureDir(categoryFolder);
  
  const taskSlug = slugify(taskName);
  let taskFolderName = `${String(taskNum).padStart(2, '0')}_${taskSlug}`;
  let taskFolder = path.join(categoryFolder, taskFolderName);
  
  // Check if we're in a git repo and create branch if appropriate
  let branchCreated = false;
  if (await isGitRepo()) {
    branchCreated = await createAndCheckoutBranch(category, taskNum, taskSlug);
    if (!branchCreated) {
      console.log(chalk.yellow('⚠️ Continuing without branch creation...'));
    }
  }
  
  // Check if task folder already exists and handle automatically
  if (await fs.pathExists(taskFolder)) {
    console.log(chalk.yellow(`⚠️ Task folder '${taskFolderName}' already exists in ${category}.`));
    // Generate a unique folder name by appending a timestamp
    const timestamp = Math.floor(Date.now() / 1000).toString().slice(-6);
    taskFolderName = `${String(taskNum).padStart(2, '0')}_${taskSlug}_${timestamp}`;
    taskFolder = path.join(categoryFolder, taskFolderName);
    console.log(chalk.blue(`Creating task with unique name: ${taskFolderName}`));
  }
  
  // Create folder structure
  await fs.ensureDir(taskFolder);
  const folderTemplate = ['challenge_files', 'workspace', 'exploit', 'screenshots'];
  for (const folder of folderTemplate) {
    await fs.ensureDir(path.join(taskFolder, folder));
  }
  
  // Get creator name
  const creatorName = await getGitUserName() || 'Unknown';
  
  // Create writeup.md
  const writeupContent = `# 🧩 ${taskName}

**Category:** ${category}  
**Points:** TBD  
**Flag:** \`TBD\`  
**Solver:** TBD

---

## 📝 Challenge Description

> _Paste the description or summarize it here._

---

## 🛠️ Steps to writeup

_Detail every major step you took, including tools, commands, reasoning, etc._

---

## 🧠 Notes & Takeaways

_Interesting techniques, things you learned, or anything to remember for next time._

---
`;

  const writeupPath = path.join(taskFolder, 'writeup.md');
  if (!await fs.pathExists(writeupPath)) {
    await fs.writeFile(writeupPath, writeupContent, 'utf-8');
  }
  
  // Create other files
  const fileTemplate = ['notes.txt'];
  for (const file of fileTemplate) {
    const filePath = path.join(taskFolder, file);
    if (!await fs.pathExists(filePath)) {
      await fs.createFile(filePath);
    }
  }
  
  console.log(chalk.green(`\n✅ Created task at: ${taskFolder}`));
  
  // Automatically handle git workflow if branch was created
  if (branchCreated) {
    try {
      const git = simpleGit();
      
      // Add all files in the task folder
      console.log(chalk.blue('📋 Adding files to git...'));
      await git.add(taskFolder);
      
      // Commit with a default message
      const commitMessage = `Add task: ${taskName}`;
      console.log(chalk.blue(`💾 Committing with message: "${commitMessage}"...`));
      await git.commit(commitMessage);
      
      // Check if there's a remote repository
      try {
        const remotes = await git.getRemotes();
        if (remotes && remotes.length > 0) {
          // Push branch to remote with upstream tracking
          const branchName = await getCurrentBranch();
          console.log(chalk.blue(`🚀 Publishing branch "${branchName}" to remote...`));
          await git.push('origin', branchName, ['--set-upstream']);
          console.log(chalk.green(`✅ Branch published and ready to work on!`));
        } else {
          console.log(chalk.yellow('⚠️ No remote repository found. Branch created locally only.'));
        }
      } catch (remoteError) {
        console.log(chalk.yellow(`⚠️ Could not access git remotes: ${remoteError.message}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Git operation failed: ${error.message}`));
      console.log(chalk.yellow('The task was created but could not be published to git.'));
    }
  }
}

async function createAndCheckoutBranch(category, taskNum, taskSlug) {
  try {
    // Check if on main branch
    const currentBranch = await getCurrentBranch();
    if (currentBranch !== 'main' && currentBranch !== 'master') {
      console.log(chalk.yellow(`⚠️ Warning: You are not on the main branch (current: ${currentBranch}).`));
      console.log(chalk.yellow('Branch creation is only available when on the main/master branch.'));
      return false;
    }
    
    // Format branch name
    const catSlug = slugify(category).toLowerCase();
    const branchName = `${catSlug}-${String(taskNum).padStart(2, '0')}-${taskSlug}`;
    
    const git = simpleGit();
    
    // Check if branch exists
    const branchSummary = await git.branch();
    const branchExists = branchSummary.all.includes(branchName);
    
    if (branchExists) {
      console.log(chalk.yellow(`⚠️ Branch '${branchName}' already exists. Creating a unique branch instead.`));
      // Create a unique branch name by appending timestamp
      const timestamp = Math.floor(Date.now() / 1000).toString().slice(-6);
      const uniqueBranchName = `${branchName}-${timestamp}`;
      await git.branch([uniqueBranchName]);
      await git.checkout(uniqueBranchName);
      console.log(chalk.green(`✅ Created and switched to new branch: ${uniqueBranchName}`));
    } else {
      // Create new branch
      await git.branch([branchName]);
      console.log(chalk.green(`✅ Created new branch: ${branchName}`));
      
      // Checkout to branch
      await git.checkout(branchName);
      console.log(chalk.green(`✅ Switched to branch: ${branchName}`));
    }
    
    return true;
    
  } catch (error) {
    console.log(chalk.red(`❌ Git operation failed: ${error.message}`));
    return false;
  }
}

module.exports = create;