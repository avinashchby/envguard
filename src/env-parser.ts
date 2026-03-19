import { readFileSync } from 'fs';

/** Parse a .env file into a key-value map */
export function parseEnvFile(filePath: string): Map<string, string> {
  const content = readFileSync(filePath, 'utf-8');
  return parseEnvFromString(content);
}

/** Parse .env content from a string */
export function parseEnvFromString(content: string): Map<string, string> {
  const vars = new Map<string, string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars.set(key, value);
  }

  return vars;
}
