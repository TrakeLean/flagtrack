const fs = require('fs-extra');
const path = require('path');
const mockFs = require('mock-fs');
const updateReadme = require('../../src/commands/updateReadme');

// Mock dependencies
jest.mock('../../src/utils/gitHelpers', () => ({
  findRepoRoot: jest.fn().mockResolvedValue('/mock/repo/root')
}));

jest.mock('simple-git', () => {
  const mockGit = {
    log: jest.fn().mockResolvedValue({
      all: [
        { hash: 'hash1', author_name: 'Alice' },
        { hash: 'hash2', author_name: 'Bob' }
      ]
    }),
    show: jest.fn().mockResolvedValue(`-**Flag:** \`TBD\`
+**Flag:** \`flag{challenge_one}\``)
  };
  return jest.fn(() => mockGit);
});

jest.mock('../../src/utils/configManager', () => ({
  loadConfig: jest.fn().mockResolvedValue({
    ctfName: 'TestCTF',
    categories: { 1: 'Web', 2: 'Crypto' },
    parentDir: 'TestCTF'
  })
}));

// Mock console logs
global.console.log = jest.fn();
global.console.error = jest.fn();

// Mock process.exit
const originalExit = process.exit;
process.exit = jest.fn();

describe('Update README Command', () => {
  beforeEach(() => {
    // Setup mock filesystem with completed challenges
    mockFs({
      '/mock/repo/root': {
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

  it('should generate a README with CTF progress information', async () => {
    // Execute the update README command
    await updateReadme();
    
    // Verify README was created
    const readmePath = '/mock/repo/root/README.md';
    expect(await fs.pathExists(readmePath)).toBe(true);
    
    // Read the created README
    const readmeContent = await fs.readFile(readmePath, 'utf8');
    
    // Verify README contains expected content
    expect(readmeContent).toContain('CTF Competitions Progress Tracker');
    expect(readmeContent).toContain('TestCTF');
    expect(readmeContent).toContain('Web (2/2 -');
    expect(readmeContent).toContain('Crypto (1/2 -');
    expect(readmeContent).toContain('flag{challenge_one}');
    expect(readmeContent).toContain('Alice');
    expect(readmeContent).toContain('Bob');
    expect(readmeContent).toContain('TBD'); // For unsolved challenge
    
    // Verify success message
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Generated README.md'));
  });

  it('should handle challenges with very long flags', async () => {
    // Add a challenge with a very long flag
    const longFlagWriteup = `# 🧩 Long Flag Challenge
**Category:** Web  
**Points:** 500  
**Flag:** \`flag{this_is_a_very_long_flag_that_should_be_truncated_in_the_readme_with_a_tooltip_when_rendered_by_github}\`  
**Solver:** Charlie

---

## Challenge Description

Challenge with long flag
`;
    
    await fs.ensureDir('/mock/repo/root/TestCTF/01_Web/03_long_flag');
    await fs.writeFile('/mock/repo/root/TestCTF/01_Web/03_long_flag/writeup.md', longFlagWriteup, 'utf8');
    
    // Execute the update README command
    await updateReadme();
    
    // Read the created README
    const readmeContent = await fs.readFile('/mock/repo/root/README.md', 'utf8');
    
    // Verify long flag is handled correctly (with HTML tooltip)
    expect(readmeContent).toContain('<code title=');
    expect(readmeContent).toContain('...</code>');
  });

  it('should handle multiple CTF events with proper hierarchy', async () => {
    // Add another CTF event
    await fs.ensureDir('/mock/repo/root/TestCTF/Round2/01_Web');
    
    const round2Challenge = `# 🧩 Round 2 Challenge
**Category:** Web  
**Points:** 150  
**Flag:** \`flag{round2_challenge}\`  
**Solver:** Dave

---

## Challenge Description

Challenge from Round 2
`;
    
    await fs.ensureDir('/mock/repo/root/TestCTF/Round2/01_Web/01_round2_challenge');
    await fs.writeFile('/mock/repo/root/TestCTF/Round2/01_Web/01_round2_challenge/writeup.md', round2Challenge, 'utf8');
    
    // Execute the update README command
    await updateReadme();
    
    // Read the created README
    const readmeContent = await fs.readFile('/mock/repo/root/README.md', 'utf8');
    
    // Verify multiple CTF events are handled correctly
    expect(readmeContent).toContain('Round2');
    expect(readmeContent).toContain('Dave');
    expect(readmeContent).toContain('flag{round2_challenge}');
  });

  it('should handle errors and exit gracefully', async () => {
    // Mock findRepoRoot to throw an error
    const findRepoRoot = require('../../src/utils/gitHelpers').findRepoRoot;
    findRepoRoot.mockRejectedValueOnce(new Error('Test error'));
    
    // Execute the update README command
    await updateReadme();
    
    // Verify error handling
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('README generation failed'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should extract flag solver from git history when possible', async () => {
    // This test relies on the mocked git.log and git.show functions
    // Execute the update README command
    await updateReadme();
    
    // Read the created README
    const readmeContent = await fs.readFile('/mock/repo/root/README.md', 'utf8');
    
    // Verify Alice is shown as solver for challenge_one
    expect(readmeContent).toContain('Challenge One') && expect(readmeContent).toContain('Alice');
    
    // Verify git operations were called to extract solver
    const simpleGit = require('simple-git')();
    expect(simpleGit.log).toHaveBeenCalled();
    expect(simpleGit.show).toHaveBeenCalled();
  });

  it('should handle challenges with missing metadata gracefully', async () => {
    // Add a challenge with incomplete metadata
    const incompleteWriteup = `# 🧩 Incomplete Challenge

**Category:** Web  

---

## Challenge Description

Challenge with incomplete metadata
`;
    
    await fs.ensureDir('/mock/repo/root/TestCTF/01_Web/99_incomplete');
    await fs.writeFile('/mock/repo/root/TestCTF/01_Web/99_incomplete/writeup.md', incompleteWriteup, 'utf8');
    
    // Execute the update README command
    await updateReadme();
    
    // Verify no errors occurred
    expect(console.error).not.toHaveBeenCalled();
    
    // Read the created README
    const readmeContent = await fs.readFile('/mock/repo/root/README.md', 'utf8');
    
    // Verify the incomplete challenge is included
    expect(readmeContent).toContain('Incomplete Challenge');
    // Should show as not completed
    expect(readmeContent).toContain('❌');
  });
});