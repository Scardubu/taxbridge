/**
 * otpService.test.ts
 * Blueprint v6 — Three-branch Nigerian phone normalisation tests
 */

import { normalizeNigeriaPhone } from '../services/otpService';

describe('normalizeNigeriaPhone — three non-overlapping branches', () => {
  describe('Branch 1: +234 prefix already present', () => {
    test('+2348012345678 → unchanged', () => {
      expect(normalizeNigeriaPhone('+2348012345678')).toBe('+2348012345678');
    });

    test('+234 with spaces/hyphens stripped', () => {
      expect(normalizeNigeriaPhone('+234 801 234 5678')).toBe('+2348012345678');
    });

    test('+234 with dashes stripped', () => {
      expect(normalizeNigeriaPhone('+234-801-234-5678')).toBe('+2348012345678');
    });
  });

  describe('Branch 2: 234 country code without leading +', () => {
    test('2348012345678 → +2348012345678', () => {
      expect(normalizeNigeriaPhone('2348012345678')).toBe('+2348012345678');
    });

    test('234 prefix with spaces stripped', () => {
      expect(normalizeNigeriaPhone('234 801 234 5678')).toBe('+2348012345678');
    });
  });

  describe('Branch 3: local 0xx format', () => {
    test('08012345678 → +2348012345678', () => {
      expect(normalizeNigeriaPhone('08012345678')).toBe('+2348012345678');
    });

    test('07031234567 → +2347031234567', () => {
      expect(normalizeNigeriaPhone('07031234567')).toBe('+2347031234567');
    });

    test('09012345678 → +2349012345678', () => {
      expect(normalizeNigeriaPhone('09012345678')).toBe('+2349012345678');
    });
  });

  describe('Invalid / unrecognised numbers', () => {
    test('Short number passes through unchanged', () => {
      expect(normalizeNigeriaPhone('1234')).toBe('1234');
    });

    test('Empty string passes through unchanged', () => {
      expect(normalizeNigeriaPhone('')).toBe('');
    });

    test('Non-Nigerian number (e.g. UK) passes through unchanged', () => {
      const uk = '+447700900123';
      expect(normalizeNigeriaPhone(uk)).toBe(uk);
    });
  });

  describe('Output format invariants', () => {
    test('All valid Nigerian outputs start with +234', () => {
      const inputs = ['08012345678', '2348012345678', '+2348012345678'];
      inputs.forEach((input) => {
        expect(normalizeNigeriaPhone(input)).toMatch(/^\+234/);
      });
    });

    test('All valid Nigerian outputs are 14 characters long', () => {
      const inputs = ['08012345678', '2348012345678', '+2348012345678'];
      inputs.forEach((input) => {
        expect(normalizeNigeriaPhone(input)).toHaveLength(14);
      });
    });

    test('Branches are mutually exclusive — same number gives same result regardless of input format', () => {
      const local = normalizeNigeriaPhone('08012345678');
      const countryCode = normalizeNigeriaPhone('2348012345678');
      const international = normalizeNigeriaPhone('+2348012345678');
      expect(local).toBe(countryCode);
      expect(countryCode).toBe(international);
    });
  });
});
