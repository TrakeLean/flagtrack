const fs = require('fs-extra');
const path = require('path');
const Conf = require('conf');
const YAML = require('yaml');
const { findRepoRoot } = require('./gitHelpers');

// Create a config store for flagtrack
const configStore = new Conf({
  projectName: 'flagtrack',
  defaults: {}
});

/**
 * Create a new event config object
 * @param {Object} options
 * @param {string} options.eventName The name of the event
 * @param {Object} options.categories Key-value pairs of category numbers and names
 * @param {string|null} options.parentDir Optional parent directory for event challenges
 * @returns {Object} The config object
 */
function createConfig({ eventName, categories, parentDir }) {
  return {
    eventName,
    categories,
    parentDir,
    createdAt: new Date().toISOString()
  };
}

/**
 * Save configuration to both the config store and a local file
 * @param {Object} config The configuration object
 * @returns {Promise<boolean>} True if saved successfully
 */
async function saveConfig(config) {
  try {
    // Save to config store for global access
    configStore.set('currentConfig', config);
    
    // Save to local file for project-specific access
    const repoRoot = await findRepoRoot();
    if (repoRoot) {
      const configDir = path.join(repoRoot, '.flagtrack');
      await fs.ensureDir(configDir);
      
      // Save as YAML for better readability
      const yamlConfig = YAML.stringify(config);
      await fs.writeFile(path.join(configDir, 'config.yml'), yamlConfig, 'utf-8');
    }
    
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Load configuration from both local file and config store.
 * @returns {Promise<Object|null>} The configuration object or null if not found
 */
async function loadConfig() {
  try {
    const configPath = await getConfigPath();
    
    if (configPath && await fs.pathExists(configPath)) {
      const yamlContent = await fs.readFile(configPath, 'utf-8');
      return YAML.parse(yamlContent);
    }

    // Fall back to config store
    return configStore.get('currentConfig');
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

/**
 * Resolve the full path to the local config.yml file.
 * @returns {Promise<string|null>} Path to the config file, or null if not in a git repo
 */
async function getConfigPath() {
  const repoRoot = await findRepoRoot();
  if (!repoRoot) return null;

  return path.join(repoRoot, '.flagtrack', 'config.yml');
}

/**
 * Check if configuration exists in the current project
 * @returns {Promise<boolean>} True if config exists, false otherwise
 */

async function configExists() {
  try {
    // Try to find a local config file
    const repoRoot = await findRepoRoot();
    if (repoRoot) {
      const localConfigPath = path.join(repoRoot, '.flagtrack', 'config.yml');
      return await fs.pathExists(localConfigPath);
    }
    
    // If no local config, check the config store
    return configStore.has('currentConfig');
  } catch (error) {
    console.error('Error checking config existence:', error);
    return false;
  }
}

module.exports = {
  createConfig,
  saveConfig,
  loadConfig,
  configExists,
  getConfigPath
};
