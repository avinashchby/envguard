import { describe, it, expect } from 'vitest';
import { parseEnvFromString } from './env-parser';

describe('parseEnvFromString', () => {
  it('parses key-value pairs', () => {
    const vars = parseEnvFromString('FOO=bar\nBAZ=qux');
    expect(vars.get('FOO')).toBe('bar');
    expect(vars.get('BAZ')).toBe('qux');
  });

  it('strips surrounding double quotes', () => {
    const vars = parseEnvFromString('FOO="hello world"');
    expect(vars.get('FOO')).toBe('hello world');
  });

  it('strips surrounding single quotes', () => {
    const vars = parseEnvFromString("FOO='hello world'");
    expect(vars.get('FOO')).toBe('hello world');
  });

  it('skips comments and blank lines', () => {
    const vars = parseEnvFromString('# comment\n\nFOO=bar\n  # another comment');
    expect(vars.size).toBe(1);
    expect(vars.get('FOO')).toBe('bar');
  });

  it('handles values with = in them', () => {
    const vars = parseEnvFromString('DATABASE_URL=postgres://user:pass@host/db?sslmode=require');
    expect(vars.get('DATABASE_URL')).toBe('postgres://user:pass@host/db?sslmode=require');
  });

  it('handles empty values', () => {
    const vars = parseEnvFromString('EMPTY=');
    expect(vars.get('EMPTY')).toBe('');
  });
});
