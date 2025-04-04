const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const solve = require('../../src/commands/solve');

// Mock dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('simple-git', () => {
  const mockGit = {
    add: jest.fn().mockResolvedValue(null),
    commit: jest.fn().mockResolvedValue(null),
    push: jest.fn().mockResolvedValue(null),
    checkout: jest.fn().mockResolvedValue(null),
    pull: jest.fn().mockResolvedValue(null),
    merge: jest.fn().mockResolvedValue(null),
    deleteLocalBranch: jest.fn().mockResolvedValue(null),
    status: jest.fn().mockResolvedValue({ files: [] }),
    branch: jest.fn().mockResolvedValue({ all: ['main', 'master'] })
  };
  return jest.fn(() => mockGit);
});

jest.mock('../../src/utils/gitHelpers', () => ({
  getCurrentBranch: jest.fn().mockResolvedValue('web-01-test_challenge'),
  getGitUserName: jest.fn().mockResolvedValue('Test User')
}));

jest.mock('../../src/utils/configManager', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    ctfName: 'TestCTF',
    categories: { 1: 'Web', 2: 'Crypto' },
    parentDir: 'TestCTF'
  })
}));

jest.mock('../../src/utils/helpers', () => ({
  validateLocation: jest.fn().mockResolvedValue('/mock/repo/root/TestCTF')
}));

// Mock console logs
global.console.log = jest.fn();
global.console.error = jest.fn();

// Mock process.exit
const originalExit = process.exit;
process.exit = jest.fn();

describe('Solve Command', () => {
  beforeEach(() => {
    // Setup mock filesystem
    mockFs({
      '/mock/repo/root': {
        'TestCTF': {
          '01_Web': {
            '01_test_challenge': {
              'writeup.md': `# 🧩 Test Challenge

**Category:** Web  
**Points:** TBD  
**Flag:** \`TBD\`  
**Solver:** TBD

---

## 📝 Challenge Description

> _Test description_

---

## 🛠️ Steps to writeup

_Steps_

---

## 🧠 Notes & Takeaways

_Notes_

---`
            }
          }
        }
      }
    });
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore filesystem
    mockFs.restore();
  });

  afterAll(() => {
    process.exit = originalExit;
  });

  it('should update writeup with flag, points, and solver', async () => {
    // Mock inquirer responses
    const inquirer = require('inquirer');
    inquirer.prompt.mockImplementation(questions => {
      const questionName = questions[0].name;
      
      if (questionName === 'solvedFlag') {
        return Promise.resolve({ solvedFlag: true });
      }
      
      if (questionName === 'flagValue') {
        return Promise.resolve({ flagValue: 'flag{test_challenge_solved}' });
      }
      
      if (questionName === 'solverName') {
        return Promise.resolve({ solverName: 'Test User' });
      }
      
      if (questionName === 'pointsValue') {
        return Promise.resolve({ pointsValue: 500 });
      }
      
      if (questionName === 'finishTask') {
        return Promise.resolve({ finishTask: false });
      }
      
      return Promise.resolve({});
    });
    
    // Execute the solve command
    await solve();
    
    // Read the updated writeup file
    const writeupPath = '/mock/repo/root/TestCTF/01_Web/01_test_challenge/writeup.md';
    const writeupContent = await fs.readFile(writeupPath, 'utf-8');
    
    // Verify the writeup was updated with flag, points, and solver
    expect(writeupContent).toContain('**Flag:** `flag{test_challenge_solved}`');
    expect(writeupContent).toContain('**Points:** 500');
    expect(writeupContent).toContain('**Solver:** Test User');
    
    // Verify Git operations
    const simpleGit = require('simple-git')();
    expect(simpleGit.add).toHaveBeenCalled();
    expect(simpleGit.commit).toHaveBeenCalledWith(expect.stringContaining('Add flag solution'));
    expect(simpleGit.push).toHaveBeenCalled();
  });

  it('should merge branch when task is finished', async () => {
    // Mock inquirer to indicate the task is already complete and should be merged
    const inquirer = require('inquirer');
    
    // First, prepare a completed writeup
    const writeupPath = '/mock/repo/root/TestCTF/01_Web/01_test_challenge/writeup.md';
    const completedWriteup = `# 🧩 Test Challenge

**Category:** Web  
**Points:** 500  
**Flag:** \`flag{test_challenge_solved}\`  
**Solver:** Test User

---

## 📝 Challenge Description

> _Test description_

---

## 🛠️ Steps to writeup

_Steps_

---

## 🧠 Notes & Takeaways

_Notes_

---`;
    
    await fs.writeFile(writeupPath, completedWriteup, 'utf-8');
    
    // Mock inquirer to indicate task should be finished
    inquirer.prompt.mockResolvedValueOnce({ finishTask: true });
    
    // Execute the solve command
    await solve();
    
    // Verify branch merge operations
    const simpleGit = require('simple-git')();
    expect(simpleGit.checkout).toHaveBeenCalledWith('main');
    expect(simpleGit.pull).toHaveBeenCalled();
    expect(simpleGit.merge).toHaveBeenCalled();
    expect(simpleGit.push).toHaveBeenCalled();
    expect(simpleGit.deleteLocalBranch).toHaveBeenCalled();
    
    // Verify success message
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Task completed and branch cleaned up'));
  });

  it('should not allow solving tasks on main branch', async () => {
    // Mock getCurrentBranch to return 'main'
    const gitHelpers = require('../../src/utils/gitHelpers');
    gitHelpers.getCurrentBranch.mockResolvedValueOnce('main');
    
    // Execute the solve command
    await solve();
    
    // Verify error handling
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cannot run solve on main/master branch'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle when no flag is found yet', async () => {
    // Mock inquirer to indicate the flag is not solved yet
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValueOnce({ solvedFlag: false });
    
    // Execute the solve command
    await solve();
    
    // Verify appropriate message
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Task remains unsolved'));
    
    // Verify no Git operations were performed
    const simpleGit = require('simple-git')();
    expect(simpleGit.add).not.toHaveBeenCalled();
    expect(simpleGit.commit).not.toHaveBeenCalled();
  });

  it('should handle missing config', async () => {
    // Mock loadConfig to return null
    const loadConfig = require('../../src/utils/configManager').loadConfig;
    loadConfig.mockResolvedValueOnce(null);
    
    // Execute the solve command
    await solve();
    
    // Verify error handling
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No configuration found'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle task not found from branch name', async () => {
    // Mock getCurrentBranch to return an unrecognized branch name
    const gitHelpers = require('../../src/utils/gitHelpers');
    gitHelpers.getCurrentBranch.mockResolvedValueOnce('unknown-branch');
    
    // Mock inquirer for manual selection
    const inquirer = require('inquirer');
    inquirer.prompt.mockImplementation(questions => {
      const questionName = questions[0].name;
      
      if (questionName === 'categoryIndex') {
        return Promise.resolve({ categoryIndex: 0 });
      }
      
      if (questionName === 'taskIndex') {
        return Promise.resolve({ taskIndex: 0 });
      }
      
      // For the solve flow questions
      if (questionName === 'solvedFlag') {
        return Promise.resolve({ solvedFlag: true });
      }
      
      if (questionName === 'flagValue') {
        return Promise.resolve({ flagValue: 'flag{manually_selected}' });
      }
      
      return Promise.resolve({});
    });
    
    // Execute the solve command
    await solve();
    
    // Verify warning about branch name
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Could not determine task from branch name'));
  });
});