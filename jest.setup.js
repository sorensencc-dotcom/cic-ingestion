/**
 * Jest Setup File
 * Initializes test environment
 */

// Suppress console output in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
// };

// Set test timeout
jest.setTimeout(10000);

// Mock environment variables if needed
process.env.NODE_ENV = 'test';
