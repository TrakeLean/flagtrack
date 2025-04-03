const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { findRepoRoot } = require('../utils/gitHelpers');
const { loadConfig } = require('../utils/configManager');
const { validateLocation } = require('../utils/helpers');

/**
 * Process solver string to handle team efforts and multiple solvers
 * @param {string} solverStr - The solver string from writeup
 * @returns {string[]} Array of individual solvers
 */
function processSolvers(solverStr) {
  if (!solverStr || solverStr === 'TBD' || solverStr === 'Unknown') {
    return [];
  }
  
  // Handle "Team effort" case
  if (solverStr.toLowerCase().includes('team effort')) {
    return ['Team effort'];
  }
  
  // Split by commas, ampersands, and "and" to handle multiple solvers
  return solverStr
    .split(/,|\s+and\s+|&/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

/**
 * Generate and display leaderboard
 */
async function leaderboard() {
  try {
    console.log(chalk.blue('📊 Generating CTF leaderboard'));
    
    // Load config
    const config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('⚠️ No configuration found. Run `flagtrack setup` first.'));
      process.exit(1);
    }
    
    // Find repository root
    const repoRoot = await findRepoRoot();
    if (!repoRoot) {
      console.log(chalk.yellow('⚠️ Could not find repository root.'));
      process.exit(1);
    }
    
    // Get all challenges
    const challenges = await scanAllChallenges(repoRoot, config);
    console.log(chalk.green(`✅ Found ${challenges.length} challenges`));
    
    // Extract solver data
    const { solvers, totals } = processLeaderboardData(challenges);
    
    // Display leaderboard
    displayLeaderboard(solvers, totals);
    
    // Optional: Export leaderboard
    const { exportOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'exportOption',
        message: 'Would you like to export the leaderboard?',
        choices: [
          { name: 'No, just display it', value: 'none' },
          { name: 'Yes, as Markdown', value: 'md' },
          { name: 'Yes, as JSON', value: 'json' }
        ],
        default: 'none'
      }
    ]);
    
    if (exportOption !== 'none') {
      await exportLeaderboard(solvers, totals, exportOption, repoRoot);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Leaderboard generation failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Scan all challenges in the repository
 * @param {string} repoRoot - Repository root path
 * @param {Object} config - Configuration object
 * @returns {Promise<Array>} Array of challenge objects
 */
async function scanAllChallenges(repoRoot, config) {
  const challenges = [];
  const ctfRoot = await validateLocation(config);
  
  // Check if parent directory is specified
  const parentDir = config.parentDir;
  let competitionsRoot = ctfRoot;
  
  if (parentDir) {
    const parentDirPath = path.join(repoRoot, parentDir);
    if (await fs.pathExists(parentDirPath)) {
      // Check if we're in a structure with multiple CTFs
      competitionsRoot = parentDirPath;
    }
  }
  
  // Determine if we're dealing with a single CTF or multiple
  let competitions = {};
  
  if (competitionsRoot === ctfRoot) {
    // Single CTF
    competitions[config.ctfName] = {
      path: ctfRoot,
      categories: {}
    };
  } else {
    // Multiple CTFs
    try {
      const items = await fs.readdir(competitionsRoot, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.')) {
          competitions[item.name] = {
            path: path.join(competitionsRoot, item.name),
            categories: {}
          };
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Error reading competitions: ${error.message}`));
    }
  }
  
  // Go through each competition
  for (const compName in competitions) {
    const compPath = competitions[compName].path;
    
    // Find categories
    try {
      const items = await fs.readdir(compPath, { withFileTypes: true });
      const categoryPattern = /^\d{2}_/;
      
      for (const item of items) {
        if (item.isDirectory() && categoryPattern.test(item.name)) {
          const categoryPath = path.join(compPath, item.name);
          const categoryName = item.name.substring(3); // Remove the "XX_" prefix
          
          // Find tasks in category
          try {
            const taskItems = await fs.readdir(categoryPath, { withFileTypes: true });
            
            for (const taskItem of taskItems) {
              if (taskItem.isDirectory()) {
                const taskPath = path.join(categoryPath, taskItem.name);
                const writeupPath = path.join(taskPath, 'writeup.md');
                
                if (await fs.pathExists(writeupPath)) {
                  try {
                    // Extract challenge metadata
                    const content = await fs.readFile(writeupPath, 'utf-8');
                    
                    // Extract challenge name
                    const nameMatch = content.match(/# 🧩 (.+)/);
                    const name = nameMatch ? nameMatch[1] : taskItem.name;
                    
                    // Extract points
                    const pointsMatch = content.match(/\*\*Points:\*\* (\d+)/);
                    const points = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                    
                    // Extract flag
                    const flagMatch = content.match(/\*\*Flag:\*\* `(.+)`/);
                    const flag = flagMatch ? flagMatch[1] : null;
                    const isCompleted = flag && flag !== 'TBD';
                    
                    // Extract solver
                    const solverMatch = content.match(/\*\*Solver:\*\* (.+)/);
                    const solver = solverMatch ? solverMatch[1].trim() : null;
                    
                    challenges.push({
                      name,
                      points,
                      category: categoryName,
                      isCompleted,
                      solver,
                      competition: compName,
                      taskNum: taskItem.name.substring(0, 2), // Get "XX" from "XX_taskname"
                      path: taskPath
                    });
                    
                  } catch (error) {
                    console.log(chalk.yellow(`⚠️ Error processing ${writeupPath}: ${error.message}`));
                  }
                }
              }
            }
          } catch (error) {
            console.log(chalk.yellow(`⚠️ Error reading tasks in ${categoryPath}: ${error.message}`));
          }
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Error reading categories in ${compPath}: ${error.message}`));
    }
  }
  
  return challenges;
}

