const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const simpleGit = require('simple-git');
const inquirer = require('inquirer');
const { getCurrentBranch, getGitUserName } = require('../utils/gitHelpers');
const { loadConfig } = require('../utils/configManager');
const { validateLocation } = require('../utils/helpers');

async function solve() {
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
    
    // Don't allow solve on main/master branch
    if (currentBranch === 'main' || currentBranch === 'master') {
      console.log(chalk.red('❌ Cannot run solve on main/master branch.'));
      console.log(chalk.yellow('Please checkout a task branch first.'));
      process.exit(1);
    }
    
    // Try to find task from branch name
    let taskInfo = await findTaskFromBranch(currentBranch, config);
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
    
    // Read the writeup and check for required fields
    const writeupContent = await fs.readFile(writeupPath, 'utf-8');
    
    // Check for flag, points, and solver
    const flagMatch = writeupContent.match(/\*\*Flag:\*\* `(.+)`/);
    const flag = flagMatch ? flagMatch[1] : null;
    const isFlagMissing = !flag || flag === 'TBD';
    
    const pointsMatch = writeupContent.match(/\*\*Points:\*\* (\d+|TBD)/);
    const points = pointsMatch ? pointsMatch[1] : null;
    const isPointsMissing = !points || points === 'TBD';
    
    const solverMatch = writeupContent.match(/\*\*Solver:\*\* (.+)/);
    const solver = solverMatch ? solverMatch[1].trim() : null;
    const isSolverMissing = !solver || solver === 'TBD';
    
    // If everything is filled, ask if they want to finish the task
    if (!isFlagMissing && !isPointsMissing && !isSolverMissing) {
      console.log(chalk.green('✅ Task is complete:'));
      console.log(chalk.green(`🏆 Flag: ${flag}`));
      console.log(chalk.green(`💯 Points: ${points}`));
      console.log(chalk.green(`👤 Solver: ${solver}`));
      
      const { finishTask } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'finishTask',
          message: 'Do you want to merge this branch to main and delete it?',
          default: true
        }
      ]);
      
      if (finishTask) {
        await mergeAndDeleteBranch(currentBranch);
        console.log(chalk.green('🎉 Task completed and branch cleaned up!'));
      } else {
        console.log(chalk.blue('Task remains open. Run `flagtrack solve` again when ready to merge.'));
      }
      
      return;
    }
    
    // First, ask if they solved the flag
    const { solvedFlag } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'solvedFlag',
        message: 'Did you solve the flag?',
        default: true
      }
    ]);
    
    // If they didn't solve it, don't continue
    if (!solvedFlag && isFlagMissing) {
      console.log(chalk.yellow('🔍 Task remains unsolved. Run `flagtrack solve` when the flag is found.'));
      return;
    }
    
    // Prepare to update the writeup
    let updatedContent = writeupContent;
    let isUpdated = false;
    
    // Update flag if missing
    if (isFlagMissing) {
      const { flagValue } = await inquirer.prompt([
        {
          type: 'input',
          name: 'flagValue',
          message: 'Enter the flag:',
          validate: input => input.trim() ? true : 'Flag cannot be empty'
        }
      ]);
      
      if (flagMatch) {
        // Replace existing TBD flag
        updatedContent = updatedContent.replace(/\*\*Flag:\*\* `TBD`/, `**Flag:** \`${flagValue}\``);
      } else {
        // Add flag after category
        updatedContent = updatedContent.replace(/\*\*Category:\*\* (.+)/, `**Category:** $1\n**Flag:** \`${flagValue}\``);
      }
      isUpdated = true;
    }
    
    // Update solver if missing
    if (isSolverMissing) {
      const { solverName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'solverName',
          message: 'Who solved this challenge?',
          default: solvedFlag ? (await getGitUserName() || 'Unknown') : 'Team effort'
        }
      ]);
      
      if (solverMatch) {
        // Replace existing TBD solver
        updatedContent = updatedContent.replace(/\*\*Solver:\*\* TBD/, `**Solver:** ${solverName}`);
      } else {
        // Add solver after flag
        updatedContent = updatedContent.replace(/\*\*Flag:\*\* `(.+)`/, `**Flag:** \`$1\`\n**Solver:** ${solverName}`);
      }
      isUpdated = true;
    }
    
    // Update points if missing
    if (isPointsMissing) {
      const { pointsValue } = await inquirer.prompt([
        {
          type: 'input',
          name: 'pointsValue',
          message: 'Enter the points for this challenge:',
          validate: input => {
            const number = parseInt(input.trim());
            return !isNaN(number) && number > 0 ? true : 'Please enter a valid positive number';
          }
        }
      ]);
      
      if (pointsMatch) {
        // Replace existing TBD points
        updatedContent = updatedContent.replace(/\*\*Points:\*\* TBD/, `**Points:** ${pointsValue}`);
      } else {
        // Add points after category
        updatedContent = updatedContent.replace(/\*\*Category:\*\* (.+)/, `**Category:** $1\n**Points:** ${pointsValue}`);
      }
      isUpdated = true;
    }
    
    // If content was updated, write back to file
    if (isUpdated) {
      await fs.writeFile(writeupPath, updatedContent, 'utf-8');
      console.log(chalk.green('✅ Writeup updated with missing information.'));
      
      // Commit the changes
      try {
        const git = simpleGit();
        await git.add(writeupPath);
        
        // Create appropriate commit message
        let commitMessage = 'Update task';
        if (isFlagMissing && solvedFlag) {
          const solverName = updatedContent.match(/\*\*Solver:\*\* (.+)/)[1].trim();
          commitMessage = `Add flag solution by ${solverName}`;
        } else if (isPointsMissing) {
          commitMessage = 'Add points to task';
        }
        
        await git.commit(commitMessage);
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
    }
    
    // If everything is now complete, ask about merging
    if (updatedContent.match(/\*\*Flag:\*\* `(.+?)`/) && 
        updatedContent.match(/\*\*Points:\*\* (\d+)/) && 
        updatedContent.match(/\*\*Solver:\*\* (.+)/) &&
        !updatedContent.includes('TBD')) {
      
      const { finishTask } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'finishTask',
          message: 'Task is now complete! Merge this branch to main and delete it?',
          default: true
        }
      ]);
      
      if (finishTask) {
        await mergeAndDeleteBranch(currentBranch);
        console.log(chalk.green('🎉 Task completed and branch cleaned up!'));
      } else {
        console.log(chalk.blue('Task marked as complete but branch remains open.'));
        console.log(chalk.blue('Run `flagtrack solve` again when ready to merge.'));
      }
    } else {
      console.log(chalk.blue('Task is still missing some information.'));
      console.log(chalk.blue('Run `flagtrack solve` again to complete the task.'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking task:'), error.message);
    process.exit(1);
  }
}

async function mergeAndDeleteBranch(currentBranch) {
  try {
    const git = simpleGit();
    
    // Check if we have any uncommitted changes
    const status = await git.status();
    if (status.files.length > 0) {
      console.log(chalk.yellow('⚠️ You have uncommitted changes. Please commit or stash them first.'));
      return false;
    }
    
    // Get main branch name (either main or master)
    const branches = await git.branch();
    const mainBranch = branches.all.includes('main') ? 'main' : 'master';
    
    // Make sure we have the latest changes from main
    console.log(chalk.blue(`📥 Fetching latest changes from ${mainBranch}...`));
    await git.fetch('origin', mainBranch);
    
    // Checkout main branch
    console.log(chalk.blue(`🔄 Switching to ${mainBranch} branch...`));
    await git.checkout(mainBranch);
    
    // Pull latest changes
    await git.pull('origin', mainBranch);
    
    // Merge the task branch
    console.log(chalk.blue(`🔀 Merging ${currentBranch} into ${mainBranch}...`));
    await git.merge([currentBranch, '--no-ff', '-m', `Merge task branch '${currentBranch}'`]);
    
    // Push the changes to main
    console.log(chalk.blue(`📤 Pushing changes to ${mainBranch}...`));
    await git.push('origin', mainBranch);
    
    // Delete the branch locally
    console.log(chalk.blue(`🗑️ Deleting local branch ${currentBranch}...`));
    await git.deleteLocalBranch(currentBranch, true);
    
    // Delete the branch on remote
    console.log(chalk.blue(`🗑️ Deleting remote branch ${currentBranch}...`));
    try {
      await git.push('origin', `:${currentBranch}`);
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not delete remote branch: ${error.message}`));
      console.log(chalk.yellow('This is often normal for protected branches or if the branch was never pushed.'));
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Error during merge: ${error.message}`));
    console.log(chalk.yellow('You may need to resolve conflicts or complete the merge manually.'));
    return false;
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

module.exports = solve;
