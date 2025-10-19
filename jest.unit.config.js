/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/tests/unit/**/*.test.ts'],
  testPathIgnorePatterns: [
    'tests/integration/',
    'tests/e2e/',
    'src/infra/workers/WorkerPool.test.ts',
    '/node_modules/'
  ],
};