/**
 * Process challenge data into leaderboard format
 * @param {Array} challenges - Array of challenge objects
 * @returns {Object} Object with solvers and totals data
 */
function processLeaderboardData(challenges) {
  const solvers = {};
  const totals = {
    challenges: challenges.length,
    solved: 0,
    points: 0,
    categories: new Set(),
    competitions: new Set()
  };
  
  // Process each challenge
  for (const challenge of challenges) {
    // Update totals
    totals.categories.add(challenge.category);
    totals.competitions.add(challenge.competition);
    
    if (challenge.isCompleted) {
      totals.solved++;
      totals.points += challenge.points;
      
      // Process solvers
      const solversList = processSolvers(challenge.solver);
      
      for (const solverName of solversList) {
        if (!solvers[solverName]) {
          solvers[solverName] = {
            name: solverName,
            points: 0,
            solved: 0,
            challenges: [],
            categories: new Set(),
            competitions: new Set()
          };
        }
        
        // Update solver stats
        const solver = solvers[solverName];
        solver.points += challenge.points;
        solver.solved += 1;
        solver.challenges.push({
          name: challenge.name,
          points: challenge.points,
          category: challenge.category,
          competition: challenge.competition
        });
        solver.categories.add(challenge.category);
        solver.competitions.add(challenge.competition);
      }
    }
  }
  
  // Calculate percentage solved for each solver
  Object.values(solvers).forEach(solver => {
    solver.percentSolved = (solver.solved / totals.solved * 100).toFixed(1);
    solver.percentPoints = (solver.points / totals.points * 100).toFixed(1);
  });
  
  // Convert to array and sort
  const sortedSolvers = Object.values(solvers).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points; // Sort by points first
    return b.solved - a.solved; // Then by number of challenges solved
  });
  
  return { 
    solvers: sortedSolvers,
    totals: {
      ...totals,
      categories: totals.categories.size,
      competitions: totals.competitions.size
    }
  };
}

/**
 * Display leaderboard in the console
 * @param {Array} solvers - Sorted array of solver objects
 * @param {Object} totals - Total statistics
 */
function displayLeaderboard(solvers, totals) {
  console.log();
  console.log(chalk.yellow.bold('========================================'));
  console.log(chalk.yellow.bold('🏆           CTF LEADERBOARD          🏆'));
  console.log(chalk.yellow.bold('========================================'));
  console.log();
  
  console.log(chalk.blue(`Total Challenges: ${totals.challenges}`));
  console.log(chalk.blue(`Solved: ${totals.solved} (${(totals.solved / totals.challenges * 100).toFixed(1)}%)`));
  console.log(chalk.blue(`Total Points: ${totals.points}`));
  console.log(chalk.blue(`Categories: ${totals.categories}`));
  console.log(chalk.blue(`Competitions: ${totals.competitions}`));
  console.log();
  
  // Display table header
  console.log(chalk.bold('Rank | Solver              | Points | Chals | % of Total | Categories'));
  console.log(chalk.bold('-----|---------------------|--------|-------|-----------|----------'));
  
  // Display solver rows
  solvers.forEach((solver, index) => {
    const rank = (index + 1).toString().padEnd(4);
    const name = solver.name.padEnd(20).substring(0, 20);
    const points = solver.points.toString().padEnd(7);
    const solved = solver.solved.toString().padEnd(6);
    const percentage = `${solver.percentPoints}%`.padEnd(10);
    const categories = solver.categories.size;
    
    // Color the top 3
    let line;
    if (index === 0) {
      line = chalk.yellow(`${rank}| ${name} | ${points}| ${solved}| ${percentage}| ${categories}`);
    } else if (index === 1) {
      line = chalk.gray(`${rank}| ${name} | ${points}| ${solved}| ${percentage}| ${categories}`);
    } else if (index === 2) {
      line = chalk.hex('#cd7f32')(`${rank}| ${name} | ${points}| ${solved}| ${percentage}| ${categories}`);
    } else {
      line = `${rank}| ${name} | ${points}| ${solved}| ${percentage}| ${categories}`;
    }
    
    console.log(line);
  });
  
  console.log();
  console.log(chalk.green.bold('Top Categories by Solver:'));
  console.log();
  
  // Find top category for each solver
  solvers.forEach(solver => {
    if (solver.challenges.length === 0) return;
    
    // Count challenges per category
    const categoryCount = {};
    solver.challenges.forEach(challenge => {
      if (!categoryCount[challenge.category]) {
        categoryCount[challenge.category] = { count: 0, points: 0 };
      }
      categoryCount[challenge.category].count++;
      categoryCount[challenge.category].points += challenge.points;
    });
    
    // Find top category by count
    let topCategory = null;
    let topCount = 0;
    let topPoints = 0;
    
    for (const [category, stats] of Object.entries(categoryCount)) {
      if (stats.count > topCount || (stats.count === topCount && stats.points > topPoints)) {
        topCategory = category;
        topCount = stats.count;
        topPoints = stats.points;
      }
    }
    
    console.log(chalk.cyan(`${solver.name}: ${topCategory} (${topCount} challenges, ${topPoints} points)`));
  });
}

