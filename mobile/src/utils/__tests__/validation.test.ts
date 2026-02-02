import { validationRules } from '../validation';

describe('Validation Service', () => {
  describe('customerName validation', () => {
    const rule = validationRules.customerName;

    it('should accept valid names', () => {
      expect(rule.custom?.('John Doe')).toBeNull();
      expect(rule.custom?.('Mary Jane')).toBeNull();
    });

    it('should reject names with numbers', () => {
      const result = rule.custom?.('John123');
      expect(result).toBeTruthy();
      expect(result).toContain('letters');
    });

    it('should reject names with special characters', () => {
      const result = rule.custom?.('John@Doe');
      expect(result).toBeTruthy();
    });

    it('should accept names with spaces', () => {
      expect(rule.custom?.('John Doe Smith')).toBeNull();
    });
  });

  describe('customerTIN validation', () => {
    const rule = validationRules.customerTIN;

    it('should accept valid TIN format', () => {
      expect(rule.custom?.('1234567890')).toBeNull();
      expect(rule.custom?.('ABC-123-456')).toBeNull();
    });

    it('should enforce minimum length', () => {
      expect(rule.minLength).toBe(10);
    });

    it('should enforce maximum length', () => {
      expect(rule.maxLength).toBe(20);
    });

    it('should accept alphanumeric with hyphens', () => {
      expect(rule.custom?.('12345-6789-0')).toBeNull();
      expect(rule.custom?.('ABC123DEF456')).toBeNull();
    });

    it('should reject TIN with spaces', () => {
      const result = rule.custom?.('1234 5678 90');
      expect(result).toBeTruthy();
    });

    it('should accept empty TIN (not required)', () => {
      expect(rule.required).toBeFalsy();
      expect(rule.custom?.('')).toBeNull();
    });
  });

  describe('description validation', () => {
    const rule = validationRules.description;

    it('should be required', () => {
      expect(rule.required).toBe(true);
    });

    it('should enforce minimum length', () => {
      expect(rule.minLength).toBe(2);
    });

    it('should enforce maximum length', () => {
      expect(rule.maxLength).toBe(200);
    });
  });

  describe('quantity validation', () => {
    const rule = validationRules.quantity;

    it('should be required', () => {
      expect(rule.required).toBe(true);
    });

    it('should accept positive numbers', () => {
      expect(rule.custom?.('5')).toBeNull();
      expect(rule.custom?.('100')).toBeNull();
    });

    it('should reject zero', () => {
      const result = rule.custom?.('0');
      expect(result).toBeTruthy();
      expect(result).toContain('greater than 0');
    });

    it('should reject negative numbers', () => {
      const result = rule.custom?.('-5');
      expect(result).toBeTruthy();
    });

    it('should reject non-numeric values', () => {
      const result = rule.custom?.('abc');
      expect(result).toBeTruthy();
    });

    it('should reject quantity over 9999', () => {
      const result = rule.custom?.('10000');
      expect(result).toBeTruthy();
      expect(result).toContain('9999');
    });
  });

  describe('unitPrice validation', () => {
    const rule = validationRules.unitPrice;

    it('should be required', () => {
      expect(rule.required).toBe(true);
    });

    it('should accept positive prices', () => {
      expect(rule.custom?.('100')).toBeNull();
      expect(rule.custom?.('1500.50')).toBeNull();
    });

    it('should reject zero price', () => {
      const result = rule.custom?.('0');
      expect(result).toBeTruthy();
    });

    it('should reject negative prices', () => {
      const result = rule.custom?.('-100');
      expect(result).toBeTruthy();
    });

    it('should reject prices over 999,999', () => {
      const result = rule.custom?.('1000000');
      expect(result).toBeTruthy();
      expect(result).toContain('999,999');
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only strings', () => {
      expect(validationRules.customerName.custom?.('   ')).toBeTruthy();
    });

    it('should trim values before validation', () => {
      expect(validationRules.customerName.custom?.('  John Doe  ')).toBeNull();
    });

    it('should handle empty strings for optional fields', () => {
      expect(validationRules.customerTIN.custom?.('')).toBeNull();
      expect(validationRules.customerName.custom?.('')).toBeNull();
    });
  });

  describe('Security considerations', () => {
    it('should reject SQL injection patterns in names', () => {
      const result = validationRules.customerName.custom?.("John'; DROP TABLE users; --");
      expect(result).toBeTruthy(); // Rejected due to special characters
    });

    it('should reject XSS patterns in names', () => {
      const result = validationRules.customerName.custom?.("<script>alert('xss')</script>");
      expect(result).toBeTruthy(); // Rejected due to special characters
    });
  });
});
