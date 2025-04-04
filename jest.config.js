module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: [
      'src/**/*.js',
      '!**/node_modules/**',
      '!**/coverage/**',
      '!**/test/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    testMatch: ['**/test/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  };