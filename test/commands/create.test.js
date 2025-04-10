const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const create = require('../../src/commands/create');

// Mock dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('simple-git', () => {
  const mockGit = {
    add: jest.fn().mockResolvedValue(null),
    commit: jest.fn().mockResolvedValue(null),
    getRemotes: jest.fn().mockResolvedValue([{ name: 'origin' }]),
    push: jest.fn().mockResolvedValue(null),
    branch: jest.fn().mockResolvedValue({ all: ['main'] }),
    checkout: jest.fn().mockResolvedValue(null)
  };
  return jest.fn(() => mockGit);
});

jest.mock('../../src/utils/gitHelpers', () => ({
  findRepoRoot: jest.fn().mockResolvedValue('/mock/repo/root'),
  isGitRepo: jest.fn().mockResolvedValue(true),
  getCurrentBranch: jest.fn().mockResolvedValue('main'),
  getGitUserName: jest.fn().mockResolvedValue('Test User')
}));

jest.mock('../../src/utils/configManager', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    eventName: 'Testevent',
    structure: {
      Round1: {
        categories: {
          1: 'Web',
          2: 'Crypto'
        }
      }
    },
    parentDir: 'Testevent'
  })
}));

jest.mock('../../src/utils/helpers', () => ({
  slugify: jest.fn(str => str.toLowerCase().replace(/\s+/g, '_')),
  getEventContext: jest.fn().mockResolvedValue('/mock/repo/root/Testevent/Round1')
}));

// Mock console logs
global.console.log = jest.fn();
global.console.error = jest.fn();

// Mock process.exit
const originalExit = process.exit;
process.exit = jest.fn();

describe('Create Command', () => {
  let originalCwd;

  beforeEach(() => {
    // Save original cwd and mock it
    originalCwd = process.cwd;
    process.cwd = jest.fn().mockReturnValue('/mock/current');
    
    // Setup mock filesystem
    mockFs({
      '/mock/repo/root': {
        'Testevent': {
          'Round1': {
            '01_Web': {},
            '02_Crypto': {}
          }
        }
      },
      '/mock/current': {}
    });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore filesystem and process.cwd
    mockFs.restore();
    process.cwd = originalCwd;
  });

  afterAll(() => {
    process.exit = originalExit;
  });

  it('should create a task in the selected category', async () => {
    // Mock inquirer responses
    const inquirer = require('inquirer');
    inquirer.prompt.mockImplementation(questions => {
      const questionName = questions[0].name;
      
      if (questionName === 'event') {
        return Promise.resolve({ event: 'Round1' });
      }
      
      if (questionName === 'category') {
        return Promise.resolve({ category: 'Web' });
      }
      
      if (questionName === 'taskNum') {
        return Promise.resolve({ taskNum: 1 });
      }
      
      if (questionName === 'taskName') {
        return Promise.resolve({ taskName: 'Test Challenge' });
      }
      
      return Promise.resolve({});
    });
    
    // Execute the create command
    await create();
    
    // Verify task directory was created
    const taskPath = '/mock/repo/root/Testevent/Round1/01_Web/01_test_challenge';
    expect(await fs.pathExists(taskPath)).toBe(true);
    
    // Verify writeup file was created
    const writeupPath = path.join(taskPath, 'writeup.md');
    expect(await fs.pathExists(writeupPath)).toBe(true);
    
    // Verify expected directories were created
    const dirNames = ['challenge_files', 'workspace', 'exploit', 'screenshots'];
    for (const dir of dirNames) {
      expect(await fs.pathExists(path.join(taskPath, dir))).toBe(true);
    }
    
    // Verify Git operations (branch creation, commit, push)
    const simpleGit = require('simple-git')();
    expect(simpleGit.branch).toHaveBeenCalled();
    expect(simpleGit.checkout).toHaveBeenCalled();
    expect(simpleGit.add).toHaveBeenCalled();
    expect(simpleGit.commit).toHaveBeenCalledWith('Add task: Test Challenge');
    expect(simpleGit.push).toHaveBeenCalled();
  });

  it('should handle already existing task folder', async () => {
    // Create a task folder that already exists
    const existingTaskPath = '/mock/repo/root/Testevent/Round1/01_Web/01_test_challenge';
    await fs.ensureDir(existingTaskPath);
    
    // Mock inquirer responses
    const inquirer = require('inquirer');
    inquirer.prompt.mockImplementation(questions => {
      const questionName = questions[0].name;
      
      if (questionName === 'event') {
        return Promise.resolve({ event: 'Round1' });
      }
      
      if (questionName === 'category') {
        return Promise.resolve({ category: 'Web' });
      }
      
      if (questionName === 'taskNum') {
        return Promise.resolve({ taskNum: 1 });
      }
      
      if (questionName === 'taskName') {
        return Promise.resolve({ taskName: 'Test Challenge' });
      }
      
      return Promise.resolve({});
    });
    
    // Execute the create command
    await create();
    
    // Should create a task folder with timestamp
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Creating task with unique name'));
    
    // Verify Git operations still performed
    const simpleGit = require('simple-git')();
    expect(simpleGit.branch).toHaveBeenCalled();
    expect(simpleGit.checkout).toHaveBeenCalled();
  });

  it('should handle when not in a git repository', async () => {
    // Mock isGitRepo to return false
    const gitHelpers = require('../../src/utils/gitHelpers');
    gitHelpers.isGitRepo.mockResolvedValueOnce(false);
    
    // Mock inquirer responses
    const inquirer = require('inquirer');
    inquirer.prompt.mockImplementation(questions => {
      const questionName = questions[0].name;
      
      if (questionName === 'event') {
        return Promise.resolve({ event: 'Round1' });
      }
      
      if (questionName === 'category') {
        return Promise.resolve({ category: 'Web' });
      }
      
      if (questionName === 'taskNum') {
        return Promise.resolve({ taskNum: 1 });
      }
      
      if (questionName === 'taskName') {
        return Promise.resolve({ taskName: 'Test Challenge' });
      }
      
      return Promise.resolve({});
    });
    
    // Execute the create command
    await create();
    
    // Should create a task folder but skip git operations
    const taskPath = '/mock/repo/root/Testevent/Round1/01_Web/01_test_challenge';
    expect(await fs.pathExists(taskPath)).toBe(true);
    
    // Verify warning was shown about not being in a git repo
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Not in a git repository'));
  });

  it('should error if no config exists', async () => {
    // Mock loadConfig to return null (no config)
    const loadConfig = require('../../src/utils/configManager').loadConfig;
    loadConfig.mockResolvedValueOnce(null);
    
    // Execute the create command
    await create();
    
    // Verify error handling
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No configuration found'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});