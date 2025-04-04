// This file contains setup code that will be run before tests
const mockFs = require('mock-fs');

// Reset all mocks after each test
afterEach(() => {
  // Restore the filesystem if it was mocked
  if (mockFs.restore) {
    mockFs.restore();
  }
  
  // Reset all module mocks
  jest.resetAllMocks();
});

// Mock console methods to avoid cluttering test output
// You can comment these out when debugging tests
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();