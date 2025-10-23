/**
 * Jest setup file for polyfills and global configurations
 */

// Simple fetch polyfill for Node.js environment
global.fetch = jest.fn();
global.Request = jest.fn();
global.Response = jest.fn();
global.Headers = jest.fn();
