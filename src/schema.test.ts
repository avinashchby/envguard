import { describe, it, expect } from 'vitest';
import { parseSchemaLine, parseSchemaFromString } from './schema';

describe('parseSchemaLine', () => {
  it('parses a simple required string', () => {
    const field = parseSchemaLine('DATABASE_URL=string:required');
    expect(field).toEqual({
      name: 'DATABASE_URL',
      type: 'string',
      required: true,
      secret: false,
    });
  });

  it('parses number with default', () => {
    const field = parseSchemaLine('PORT=number:default=3000');
    expect(field).toEqual({
      name: 'PORT',
      type: 'number',
      required: false,
      secret: false,
      defaultValue: '3000',
    });
  });

  it('parses boolean with default', () => {
    const field = parseSchemaLine('DEBUG=boolean:default=false');
    expect(field).toEqual({
      name: 'DEBUG',
      type: 'boolean',
      required: false,
      secret: false,
      defaultValue: 'false',
    });
  });

  it('parses required secret string', () => {
    const field = parseSchemaLine('API_KEY=string:required:secret');
    expect(field).toEqual({
      name: 'API_KEY',
      type: 'string',
      required: true,
      secret: true,
    });
  });

  it('parses enum with default', () => {
    const field = parseSchemaLine(
      'NODE_ENV=enum(development,staging,production):default=development',
    );
    expect(field).toEqual({
      name: 'NODE_ENV',
      type: 'enum',
      required: false,
      secret: false,
      defaultValue: 'development',
      enumValues: ['development', 'staging', 'production'],
    });
  });

  it('returns null for comments and blank lines', () => {
    expect(parseSchemaLine('# this is a comment')).toBeNull();
    expect(parseSchemaLine('')).toBeNull();
    expect(parseSchemaLine('  ')).toBeNull();
  });

  it('returns null for lines without =', () => {
    expect(parseSchemaLine('INVALID')).toBeNull();
  });
});

describe('parseSchemaFromString', () => {
  it('parses a full schema string', () => {
    const content = `
DATABASE_URL=string:required
PORT=number:default=3000
# comment
DEBUG=boolean:default=false
API_KEY=string:required:secret
NODE_ENV=enum(development,staging,production):default=development
    `;
    const schema = parseSchemaFromString(content);
    expect(schema.size).toBe(5);
    expect(schema.get('DATABASE_URL')?.required).toBe(true);
    expect(schema.get('PORT')?.type).toBe('number');
    expect(schema.get('API_KEY')?.secret).toBe(true);
    expect(schema.get('NODE_ENV')?.enumValues).toEqual([
      'development',
      'staging',
      'production',
    ]);
  });
});
