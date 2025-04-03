const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const simpleGit = require('simple-git');
const inquirer = require('inquirer');
const { getCurrentBranch, getGitUserName } = require('../utils/gitHelpers');
const { loadConfig } = require('../utils/configManager');
const { validateLocation } = require('../utils/helpers');

async function endtask() {
  console.log(chalk.blue('🏁 Checking task completion status'));
  
  try {
    // Load config
    const config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('⚠️ No configuration found. Run `flagtrack setup` first.'));
      process.exit(1);
    }
    
    // Find current task from the branch name
    const currentBranch = await getCurrentBranch();
    if (!currentBranch) {
      console.log(chalk.yellow('⚠️ Not in a git repository or unable to determine current branch.'));
      process.exit(1);
    }
    
    // Try to find task from branch name
    const taskInfo = await findTaskFromBranch(currentBranch, config);
    if (!taskInfo) {
      // If task not found from branch, allow manual selection
      console.log(chalk.yellow('⚠️ Could not determine task from branch name.'));
      console.log(chalk.blue('Please select the task manually:'));
      const taskPath = await selectTaskManually(config);
      if (!taskPath) {
        console.log(chalk.red('❌ No task selected.'));
        process.exit(1);
      }
      taskInfo = { path: taskPath };
    }
    
    // Check if there's a writeup.md file in the task folder
    const writeupPath = path.join(taskInfo.path, 'writeup.md');
    if (!await fs.pathExists(writeupPath)) {
      console.log(chalk.red(`❌ No writeup.md found at ${writeupPath}`));
      process.exit(1);
    }
    
    // Read the writeup and check for flag
    const writeupContent = await fs.readFile(writeupPath, 'utf-8');
    const flagMatch = writeupContent.match(/\*\*Flag:\*\* `(.+)`/);
    const flag = flagMatch ? flagMatch[1] : null;
    
    if (!flag || flag === 'TBD') {
      console.log(chalk.yellow('🔍 Flag not found or still set to TBD.'));
      
      // Ask user if they want to add a flag
      const { addFlag } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addFlag',
          message: 'Do you want to add a flag now?',
          default: true
        }
      ]);
      
      if (addFlag) {
        const { flagValue } = await inquirer.prompt([
          {
            type: 'input',
            name: 'flagValue',
            message: 'Enter the flag:',
            validate: input => input.trim() ? true : 'Flag cannot be empty'
          }
        ]);
        
        // Also update the solver
        const solver = await getGitUserName() || 'Unknown';
        
        // Update the writeup file
        let updatedContent = writeupContent;
        if (flagMatch) {
          // Replace existing TBD flag
          updatedContent = updatedContent.replace(/\*\*Flag:\*\* `TBD`/, `**Flag:** \`${flagValue}\``);
        } else {
          // Add flag after category
          updatedContent = updatedContent.replace(/\*\*Category:\*\* (.+)/, `**Category:** $1\n**Flag:** \`${flagValue}\``);
        }
        
        // Update solver
        if (updatedContent.includes('**Solver:** TBD')) {
          updatedContent = updatedContent.replace(/\*\*Solver:\*\* TBD/, `**Solver:** ${solver}`);
        } else if (!updatedContent.includes('**Solver:**')) {
          // Add solver after flag
          updatedContent = updatedContent.replace(/\*\*Flag:\*\* `(.+)`/, `**Flag:** \`$1\`\n**Solver:** ${solver}`);
        }
        
        // Write updated content back to file
        await fs.writeFile(writeupPath, updatedContent, 'utf-8');
        
        console.log(chalk.green(`✅ Flag added: ${flagValue}`));
        console.log(chalk.green(`✅ Solver set to: ${solver}`));
        
        // Commit the changes
        try {
          const git = simpleGit();
          await git.add(writeupPath);
          await git.commit(`Add flag solution by ${solver}`);
          console.log(chalk.green('✅ Changes committed.'));
          
          // Push changes
          try {
            await git.push();
            console.log(chalk.green('✅ Changes pushed to remote.'));
          } catch (pushError) {
            console.log(chalk.yellow(`⚠️ Could not push changes: ${pushError.message}`));
          }
        } catch (gitError) {
          console.log(chalk.yellow(`⚠️ Could not commit changes: ${gitError.message}`));
        }
        
        console.log(chalk.green('🎉 Task completed successfully!'));
      } else {
        console.log(chalk.blue('Task remains unsolved.'));
      }
    } else {
      // Flag already exists
      const solverMatch = writeupContent.match(/\*\*Solver:\*\* (.+)/);
      const solver = solverMatch ? solverMatch[1].trim() : 'Unknown';
      
      console.log(chalk.green('🎯 Flag already solved!'));
      console.log(chalk.green(`🏆 Flag: ${flag}`));
      console.log(chalk.green(`👤 Solver: ${solver}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking task:'), error.message);
    process.exit(1);
  }
}

async function findTaskFromBranch(branchName, config) {
  // Try to parse branch name in format: category-tasknum-name
  const branchPattern = /^([a-z]+)-(\d+)-(.+)$/;
  const match = branchName.match(branchPattern);
  
  if (!match) {
    return null;
  }
  
  const category = match[1];
  const taskNum = match[2].padStart(2, '0');
  
  // Find the category folder
  const ctfRoot = await validateLocation(config);
  
  // Find the category number from name
  let categoryNum = null;
  for (const [num, name] of Object.entries(config.categories)) {
    if (name.toLowerCase() === category) {
      categoryNum = num.padStart(2, '0');
      break;
    }
  }
  
  if (!categoryNum) {
    return null;
  }
  
  // Look for matching task folder
  const categoryPath = path.join(ctfRoot, `${categoryNum}_${capitalizeName(category)}`);
  if (!await fs.pathExists(categoryPath)) {
    return null;
  }
  
  // List all task folders and find one that starts with the task number
  const taskFolders = await fs.readdir(categoryPath, { withFileTypes: true });
  for (const item of taskFolders) {
    if (item.isDirectory() && item.name.startsWith(`${taskNum}_`)) {
      return {
        path: path.join(categoryPath, item.name),
        category,
        taskNum
      };
    }
  }
  
  return null;
}

function capitalizeName(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function selectTaskManually(config) {
  try {
    const ctfRoot = await validateLocation(config);
    
    // Get all categories
    const categories = [];
    for (const [num, name] of Object.entries(config.categories)) {
      const categoryPath = path.join(ctfRoot, `${num.padStart(2, '0')}_${name}`);
      if (await fs.pathExists(categoryPath)) {
        categories.push({
          num: num.padStart(2, '0'),
          name,
          path: categoryPath
        });
      }
    }
    
    if (categories.length === 0) {
      console.log(chalk.yellow('⚠️ No categories found.'));
      return null;
    }
    
    // Let user select category
    const { categoryIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'categoryIndex',
        message: 'Select a category:',
        choices: categories.map((cat, index) => ({
          name: cat.name,
          value: index
        }))
      }
    ]);
    
    const selectedCategory = categories[categoryIndex];
    
    // Get all tasks in the selected category
    const tasks = [];
    const taskFolders = await fs.readdir(selectedCategory.path, { withFileTypes: true });
    
    for (const item of taskFolders) {
      if (item.isDirectory()) {
        const taskPath = path.join(selectedCategory.path, item.name);
        const writeupPath = path.join(taskPath, 'writeup.md');
        
        if (await fs.pathExists(writeupPath)) {
          // Extract task name from writeup if possible
          let taskName = item.name;
          try {
            const content = await fs.readFile(writeupPath, 'utf-8');
            const nameMatch = content.match(/# 🧩 (.+)/);
            if (nameMatch) {
              taskName = nameMatch[1];
            }
          } catch (e) {
            // Ignore error and use folder name
          }
          
          tasks.push({
            name: taskName,
            path: taskPath,
            folderName: item.name
          });
        }
      }
    }
    
    if (tasks.length === 0) {
      console.log(chalk.yellow(`⚠️ No tasks found in category ${selectedCategory.name}.`));
      return null;
    }
    
    // Let user select task
    const { taskIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'taskIndex',
        message: 'Select a task:',
        choices: tasks.map((task, index) => ({
          name: `${task.folderName} - ${task.name}`,
          value: index
        }))
      }
    ]);
    
    return tasks[taskIndex].path;
    
  } catch (error) {
    console.error(chalk.red('❌ Error selecting task:'), error.message);
    return null;
  }
}

module.exports = endtask;
