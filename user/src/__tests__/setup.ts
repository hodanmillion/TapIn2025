// Test setup
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock logger to reduce noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Add a dummy test to prevent Jest error
test('setup', () => {
  expect(process.env.NODE_ENV).toBe('test');
});

// Add custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: Array<any>): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});