import { existsSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import { parseEnvFile } from '../env-parser';
import { parseSchema } from '../schema';
import { SchemaType, Schema } from '../types';

const SECRET_KEY_RE = /KEY|SECRET|TOKEN|PASSWORD/i;
const REQUIRED_KEY_RE = /URL|HOST|KEY|SECRET/i;
const BOOLEAN_VALUES = new Set(['true', 'false', '1', '0']);
const NUMBER_RE = /^\d+$/;

/** Infer the schema type from a value string. */
function inferType(value: string): SchemaType {
  if (BOOLEAN_VALUES.has(value)) return 'boolean';
  if (NUMBER_RE.test(value)) return 'number';
  return 'string';
}

/** Build schema line modifiers for a key/value pair. */
function buildSchemaLine(key: string, value: string): string {
  const type = inferType(value);
  const isSecret = SECRET_KEY_RE.test(key);
  const isRequired = REQUIRED_KEY_RE.test(key);

  const parts: string[] = [type];
  if (isRequired) parts.push('required');
  if (isSecret) parts.push('secret');

  return `${key}=${parts.join(':')}`;
}

/**
 * Generate a .env.schema file from an existing .env file.
 * Each variable is annotated with inferred type, required, and secret flags.
 */
export async function initCommand(options: { env: string; output: string }): Promise<void> {
  if (!existsSync(options.env)) {
    console.error(chalk.red(`Error: env file not found: ${options.env}`));
    process.exit(1);
  }

  const vars = parseEnvFile(options.env);
  const lines: string[] = [];

  for (const [key, value] of vars) {
    lines.push(buildSchemaLine(key, value));
  }

  writeFileSync(options.output, lines.join('\n') + '\n', 'utf-8');
  console.log(chalk.green(`Schema written to ${options.output}`));
  console.log(chalk.dim(`  ${vars.size} variable(s) processed`));
}

/** Determine the placeholder for a secret value. */
function secretPlaceholder(key: string): string {
  const lower = key.toLowerCase();
  if (lower.includes('url')) return 'https://your-service-url-here';
  if (lower.includes('host')) return 'your-host-here';
  return 'your_' + lower + '_here';
}

/** Resolve which keys are secret, merging schema data with heuristics. */
function resolveSecretKeys(vars: Map<string, string>, schema: Schema | null): Set<string> {
  const secrets = new Set<string>();
  for (const key of vars.keys()) {
    const inSchema = schema?.get(key);
    if (inSchema ? inSchema.secret : SECRET_KEY_RE.test(key)) {
      secrets.add(key);
    }
  }
  return secrets;
}

/**
 * Generate a .env.example file from an existing .env file.
 * Secret values are replaced with safe placeholders; non-secrets are kept as-is.
 */
export async function exampleCommand(options: {
  env: string;
  schema?: string;
  output: string;
}): Promise<void> {
  if (!existsSync(options.env)) {
    console.error(chalk.red(`Error: env file not found: ${options.env}`));
    process.exit(1);
  }

  const vars = parseEnvFile(options.env);
  const schema: Schema | null =
    options.schema && existsSync(options.schema) ? parseSchema(options.schema) : null;

  const secretKeys = resolveSecretKeys(vars, schema);
  const lines: string[] = [];

  for (const [key, value] of vars) {
    const safeValue = secretKeys.has(key) ? secretPlaceholder(key) : value;
    lines.push(`${key}=${safeValue}`);
  }

  writeFileSync(options.output, lines.join('\n') + '\n', 'utf-8');
  console.log(chalk.green(`Example env written to ${options.output}`));
  console.log(chalk.dim(`  ${secretKeys.size} secret(s) redacted, ${vars.size - secretKeys.size} value(s) kept`));
}
