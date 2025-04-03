const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');

/**
 * Check if the current directory is inside a git repository
 * @returns {Promise<boolean>} True if in a git repo, false otherwise
 */
async function isGitRepo() {
  try {
    const git = simpleGit();
    await git.revparse(['--is-inside-work-tree']);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the name of the current git branch
 * @returns {Promise<string|null>} Branch name or null if not in a repo or error
 */
async function getCurrentBranch() {
  try {
    const git = simpleGit();
    const branchSummary = await git.branch();
    return branchSummary.current;
  } catch (error) {
    return null;
  }
}

/**
 * Get the git user's name from the local or global config
 * @returns {Promise<string|null>} User name or null if not configured
 */
async function getGitUserName() {
  try {
    const git = simpleGit();
    
    // Try local config first
    try {
      const localName = await git.raw(['config', 'user.name']);
      if (localName && localName.trim()) {
        return localName.trim();
      }
    } catch (e) {
      // Ignore errors for local config
    }
    
    // Try global config
    try {
      const globalName = await git.raw(['config', '--global', 'user.name']);
      if (globalName && globalName.trim()) {
        return globalName.trim();
      }
    } catch (e) {
      // Ignore errors for global config
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Find the root of the git repository
 * @param {string} [startPath=process.cwd()] The path to start searching from
 * @returns {Promise<string|null>} Path to the git repo root, or null if not found
 */
async function findRepoRoot(startPath = process.cwd()) {
  try {
    if (!await isGitRepo()) {
      return null;
    }
    
    const git = simpleGit(startPath);
    const rootPathResult = await git.revparse(['--show-toplevel']);
    return rootPathResult.trim();
  } catch (error) {
    // Try manually checking parent directories
    let currentPath = path.resolve(startPath);
    
    for (let i = 0; i < 5; i++) {  // Check up to 5 levels up
      // Check for common repository indicators
      if (await fs.pathExists(path.join(currentPath, '.git'))) {
        return currentPath;
      }
      
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {  // Reached filesystem root
        break;
      }
      
      currentPath = parentPath;
    }
    
    return null;
  }
}

/**
 * Create GitHub Actions workflow file for auto-updating README
 * @param {string} repoRoot Path to the repository root
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function createGitHubActions(repoRoot) {
  try {
    // Create .github/workflows directory
    const workflowsDir = path.join(repoRoot, '.github', 'workflows');
    await fs.ensureDir(workflowsDir);
    
    // Create scripts directory for the generator script
    const scriptsDir = path.join(repoRoot, '.github', 'scripts');
    await fs.ensureDir(scriptsDir);
    
    // Copy the update-readme.yml workflow file
    const workflowContent = `name: Update CTF Progress README
on:
  push:
    paths:
      - '**/*.md'
      - '!README.md'
  workflow_dispatch:  # Allow manual trigger
jobs:
  update-readme:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Need full history for git log
        
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          
      - name: Install flagtrack globally
        run: npm install -g flagtrack
          
      - name: Run README generator
        run: flagtrack update
        
      - name: Commit and push if changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add README.md
          
          # Only commit if there are changes
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "📊 Update CTF progress tracker"
            git push
          fi
`;
    
    await fs.writeFile(path.join(workflowsDir, 'update-readme.yml'), workflowContent);
    
    return true;
  } catch (error) {
    console.error('Error creating GitHub Actions workflow:', error);
    return false;
  }
}

module.exports = {
  isGitRepo,
  getCurrentBranch,
  getGitUserName,
  findRepoRoot,
  createGitHubActions
};
