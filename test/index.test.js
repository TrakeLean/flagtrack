const flagtrack = require('../index');

describe('FlagTrack Package Entry Point', () => {
  it('should export all commands correctly', () => {
    // Verify commands are exported
    expect(flagtrack).toHaveProperty('commands');
    expect(flagtrack.commands).toHaveProperty('setup');
    expect(flagtrack.commands).toHaveProperty('create');
    expect(flagtrack.commands).toHaveProperty('solve');
    expect(flagtrack.commands).toHaveProperty('leaderboard');
    expect(flagtrack.commands).toHaveProperty('updateReadme');
    
    // Verify each command is a function
    expect(typeof flagtrack.commands.setup).toBe('function');
    expect(typeof flagtrack.commands.create).toBe('function');
    expect(typeof flagtrack.commands.solve).toBe('function');
    expect(typeof flagtrack.commands.leaderboard).toBe('function');
    expect(typeof flagtrack.commands.updateReadme).toBe('function');
  });

  it('should export utility functions correctly', () => {
    // Verify utils are exported
    expect(flagtrack).toHaveProperty('utils');
    expect(flagtrack.utils).toHaveProperty('config');
    expect(flagtrack.utils).toHaveProperty('git');
    expect(flagtrack.utils).toHaveProperty('helpers');
    
    // Verify specific utility functions
    expect(flagtrack.utils.config).toHaveProperty('loadConfig');
    expect(flagtrack.utils.git).toHaveProperty('findRepoRoot');
    expect(flagtrack.utils.git).toHaveProperty('getCurrentBranch');
    expect(flagtrack.utils.helpers).toHaveProperty('slugify');
    expect(flagtrack.utils.helpers).toHaveProperty('getEventContext');
  });
});