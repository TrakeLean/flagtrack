const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const simpleGit = require('simple-git');
const { loadConfig } = require('../utils/configManager');
const { findRepoRoot, isGitRepo, getCurrentBranch, getGitUserName } = require('../utils/gitHelpers');
const { slugify, validateLocation } = require('../utils/helpers');

async function newtask() {
  console.log(chalk.blue('🧩 Creating a new CTF challenge task'));
  
  try {
    // Load config
    const config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('⚠️ No configuration found. Run `flagtrack setup` first.'));
      process.exit(1);
    }
    
    // Validate location
    const ctfRoot = await validateLocation(config);
    console.log(chalk.blue(`Working in CTF directory: ${ctfRoot}`));
    
    // Get category choice
    const categories = config.categories;
    const categoryChoices = Object.entries(categories).map(([key, value]) => ({
      name: `${value}`,
      value: value
    }));
    
    const { category } = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Choose a category:',
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
          const num = parseInt(input.trim());
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
        },
        filter: input => parseInt(input.trim())
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
    
    // Create task structure
    await createTaskStructure(ctfRoot, category, taskName, taskNum, config);
    
  } catch (error) {
    console.error(chalk.red('❌ Task creation failed:'), error.message);
    process.exit(1);
  }
}

async function createTaskStructure(ctfRoot, category, taskName, taskNum, config) {
  // Find category number
  const catNum = Object.entries(config.categories)
    .find(([key, value]) => value === category)[0];
  
  const categoryFolder = path.join(ctfRoot, `${String(catNum).padStart(2, '0')}_${category}`);
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
  const folderTemplate = ['files', 'exploit', 'screenshots'];
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

*Task template created by: ${creatorName}*
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

module.exports = newtask;
