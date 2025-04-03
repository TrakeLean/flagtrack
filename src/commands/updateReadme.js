const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const simpleGit = require('simple-git');
const { loadConfig } = require('../utils/configManager');
const { findRepoRoot } = require('../utils/gitHelpers');

async function updateReadme() {
  console.log(chalk.blue('📊 Generating CTF progress README'));
  
  try {
    const repoRoot = await findRepoRoot();
    if (!repoRoot) {
      console.log(chalk.yellow('⚠️ Could not find repository root.'));
      process.exit(1);
    }
    
    // Generate README content
    const readmeContent = await generateReadme(repoRoot);
    
    // Write README to root directory
    const readmePath = path.join(repoRoot, 'README.md');
    await fs.writeFile(readmePath, readmeContent, 'utf-8');
    
    console.log(chalk.green(`📝 Generated README.md at ${readmePath}`));
    
  } catch (error) {
    console.error(chalk.red('❌ README generation failed:'), error.message);
    process.exit(1);
  }
}

async function generateReadme(ctfRoot) {
  // Find all competitions and their challenge data
  const competitions = await findCompetitionData(ctfRoot);
  
  // Get current time in Norwegian time (UTC+1)
  const now = new Date();
  const utcOffset = now.getTimezoneOffset();
  const norwegianOffset = -60; // UTC+1 in minutes
  const timezoneDiff = norwegianOffset - (-utcOffset);
  
  const norwegianTime = new Date(now.getTime() + timezoneDiff * 60 * 1000);
  const formattedTime = norwegianTime.toISOString().replace('T', ' ').slice(0, 19);
  
  // Generate README content
  let readme = `# CTF Competitions Progress Tracker

> Last updated: ${formattedTime}

`;

  // Add section for each competition
  const sortedCompetitions = Object.keys(competitions).sort();
  for (const compName of sortedCompetitions) {
    const compData = competitions[compName];
    const categories = compData.categories;
    
    // Calculate competition stats
    let compChallenges = 0;
    let compCompleted = 0;
    let compPoints = 0;
    
    for (const catNum in categories) {
      const category = categories[catNum];
      compChallenges += category.challenges.length;
      compCompleted += category.challenges.filter(c => c.isCompleted).length;
      compPoints += category.challenges.reduce((sum, c) => sum + (c.isCompleted ? c.points : 0), 0);
    }
    
    // Add competition header and stats
    const progressPercentage = compChallenges ? Math.round((compCompleted / compChallenges) * 100) : 0;
    readme += `## ${compName}

**Progress:** ${compCompleted}/${compChallenges} challenges (${progressPercentage}%)  
**Points:** ${compPoints}

`;
    
    // Add category sections, sorted by category number
    const sortedCategories = Object.keys(categories).sort();
    for (const catNum of sortedCategories) {
      const category = categories[catNum];
      const categoryName = category.name;
      const challenges = category.challenges.sort((a, b) => a.num.localeCompare(b.num));
      
      if (challenges.length === 0) {
        continue; // Skip empty categories
      }
      
      const completedInCategory = challenges.filter(c => c.isCompleted).length;
      const categoryPoints = challenges.reduce((sum, c) => sum + (c.isCompleted ? c.points : 0), 0);
      
      readme += `### ${categoryName} (${completedInCategory}/${challenges.length} - ${categoryPoints} pts)

| # | Challenge | Points | Status | Solver | Flag |
|:---:|:----------|:------:|:------:|:-------|:------|
`;
      
      for (const challenge of challenges) {
        const status = challenge.isCompleted ? '✅' : '❌';
        const pointsDisplay = challenge.points ? `${challenge.points}` : 'TBD';
        
        // Handle flag display with tooltips for long flags
        let flagDisplay;
        if (!challenge.flag || challenge.flag === 'TBD') {
          flagDisplay = challenge.flag === 'TBD' ? '`TBD`' : 'No flag';
        } else if (challenge.flag.length > 30) {
          // Use HTML with title attribute for tooltip on hover
          const escapedFlag = challenge.flag.replace(/"/g, '&quot;');
          flagDisplay = `<code title="${escapedFlag}">${challenge.flag.slice(0, 27)}...</code>`;
        } else {
          flagDisplay = `\`${challenge.flag}\``;
        }
        
        // Format challenge name with shorter display if needed
        const challengeName = challenge.name;
        const challengeDisplay = challengeName.length > 25 
          ? `${challengeName.slice(0, 22)}...` 
          : challengeName;
        
        // Add solver to the output
        const solver = challenge.solver || 'Unknown';
        
        readme += `| ${challenge.num} | [${challengeDisplay}](${challenge.path}/writeup.md) | ${pointsDisplay} | ${status} | ${solver} | ${flagDisplay} |\n`;
      }
      
      readme += '\n';
    }
    
    // Add separator between competitions except for the last one
    if (compName !== sortedCompetitions[sortedCompetitions.length - 1]) {
      readme += '---\n\n';
    }
  }
  
  return readme;
}

async function findCompetitionData(ctfRoot) {
  const competitions = {};
  const categoryPattern = /^\d{2}_/;
  
  // Load configuration to check for parent directory
  const config = await loadConfig();
  const parentDir = config && config.parentDir ? config.parentDir : null;
  
  // First, check if we have a parent directory
  let competitionsRoot = ctfRoot;
  if (parentDir) {
    const parentDirPath = path.join(ctfRoot, parentDir);
    if (await fs.pathExists(parentDirPath)) {
      competitionsRoot = parentDirPath;
    }
  }
  
  // Find all directories that could be competitions
  let items;
  try {
    items = await fs.readdir(competitionsRoot, { withFileTypes: true });
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Could not read directory ${competitionsRoot}: ${error.message}`));
    return competitions;
  }
  
  for (const item of items) {
    if (!item.isDirectory() || item.name.startsWith('.')) {
      continue;
    }
    
    const itemPath = path.join(competitionsRoot, item.name);
    
    // Check if this directory contains category folders
    let hasCategories = false;
    try {
      const subitems = await fs.readdir(itemPath, { withFileTypes: true });
      for (const subitem of subitems) {
        if (subitem.isDirectory() && categoryPattern.test(subitem.name)) {
          hasCategories = true;
          break;
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not read directory ${itemPath}: ${error.message}`));
      continue;
    }
    
    if (hasCategories) {
      competitions[item.name] = {
        path: itemPath,
        categories: {}
      };
    }
  }
  
  // For each competition, find all categories and challenges
  for (const compName in competitions) {
    const compData = competitions[compName];
    const compPath = compData.path;
    const categories = compData.categories;
    
    // Find all category folders
    try {
      const items = await fs.readdir(compPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory() && categoryPattern.test(item.name)) {
          const categoryNum = item.name.slice(0, 2);
          const categoryName = item.name.slice(3);
          categories[categoryNum] = {
            name: categoryName,
            path: path.join(compPath, item.name),
            challenges: []
          };
        }
      }
      
      // Find all challenge folders within categories
      for (const catNum in categories) {
        const category = categories[catNum];
        const catItems = await fs.readdir(category.path, { withFileTypes: true });
        
        for (const item of catItems) {
          if (item.isDirectory()) {
            const writeupPath = path.join(category.path, item.name, 'writeup.md');
            
            if (await fs.pathExists(writeupPath)) {
              // Extract challenge number if it follows the pattern, otherwise use "00"
              const challengeNum = categoryPattern.test(item.name) ? item.name.slice(0, 2) : '00';
              
              try {
                const metadata = await extractMetadata(writeupPath, ctfRoot);
                
                category.challenges.push({
                  num: challengeNum,
                  path: path.relative(ctfRoot, path.join(category.path, item.name)),
                  ...metadata
                });
              } catch (error) {
                console.log(chalk.yellow(`⚠️ Error processing ${writeupPath}: ${error.message}`));
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not process competition ${compName}: ${error.message}`));
    }
  }
  
  if (Object.keys(competitions).length === 0) {
    console.log(chalk.yellow('⚠️ No competitions found. Make sure your directory structure is correct.'));
  }
  
  return competitions;
}

async function extractMetadata(writeupPath, ctfRoot) {
  const content = await fs.readFile(writeupPath, 'utf-8');
  
  // Extract challenge name from first heading
  const nameMatch = content.match(/# 🧩 (.+)/);
  const name = nameMatch ? nameMatch[1] : 'Unknown Challenge';
  
  // Extract points
  const pointsMatch = content.match(/\*\*Points:\*\* (\d+)/);
  const points = pointsMatch && pointsMatch[1] !== 'TBD' ? parseInt(pointsMatch[1]) : 0;
  
  // Extract category
  const categoryMatch = content.match(/\*\*Category:\*\* (.+)/);
  const category = categoryMatch ? categoryMatch[1].trim() : 'Uncategorized';
  
  // Check if flag is present and is a real flag (not a placeholder)
  const flagMatch = content.match(/\*\*Flag:\*\* `(.+)`/);
  const flag = flagMatch ? flagMatch[1] : '';
  
  // Extract solver from the file
  const solverMatch = content.match(/\*\*Solver:\*\* (.+)/);
  const fileSolver = solverMatch ? solverMatch[1].trim() : 'Unknown';
  
  // A task is considered completed if:
  // 1. A flag exists
  // 2. The flag is not "TBD" (which indicates an unsolved challenge)
  const isCompleted = flag && flag !== 'TBD';
  
  // If the challenge is completed, try to get the solver from git history
  let gitSolver = null;
  if (isCompleted) {
    gitSolver = await getFlagSolver(ctfRoot, writeupPath);
  }
  
  // Prefer the git solver if available, otherwise use the file solver
  const solver = gitSolver || fileSolver;
  
  return {
    name,
    points,
    category,
    isCompleted,
    hasFlag: Boolean(flag),
    solver,
    flag
  };
}

async function getFlagSolver(repoRoot, writeupPath) {
  try {
    const relativePath = path.relative(repoRoot, writeupPath);
    
    const git = simpleGit(repoRoot);
    
    // Get the git log with changes to the file showing who added/changed the flag
    const logOptions = [
      '-p',               // Show patches
      '--follow',         // Follow file renames
      '-S**Flag:** `',    // Look for string changes containing this pattern
      '--',
      relativePath
    ];
    
    const logs = await git.log(logOptions);
    
    if (!logs || !logs.all || logs.all.length === 0) {
      return null;
    }
    
    // Parse the log to find commits that changed the flag from TBD to something else
    for (const commit of logs.all) {
      // Get the diff for this commit
      const diff = await git.show([
        commit.hash,
        '--format=',  // No header, just diff
        '-p',
        relativePath
      ]);
      
      // Look for the flag pattern change
      const flagPattern = /-\s*\*\*Flag:\*\* `TBD`.*\n\+\s*\*\*Flag:\*\* `([^`]+)`/;
      const flagMatch = diff.match(flagPattern);
      
      if (flagMatch) {
        return commit.author_name.trim();
      }
    }
    
    return null;
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Could not determine solver from git history: ${error.message}`));
    return null;
  }
}

module.exports = updateReadme;
