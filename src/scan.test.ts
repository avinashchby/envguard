import { describe, it, expect } from 'vitest';
import { SECRET_PATTERNS } from './commands/scan';

describe('SECRET_PATTERNS', () => {
  it('detects AWS Access Key', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'AWS Access Key');
    expect(pattern?.pattern.test('AKIAIOSFODNN7EXAMPLE')).toBe(true);
    expect(pattern?.pattern.test('not-a-key')).toBe(false);
  });

  it('detects Stripe Secret Key', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'Stripe Secret Key');
    // Build test string dynamically to avoid triggering GitHub secret scanning
    const stripeTestKey = ['sk', 'live', 'a1b2c3d4e5f6g7h8i9j0k1l2'].join('_');
    expect(pattern?.pattern.test(stripeTestKey)).toBe(true);
    expect(pattern?.pattern.test('sk_test_abc123')).toBe(false);
  });

  it('detects JWT tokens', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'JWT Token');
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(pattern?.pattern.test(jwt)).toBe(true);
  });

  it('detects Database URLs with passwords', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'Database URL');
    expect(
      pattern?.pattern.test('postgres://admin:s3cret@db.example.com:5432/mydb'),
    ).toBe(true);
    expect(
      pattern?.pattern.test('postgres://readonly@db.example.com/mydb'),
    ).toBe(false);
  });

  it('detects Private Keys', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'Private Key');
    expect(pattern?.pattern.test('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    expect(pattern?.pattern.test('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(pattern?.pattern.test('-----BEGIN PUBLIC KEY-----')).toBe(false);
  });

  it('detects GitHub tokens', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'GitHub Token');
    expect(
      pattern?.pattern.test('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij'),
    ).toBe(true);
  });

  it('detects Slack tokens', () => {
    const pattern = SECRET_PATTERNS.find((p) => p.name === 'Slack Token');
    expect(pattern?.pattern.test('xoxb-123456789012-abcdef')).toBe(true);
  });
});
