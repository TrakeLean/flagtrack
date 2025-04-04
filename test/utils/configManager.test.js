const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const { createConfig, saveConfig, loadConfig, configExists } = require('../../src/utils/configManager');

// Mock the Conf module
jest.mock('conf', () => {
  const store = {};
  return function() {
    return {
      get: jest.fn((key) => store[key]),
      set: jest.fn((key, value) => { store[key] = value; return true; }),
      has: jest.fn((key) => store[key] !== undefined),
    };
  };
});

// Mock the git helpers
jest.mock('../../src/utils/gitHelpers', () => ({
  findRepoRoot: jest.fn().mockResolvedValue('/mock/repo/root'),
}));

describe('Config Manager', () => {
  beforeEach(() => {
    // Setup mock filesystem
    mockFs({
      '/mock/repo/root': {
        '.flagtrack': {
          'config.yml': 'ctfName: TestCTF\ncategories:\n  1: Web\n  2: Crypto\nparentDir: null\ncreatedAt: "2022-01-01T00:00:00.000Z"'
        }
      }
    });
  });

  afterEach(() => {
    // Restore filesystem
    mockFs.restore();
    jest.clearAllMocks();
  });

  describe('createConfig', () => {
    it('should create a config object with the correct structure', () => {
      const config = createConfig({
        ctfName: 'TestCTF',
        categories: { 1: 'Web', 2: 'Crypto' },
        parentDir: null
      });

      expect(config).toHaveProperty('ctfName', 'TestCTF');
      expect(config).toHaveProperty('categories', { 1: 'Web', 2: 'Crypto' });
      expect(config).toHaveProperty('parentDir', null);
      expect(config).toHaveProperty('createdAt');
    });
  });

  describe('saveConfig', () => {
    it('should save config to both store and file', async () => {
      const config = {
        ctfName: 'SaveTestCTF',
        categories: { 1: 'Web', 2: 'Crypto' },
        parentDir: null,
        createdAt: new Date().toISOString()
      };

      const result = await saveConfig(config);
      expect(result).toBe(true);

      // Check if file was created
      const configPath = '/mock/repo/root/.flagtrack/config.yml';
      expect(await fs.pathExists(configPath)).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('should load config from file if it exists', async () => {
      const config = await loadConfig();
      expect(config).toHaveProperty('ctfName', 'TestCTF');
      expect(config).toHaveProperty('categories');
      expect(config.categories).toHaveProperty('1', 'Web');
      expect(config.categories).toHaveProperty('2', 'Crypto');
    });

    it('should fall back to store if file does not exist', async () => {
      // Remove the config file
      await fs.remove('/mock/repo/root/.flagtrack/config.yml');
      
      // Mock the config store to return a config
      const loadConfig = require('../../src/utils/configManager').loadConfig;
      const config = await loadConfig();
      
      // This should now return the value from the mocked config store
      expect(config).toBeDefined();
    });
  });

  describe('configExists', () => {
    it('should return true if config file exists', async () => {
      const exists = await configExists();
      expect(exists).toBe(true);
    });

    it('should return false if config file does not exist', async () => {
      // Remove the config file
      await fs.remove('/mock/repo/root/.flagtrack/config.yml');
      
      // Mock the git helper to return null to simulate not being in a repo
      const gitHelpers = require('../../src/utils/gitHelpers');
      gitHelpers.findRepoRoot.mockResolvedValueOnce(null);
      
      const exists = await configExists();
      expect(exists).toBe(false);
    });
  });
});