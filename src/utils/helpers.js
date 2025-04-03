const path = require('path');
const fs = require('fs-extra');
const { findRepoRoot } = require('./gitHelpers');

/**
 * Convert a string to slug format (lowercase, underscores for spaces)
 * @param {string} str The string to slugify
 * @returns {string} The slugified string
 */
function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')    // Replace spaces with underscores
    .replace(/[^\w\-_]/g, '') // Remove non-word characters
    .replace(/\-+/g, '_');    // Replace multiple dashes with single underscore
}

/**
 * Validate that we're in the correct location for CTF operations
 * @param {Object} config The CTF configuration
 * @returns {Promise<string>} The path to the CTF root directory
 */
async function validateLocation(config) {
  const repoRoot = await findRepoRoot();
  if (!repoRoot) {
    throw new Error('Not in a git repository. Please run this command from a git repository.');
  }
  
  const cwd = process.cwd();
  const ctfName = config.ctfName;
  const parentDir = config.parentDir;
  
  // Check different possibilities for the CTF root directory
  
  // 1. Already in the CTF directory
  if (path.basename(cwd) === ctfName) {
    return cwd;
  }
  
  // 2. In parent directory (if specified)
  if (parentDir) {
    // Check if we're in the parent directory
    if (path.basename(cwd) === parentDir) {
      const ctfDir = path.join(cwd, ctfName);
      if (await fs.pathExists(ctfDir)) {
        return ctfDir;
      }
    }
    
    // Check if parent directory exists in repo root
    const fullParentPath = path.join(repoRoot, parentDir);
    if (await fs.pathExists(fullParentPath)) {
      const ctfDir = path.join(fullParentPath, ctfName);
      
      // Create CTF directory if it doesn't exist
      if (!await fs.pathExists(ctfDir)) {
        await fs.mkdirp(ctfDir);
      }
      
      return ctfDir;
    }
  }
  
  // 3. In repo root
  const possibleCtfDir = path.join(repoRoot, ctfName);
  if (await fs.pathExists(possibleCtfDir)) {
    return possibleCtfDir;
  }
  
  // 4. Create CTF directory in repo root if not found elsewhere
  const newCtfDir = path.join(repoRoot, ctfName);
  await fs.mkdirp(newCtfDir);
  return newCtfDir;
}

module.exports = {
  slugify,
  validateLocation
};
