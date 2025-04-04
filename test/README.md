# FlagTrack Test Suite

This directory contains comprehensive tests for the FlagTrack package. The tests ensure the correct functionality of all components and commands in the package.

## Test Structure

The test suite is organized to mirror the structure of the package:

```
test/
├── commands/           # Tests for CLI commands
│   ├── create.test.js
│   ├── leaderboard.test.js
│   ├── setup.test.js
│   ├── solve.test.js
│   └── updateReadme.test.js
├── utils/              # Tests for utility functions
│   ├── configManager.test.js
│   ├── gitHelpers.test.js
│   └── helpers.test.js
├── index.test.js       # Tests for package entry point
├── setup.js            # Common test setup
└── README.md           # This file
```

## Running Tests

You can run the tests using the following npm commands:

```bash
# Run all tests
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx jest test/commands/create.test.js

# Run tests matching a specific name pattern
npx jest -t "should create a task"

# Run all tests in a specific directory
npx jest test/commands
```

## Running Specific Tests

If you need to run only specific tests, you have several options:

1. **Using test.only**: In your test file, change `test()` to `test.only()` to run only that test:

```javascript
// Only this test will run
test.only('should create a task', () => {
  // Test code
});

// This test will be skipped
test('should handle errors', () => {
  // Test code
});
```

2. **Using describe.only**: Similarly, you can run only a specific suite:

```javascript
describe.only('Create Command', () => {
  // Only tests in this describe block will run
});
```

Remember to remove `.only` before committing your code.

## Test Coverage

The test suite aims for high code coverage. Coverage reports are generated in the `coverage/` directory when running tests with the `--coverage` flag or using the `npm run test:coverage` command.

## Mock Dependencies

These tests use a few key mocking strategies:

1. **Mock FS**: The `mock-fs` package simulates the filesystem, allowing tests to check file operations without actually reading or writing to the real filesystem.

2. **Jest Mocks**: All external dependencies and internal modules are mocked using Jest's mocking capabilities.

3. **Console Mocking**: Console output is mocked to keep test output clean. You can disable this in `setup.js` if needed for debugging.

## Adding Tests

When adding new features to FlagTrack, please also add corresponding tests. Follow these guidelines:

1. Create test files that mirror the structure of the code being tested
2. Use appropriate mocking for external dependencies
3. Test both success and error paths
4. Aim for high coverage of code paths

## Troubleshooting Tests

If you encounter issues when running tests:

1. **Mock FS Issues**: If tests fail with filesystem errors, ensure that `mockFs.restore()` is being called after each test. The `setup.js` file should handle this automatically.

2. **Console Output**: If you need to see console output during testing (for debugging), comment out the console mocks in `setup.js`.

3. **Jest Snapshot Issues**: If snapshot tests fail, you may need to update snapshots with `jest -u`.