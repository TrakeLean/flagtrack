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
  const taskFolderName = `${String(taskNum).padStart(2, '0')}_${taskSlug}`;
  const taskFolder = path.join(categoryFolder, taskFolderName);
  
  // Check if we're in a git repo and create branch if appropriate
  let branchCreated = false;
  if (await isGitRepo()) {
    branchCreated = await createAndCheckoutBranch(category, taskNum, taskSlug);
    if (!branchCreated) {
      console.log(chalk.yellow('⚠️ Continuing without branch creation...'));
    }
  }
  
  // Check if task folder already exists
  if (await fs.pathExists(taskFolder)) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Task folder '${taskFolderName}' already exists in ${category}. Continue anyway?`,
        default: false
      }
    ]);
    
    if (!confirm) {
      console.log(chalk.red('❌ Task creation cancelled.'));
      process.exit(1);
    }
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
  
  // Prompt for git add if we're in a git repo and created a branch
  if (branchCreated) {
    const { confirmAdd } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmAdd',
        message: 'Do you want to add the newly created files to git?',
        default: true
      }
    ]);
    
    if (confirmAdd) {
      try {
        const git = simpleGit();
        await git.add(taskFolder);
        console.log(chalk.green(`✅ Added files to git staging area. Use 'git commit -m "your message"' to commit them.`));
      } catch (error) {
        console.log(chalk.red(`❌ Git add failed: ${error.message}`));
      }
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
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Branch '${branchName}' already exists. Checkout to this branch anyway?`,
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.red('❌ Branch checkout cancelled.'));
        return false;
      }
    } else {
      // Create new branch
      await git.branch([branchName]);
      console.log(chalk.green(`✅ Created new branch: ${branchName}`));
    }
    
    // Checkout to branch
    await git.checkout(branchName);
    console.log(chalk.green(`✅ Switched to branch: ${branchName}`));
    return true;
    
  } catch (error) {
    console.log(chalk.red(`❌ Git operation failed: ${error.message}`));
    return false;
  }
}

module.exports = newtask;
