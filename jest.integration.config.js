/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.integration.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  // Longer timeout for integration tests that load real models
  testTimeout: 300000, // 5 minutes
  // Run tests sequentially to avoid resource conflicts
  maxWorkers: 1,
  // Detect handles that aren't properly cleaned up
  detectOpenHandles: true,
  // Force exit to prevent hanging
  forceExit: true,
  // Setup environment
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
};

