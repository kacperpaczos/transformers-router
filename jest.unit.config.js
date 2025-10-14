/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/tests/unit/**/*.test.ts', '**/src/**/*.test.ts'],
  testPathIgnorePatterns: [
    'tests/integration/',
    'tests/e2e/',
    '/node_modules/'
  ],
};