/**
 * Export leaderboard to a file
 * @param {Array} solvers - Sorted array of solver objects
 * @param {Object} totals - Total statistics
 * @param {string} format - Export format ('md' or 'json')
 * @param {string} repoRoot - Repository root path
 */
async function exportLeaderboard(solvers, totals, format, repoRoot) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  
  // Create stats directory if it doesn't exist
  const statsDir = path.join(repoRoot, '.flagtrack', 'stats');
  await fs.ensureDir(statsDir);
  
  if (format === 'md') {
    // Create Markdown version
    const mdContent = generateMarkdownLeaderboard(solvers, totals);
    const mdFilePath = path.join(statsDir, `leaderboard-${timestamp}.md`);
    await fs.writeFile(mdFilePath, mdContent, 'utf-8');
    console.log(chalk.green(`✅ Markdown leaderboard exported to ${mdFilePath}`));
  } else if (format === 'json') {
    // Create JSON version
    const jsonContent = JSON.stringify(
      { solvers: solvers.map(s => ({ 
        ...s, 
        categories: Array.from(s.categories),
        competitions: Array.from(s.competitions) 
      })), totals }, 
      null, 2
    );
    const jsonFilePath = path.join(statsDir, `leaderboard-${timestamp}.json`);
    await fs.writeFile(jsonFilePath, jsonContent, 'utf-8');
    console.log(chalk.green(`✅ JSON leaderboard exported to ${jsonFilePath}`));
  }
}

/**
 * Generate Markdown version of leaderboard
 * @param {Array} solvers - Sorted array of solver objects
 * @param {Object} totals - Total statistics
 * @returns {string} Markdown content
 */
function generateMarkdownLeaderboard(solvers, totals) {
  let md = `# CTF Leaderboard

> Generated on ${new Date().toISOString().split('T')[0]} by flagtrack

## Summary

- **Total Challenges:** ${totals.challenges}
- **Solved Challenges:** ${totals.solved} (${(totals.solved / totals.challenges * 100).toFixed(1)}%)
- **Total Points:** ${totals.points}
- **Categories:** ${totals.categories}
- **Competitions:** ${totals.competitions}

## Solvers Ranking

| Rank | Solver | Points | Challenges | % of Total | Categories |
|------|--------|--------|------------|------------|------------|
`;

  // Add solver rows
  solvers.forEach((solver, index) => {
    md += `| ${index + 1} | ${solver.name} | ${solver.points} | ${solver.solved} | ${solver.percentPoints}% | ${solver.categories.size} |\n`;
  });

  md += `\n## Top Categories by Solver\n\n`;

  // Find top category for each solver
  solvers.forEach(solver => {
    if (solver.challenges.length === 0) return;
    
    // Count challenges per category
    const categoryCount = {};
    solver.challenges.forEach(challenge => {
      if (!categoryCount[challenge.category]) {
        categoryCount[challenge.category] = { count: 0, points: 0 };
      }
      categoryCount[challenge.category].count++;
      categoryCount[challenge.category].points += challenge.points;
    });
    
    // Find top category by count
    let topCategory = null;
    let topCount = 0;
    let topPoints = 0;
    
    for (const [category, stats] of Object.entries(categoryCount)) {
      if (stats.count > topCount || (stats.count === topCount && stats.points > topPoints)) {
        topCategory = category;
        topCount = stats.count;
        topPoints = stats.points;
      }
    }
    
    md += `- **${solver.name}**: ${topCategory} (${topCount} challenges, ${topPoints} points)\n`;
  });

  return md;
}

module.exports = leaderboard;
