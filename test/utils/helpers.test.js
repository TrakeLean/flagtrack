const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const { slugify, getEventContext } = require('../../src/utils/helpers');

// Mock git helpers
jest.mock('../../src/utils/gitHelpers', () => ({
  findRepoRoot: jest.fn().mockResolvedValue('/mock/repo/root')
}));

describe('Helpers', () => {
  beforeEach(() => {
    // Setup mock filesystem
    mockFs({
      '/mock/repo/root': {
        'event_Name': {
          '01_Crypto': {},
          '02_Web': {}
        }
      },
      '/mock/repo/root/parent_dir': {
        'event_Name': {}
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

  describe('getEventContext', () => {
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/current');
    });

    afterEach(() => {
      process.cwd = originalCwd;
    });

    it('should return the event directory if already in it', async () => {
      process.cwd = jest.fn().mockReturnValue('/mock/repo/root/event_Name');
      
      const config = {
        eventName: 'event_Name',
        parentDir: null
      };
      
      const result = await getEventContext(config);
      expect(result).toBe('/mock/repo/root/event_Name');
    });

    it('should find event directory in the parent directory', async () => {
      const config = {
        eventName: 'event_Name',
        parentDir: 'parent_dir'
      };
      
      const result = await getEventContext(config);
      expect(result).toBe('/mock/repo/root/parent_dir/event_Name');
    });

    it('should return the event directory from repo root', async () => {
      const config = {
        eventName: 'event_Name',
        parentDir: null
      };
      
      const result = await getEventContext(config);
      expect(result).toBe('/mock/repo/root/event_Name');
    });

    it('should create event directory if it does not exist', async () => {
      const config = {
        eventName: 'New_event',
        parentDir: null
      };
      
      const result = await getEventContext(config);
      expect(result).toBe('/mock/repo/root/New_event');
      
      // Check if directory was created
      expect(await fs.pathExists('/mock/repo/root/New_event')).toBe(true);
    });

    it('should throw an error if not in a git repo', async () => {
      // Mock findRepoRoot to return null
      const { findRepoRoot } = require('../../src/utils/gitHelpers');
      findRepoRoot.mockResolvedValueOnce(null);
      
      const config = {
        eventName: 'event_Name',
        parentDir: null
      };
      
      await expect(getEventContext(config)).rejects.toThrow('Not in a git repository');
    });
  });
});