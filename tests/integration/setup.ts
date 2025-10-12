/**
 * Setup for integration tests
 */

// Set environment variables for Transformers.js
process.env.NODE_ENV = 'test';

// Configure Transformers.js for testing
import { env } from '@huggingface/transformers';

// Use local cache for tests
env.cacheDir = './.cache/test';

// Allow remote models (don't require local models)
env.allowRemoteModels = true;

// Set up global test timeout
jest.setTimeout(300000); // 5 minutes for integration tests

// Clean up after all tests
afterAll(async () => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Small delay to ensure cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Log test start
beforeAll(() => {
  console.log('\n🚀 Starting integration tests...');
  console.log('These tests load real AI models and may take several minutes.\n');
});

afterAll(() => {
  console.log('\n✅ Integration tests completed.\n');
});

