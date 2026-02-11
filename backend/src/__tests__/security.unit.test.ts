/**
 * TaxBridge Security Module — Unit Tests
 *
 * Tests password validation, input sanitization, secure token generation,
 * password hashing/verification, and admin API key authentication.
 */

import {
  sanitizeInput,
  validatePassword,
  generateSecureToken,
  hashPassword,
  verifyPassword,
} from '../lib/security';

// ═══════════════════════════════════════════════════════════════════════════
// Password Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('validatePassword', () => {
  it('should accept a strong password', () => {
    const result = validatePassword('SecurePass1!');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject short passwords', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('at least 8'));
  });

  it('should reject passwords without uppercase', () => {
    const result = validatePassword('lowercase1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('uppercase'));
  });

  it('should reject passwords without lowercase', () => {
    const result = validatePassword('UPPERCASE1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('lowercase'));
  });

  it('should reject passwords without numbers', () => {
    const result = validatePassword('NoNumbers!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('number'));
  });

  it('should reject passwords without special characters', () => {
    const result = validatePassword('NoSpecial1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('special'));
  });

  it('should return multiple errors for very weak passwords', () => {
    const result = validatePassword('abc');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Input Sanitization
// ═══════════════════════════════════════════════════════════════════════════

describe('sanitizeInput', () => {
  it('should strip script tags', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    const result = sanitizeInput(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should strip HTML tags', () => {
    const input = '<b>Bold</b> <a href="evil.com">Link</a>';
    const result = sanitizeInput(input);
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<a');
    expect(result).toContain('Bold');
    expect(result).toContain('Link');
  });

  it('should trim whitespace', () => {
    const result = sanitizeInput('  hello  ');
    expect(result).toBe('hello');
  });

  it('should truncate to 1000 characters', () => {
    const longInput = 'A'.repeat(2000);
    const result = sanitizeInput(longInput);
    expect(result.length).toBe(1000);
  });

  it('should handle empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('should handle null/undefined gracefully', () => {
    expect(sanitizeInput(null as any)).toBe('');
    expect(sanitizeInput(undefined as any)).toBe('');
  });

  it('should preserve normal text', () => {
    const input = 'Acme Trading Ltd - Invoice #12345';
    expect(sanitizeInput(input)).toBe(input);
  });

  it('should handle nested script tags', () => {
    const input = '<script><script>nested</script></script>';
    const result = sanitizeInput(input);
    expect(result).not.toContain('<script>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Secure Token Generation
// ═══════════════════════════════════════════════════════════════════════════

describe('generateSecureToken', () => {
  it('should generate a 64-char hex token by default', () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate token of specified byte length', () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it('should generate unique tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSecureToken()));
    expect(tokens.size).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Password Hashing & Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('hashPassword / verifyPassword', () => {
  it('should hash and verify a password', () => {
    const { hash, salt } = hashPassword('MySecurePassword1!');
    expect(hash).toBeTruthy();
    expect(salt).toBeTruthy();
    expect(verifyPassword('MySecurePassword1!', hash, salt)).toBe(true);
  });

  it('should reject wrong password', () => {
    const { hash, salt } = hashPassword('CorrectPassword1!');
    expect(verifyPassword('WrongPassword1!', hash, salt)).toBe(false);
  });

  it('should produce different hashes with different salts', () => {
    const result1 = hashPassword('SamePassword1!');
    const result2 = hashPassword('SamePassword1!');
    // Different salts → different hashes
    expect(result1.salt).not.toBe(result2.salt);
    expect(result1.hash).not.toBe(result2.hash);
  });

  it('should produce consistent hash with same salt', () => {
    const { hash: hash1, salt } = hashPassword('TestPassword1!');
    const { hash: hash2 } = hashPassword('TestPassword1!', salt);
    expect(hash1).toBe(hash2);
  });

  it('should produce 128-char hex hash (PBKDF2 SHA-512, 64 bytes)', () => {
    const { hash } = hashPassword('TestPassword1!');
    expect(hash).toHaveLength(128);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });
});
