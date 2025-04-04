const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const leaderboard = require('../../src/commands/leaderboard');

// Mock dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

jest.mock('../../src/utils/gitHelpers', () => ({
  findRepoRoot: jest.fn().mockResolvedValue('/mock/repo/root')
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

describe('Leaderboard Command', () => {
  beforeEach(() => {
    // Setup mock filesystem with completed challenges and solvers
    mockFs({
      '/mock/repo/root': {
        '.flagtrack': {
          'stats': {}
        },
        'TestCTF': {
          '01_Web': {
            '01_challenge_one': {
              'writeup.md': `# 🧩 Challenge One
**Category:** Web  
**Points:** 100  
**Flag:** \`flag{challenge_one}\`  
**Solver:** Alice

---

## Challenge Description

Test challenge 1
`
            },
            '02_challenge_two': {
              'writeup.md': `# 🧩 Challenge Two
**Category:** Web  
**Points:** 200  
**Flag:** \`flag{challenge_two}\`  
**Solver:** Bob

---

## Challenge Description

Test challenge 2
`
            }
          },
          '02_Crypto': {
            '01_challenge_three': {
              'writeup.md': `# 🧩 Challenge Three
**Category:** Crypto  
**Points:** 300  
**Flag:** \`flag{challenge_three}\`  
**Solver:** Alice

---

## Challenge Description

Test challenge 3
`
            },
            '02_challenge_four': {
              'writeup.md': `# 🧩 Challenge Four
**Category:** Crypto  
**Points:** 400  
**Flag:** \`TBD\`  
**Solver:** TBD

---

## Challenge Description

Test challenge 4
`
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

  it('should generate a leaderboard with correct solver statistics', async () => {
    // Mock inquirer to select "no export"
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValueOnce({ exportOption: 'none' });
    
    // Execute the leaderboard command
    await leaderboard();
    
    // Verify console output contains leaderboard information
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('CTF LEADERBOARD'));
    
    // Check for Alice's stats (should have 2 challenges, 400 points)
    const allCalls = console.log.mock.calls.flat().join('\n');
    expect(allCalls).toMatch(/Alice.*400/);
    
    // Check for Bob's stats (should have 1 challenge, 200 points)
    expect(allCalls).toMatch(/Bob.*200/);
    
    // Should show total challenges (4) and solved (3)
    expect(allCalls).toMatch(/Total Challenges: 4/);
    expect(allCalls).toMatch(/Solved: 3/);
  });

  it('should export leaderboard as Markdown when selected', async () => {
    // Mock inquirer to select Markdown export
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValueOnce({ exportOption: 'md' });
    
    // Execute the leaderboard command
    await leaderboard();
    
    // Verify stats directory exists
    const statsDir = '/mock/repo/root/.flagtrack/stats';
    expect(await fs.pathExists(statsDir)).toBe(true);
    
    // Verify MD file was created
    const files = await fs.readdir(statsDir);
    expect(files.some(file => file.endsWith('.md'))).toBe(true);
    
    // Verify success message
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Markdown leaderboard exported'));
  });

  it('should export leaderboard as JSON when selected', async () => {
    // Mock inquirer to select JSON export
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValueOnce({ exportOption: 'json' });
    
    // Execute the leaderboard command
    await leaderboard();
    
    // Verify stats directory exists
    const statsDir = '/mock/repo/root/.flagtrack/stats';
    expect(await fs.pathExists(statsDir)).toBe(true);
    
    // Verify JSON file was created
    const files = await fs.readdir(statsDir);
    expect(files.some(file => file.endsWith('.json'))).toBe(true);
    
    // Verify success message
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('JSON leaderboard exported'));
    
    // Read the JSON file and verify it has the correct structure
    const jsonFile = files.find(file => file.endsWith('.json'));
    const jsonPath = path.join(statsDir, jsonFile);
    const jsonContent = await fs.readFile(jsonPath, 'utf8');
    const data = JSON.parse(jsonContent);
    
    // Verify solvers data
    expect(data).toHaveProperty('solvers');
    expect(data.solvers.length).toBe(2); // Alice and Bob
    
    // Verify totals data
    expect(data).toHaveProperty('totals');
    expect(data.totals.challenges).toBe(4);
    expect(data.totals.solved).toBe(3);
  });

  it('should handle errors and exit gracefully', async () => {
    // Mock findRepoRoot to throw an error
    const findRepoRoot = require('../../src/utils/gitHelpers').findRepoRoot;
    findRepoRoot.mockRejectedValueOnce(new Error('Test error'));
    
    // Execute the leaderboard command
    await leaderboard();
    
    // Verify error handling
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Leaderboard generation failed'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should process solvers string correctly', async () => {
    // Add a challenge with multiple solvers
    await fs.ensureDir('/mock/repo/root/TestCTF/01_Web/03_challenge_multi');
    const multiSolverWriteup = `# 🧩 Multi-Solver Challenge
**Category:** Web  
**Points:** 250  
**Flag:** \`flag{multi_solver}\`  
**Solver:** Alice, Bob, and Charlie

---

## Challenge Description

Challenge with multiple solvers
`;
    await fs.writeFile('/mock/repo/root/TestCTF/01_Web/03_challenge_multi/writeup.md', multiSolverWriteup, 'utf8');
    
    // Mock inquirer to select "no export"
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValueOnce({ exportOption: 'none' });
    
    // Execute the leaderboard command
    await leaderboard();
    
    // Verify console output now includes Charlie as well
    const allCalls = console.log.mock.calls.flat().join('\n');
    expect(allCalls).toMatch(/Charlie/);
  });

  it('should handle "Team effort" solver correctly', async () => {
    // Add a challenge with "Team effort" as solver
    await fs.ensureDir('/mock/repo/root/TestCTF/02_Crypto/03_team_challenge');
    const teamEffortWriteup = `# 🧩 Team Challenge
**Category:** Crypto  
**Points:** 500  
**Flag:** \`flag{team_challenge}\`  
**Solver:** Team effort

---

## Challenge Description

Challenge solved by the whole team
`;
    await fs.writeFile('/mock/repo/root/TestCTF/02_Crypto/03_team_challenge/writeup.md', teamEffortWriteup, 'utf8');
    
    // Mock inquirer to select "no export"
    const inquirer = require('inquirer');
    inquirer.prompt.mockResolvedValueOnce({ exportOption: 'none' });
    
    // Execute the leaderboard command
    await leaderboard();
    
    // Verify console output includes "Team effort"
    const allCalls = console.log.mock.calls.flat().join('\n');
    expect(allCalls).toMatch(/Team effort/);
  });
});