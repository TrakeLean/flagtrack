const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const { slugify, validateLocation } = require('../../src/utils/helpers');

// Mock git helpers
jest.mock('../../src/utils/gitHelpers', () => ({
  findRepoRoot: jest.fn().mockResolvedValue('/mock/repo/root')
}));

describe('Helpers', () => {
  beforeEach(() => {
    // Setup mock filesystem
    mockFs({
      '/mock/repo/root': {
        'CTF_Name': {
          '01_Crypto': {},
          '02_Web': {}
        }
      },
      '/mock/repo/root/parent_dir': {
        'CTF_Name': {}
      },
      '/current': {}
    });
  });

  afterEach(() => {
    // Restore filesystem
    mockFs.restore();
    jest.clearAllMocks();
  });

  describe('slugify', () => {
    it('should convert spaces to underscores', () => {
      expect(slugify('Hello World')).toBe('hello_world');
    });

    it('should remove special characters', () => {
      expect(slugify('Test@#$%^&*()')).toBe('test');
    });

    it('should convert multiple spaces to single underscore', () => {
      expect(slugify('Multiple   Spaces')).toBe('multiple_spaces');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle strings with leading/trailing spaces', () => {
      expect(slugify(' Trimmed ')).toBe('trimmed');
    });
  });

  describe('validateLocation', () => {
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/current');
    });

    afterEach(() => {
      process.cwd = originalCwd;
    });

    it('should return the CTF directory if already in it', async () => {
      process.cwd = jest.fn().mockReturnValue('/mock/repo/root/CTF_Name');
      
      const config = {
        ctfName: 'CTF_Name',
        parentDir: null
      };
      
      const result = await validateLocation(config);
      expect(result).toBe('/mock/repo/root/CTF_Name');
    });

    it('should find CTF directory in the parent directory', async () => {
      const config = {
        ctfName: 'CTF_Name',
        parentDir: 'parent_dir'
      };
      
      const result = await validateLocation(config);
      expect(result).toBe('/mock/repo/root/parent_dir/CTF_Name');
    });

    it('should return the CTF directory from repo root', async () => {
      const config = {
        ctfName: 'CTF_Name',
        parentDir: null
      };
      
      const result = await validateLocation(config);
      expect(result).toBe('/mock/repo/root/CTF_Name');
    });

    it('should create CTF directory if it does not exist', async () => {
      const config = {
        ctfName: 'New_CTF',
        parentDir: null
      };
      
      const result = await validateLocation(config);
      expect(result).toBe('/mock/repo/root/New_CTF');
      
      // Check if directory was created
      expect(await fs.pathExists('/mock/repo/root/New_CTF')).toBe(true);
    });

    it('should throw an error if not in a git repo', async () => {
      // Mock findRepoRoot to return null
      const { findRepoRoot } = require('../../src/utils/gitHelpers');
      findRepoRoot.mockResolvedValueOnce(null);
      
      const config = {
        ctfName: 'CTF_Name',
        parentDir: null
      };
      
      await expect(validateLocation(config)).rejects.toThrow('Not in a git repository');
    });
  });
});