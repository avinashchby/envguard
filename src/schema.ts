import { readFileSync } from 'fs';
import { SchemaField, SchemaType, Schema } from './types';

/**
 * Parse a schema line like:
 *   DATABASE_URL=string:required
 *   PORT=number:default=3000
 *   NODE_ENV=enum(development,staging,production):default=development
 *   API_KEY=string:required:secret
 */
export function parseSchemaLine(line: string): SchemaField | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return null;

  const name = trimmed.slice(0, eqIndex).trim();
  const definition = trimmed.slice(eqIndex + 1).trim();

  const field: SchemaField = {
    name,
    type: 'string',
    required: false,
    secret: false,
  };

  const parts = splitDefinition(definition);

  for (const part of parts) {
    if (part === 'required') {
      field.required = true;
    } else if (part === 'secret') {
      field.secret = true;
    } else if (part.startsWith('default=')) {
      field.defaultValue = part.slice('default='.length);
    } else if (part.startsWith('enum(') && part.endsWith(')')) {
      field.type = 'enum';
      field.enumValues = part.slice(5, -1).split(',').map(v => v.trim());
    } else if (['string', 'number', 'boolean'].includes(part)) {
      field.type = part as SchemaType;
    }
  }

  return field;
}

/**
 * Split definition by colon, but respect parentheses.
 * e.g. "enum(a,b,c):default=a" -> ["enum(a,b,c)", "default=a"]
 */
function splitDefinition(def: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of def) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ':' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Parse a .env.schema file into a Schema map */
export function parseSchema(filePath: string): Schema {
  const content = readFileSync(filePath, 'utf-8');
  return parseSchemaFromString(content);
}

/** Parse schema from string content */
export function parseSchemaFromString(content: string): Schema {
  const schema: Schema = new Map();
  const lines = content.split('\n');

  for (const line of lines) {
    const field = parseSchemaLine(line);
    if (field) {
      schema.set(field.name, field);
    }
  }

  return schema;
}
