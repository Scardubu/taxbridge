const { describe, it, expect } = require('@jest/globals');

describe('Basic Unit Tests', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    expect('hello world').toContain('hello');
  });

  it('should handle array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr).toHaveLength(5);
    expect(arr).toContain(3);
  });

  it('should handle object operations', () => {
    const obj = { name: 'TaxBridge', version: '1.0.0' };
    expect(obj.name).toBe('TaxBridge');
    expect(obj).toHaveProperty('version');
  });
});
