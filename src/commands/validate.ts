import { existsSync } from 'fs';
import chalk from 'chalk';
import { parseSchema } from '../schema';
import { parseEnvFile } from '../env-parser';
import { SchemaField, ValidationError, EXIT_CODES } from '../types';

const VALID_BOOLEANS = new Set(['true', 'false', '1', '0']);

/** Check that both files exist; return an error message if either is missing. */
function checkFilesExist(schemaPath: string, envPath: string): string | null {
  if (!existsSync(schemaPath)) {
    return `Schema file not found: ${schemaPath}`;
  }
  if (!existsSync(envPath)) {
    return `Env file not found: ${envPath}`;
  }
  return null;
}

/** Validate a single schema field against the parsed env values. */
function validateField(
  field: SchemaField,
  value: string | undefined,
): ValidationError | null {
  if (value === undefined) {
    if (field.required) {
      return { field: field.name, message: 'Required variable is missing', severity: 'error' };
    }
    if (field.defaultValue !== undefined) {
      return {
        field: field.name,
        message: `Missing — will use default: ${field.defaultValue}`,
        severity: 'warning',
      };
    }
    return null;
  }

  if (field.type === 'number' && isNaN(Number(value))) {
    return { field: field.name, message: `Expected a number, got: "${value}"`, severity: 'error' };
  }

  if (field.type === 'boolean' && !VALID_BOOLEANS.has(value.toLowerCase())) {
    return {
      field: field.name,
      message: `Expected boolean (true/false/1/0), got: "${value}"`,
      severity: 'error',
    };
  }

  if (field.type === 'enum' && !field.enumValues?.includes(value)) {
    const allowed = field.enumValues?.join(', ') ?? '';
    return {
      field: field.name,
      message: `Expected one of [${allowed}], got: "${value}"`,
      severity: 'error',
    };
  }

  return null;
}

/** Print validation results to stdout using chalk. */
function printResults(results: Array<{ field: string; issue: ValidationError | null }>): void {
  for (const { field, issue } of results) {
    if (!issue) {
      console.log(chalk.green(`  ✓ ${field}`));
    } else if (issue.severity === 'error') {
      console.log(chalk.red(`  ✗ ${field}: ${issue.message}`));
    } else {
      console.log(chalk.yellow(`  ! ${field}: ${issue.message}`));
    }
  }
}

/** Validate a .env file against a .env.schema file. */
export async function validateCommand(options: {
  schema: string;
  env: string;
  ci?: boolean;
}): Promise<void> {
  const fileError = checkFilesExist(options.schema, options.env);
  if (fileError) {
    console.error(chalk.red(`Error: ${fileError}`));
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }

  const schema = parseSchema(options.schema);
  const env = parseEnvFile(options.env);

  const results = Array.from(schema.values()).map((field) => ({
    field: field.name,
    issue: validateField(field, env.get(field.name)),
  }));

  const hasErrors = results.some((r) => r.issue?.severity === 'error');

  console.log(chalk.bold(`\nValidating ${options.env} against ${options.schema}\n`));
  printResults(results);

  const errorCount = results.filter((r) => r.issue?.severity === 'error').length;
  const warnCount = results.filter((r) => r.issue?.severity === 'warning').length;
  const okCount = results.filter((r) => !r.issue).length;

  console.log(
    `\n${chalk.green(`${okCount} ok`)}  ${chalk.yellow(`${warnCount} warnings`)}  ${chalk.red(`${errorCount} errors`)}`,
  );

  if (options.ci && hasErrors) {
    process.exit(EXIT_CODES.VALIDATION_ERROR);
  }
}
