import { readdirSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { parseEnvFile } from '../env-parser';
import { SyncDiff, EXIT_CODES } from '../types';

/** Auto-discover .env* files in the current working directory. */
function discoverEnvFiles(): string[] {
  return readdirSync(process.cwd())
    .filter((f) => f.startsWith('.env'))
    .map((f) => resolve(process.cwd(), f));
}

/**
 * Parse each file into a map of filename -> variable map.
 * Returns a tuple of [label -> vars map, ordered labels].
 */
function parseFiles(
  files: string[],
): [Map<string, Map<string, string>>, string[]] {
  const parsed = new Map<string, Map<string, string>>();
  const labels: string[] = [];

  for (const filePath of files) {
    const label = filePath.split('/').pop() ?? filePath;
    parsed.set(label, parseEnvFile(filePath));
    labels.push(label);
  }

  return [parsed, labels];
}

/** Collect all unique variable names across all parsed files. */
function collectAllVars(parsed: Map<string, Map<string, string>>): string[] {
  const all = new Set<string>();
  for (const vars of parsed.values()) {
    for (const key of vars.keys()) all.add(key);
  }
  return Array.from(all).sort();
}

/** Build SyncDiff[] from parsed files and the full variable list. */
function buildDiffs(
  allVars: string[],
  parsed: Map<string, Map<string, string>>,
  labels: string[],
): SyncDiff[] {
  return allVars.map((variable) => {
    const presentIn = labels.filter((l) => parsed.get(l)?.has(variable));
    const missingFrom = labels.filter((l) => !parsed.get(l)?.has(variable));
    return { variable, presentIn, missingFrom };
  });
}

/** Render diffs as a cli-table3 table and print it. */
function renderTable(diffs: SyncDiff[], labels: string[]): void {
  const table = new Table({
    head: [
      chalk.bold('Variable'),
      ...labels.map((l) => chalk.bold(l)),
    ],
  });

  for (const diff of diffs) {
    const row: string[] = [diff.variable];
    for (const label of labels) {
      row.push(
        diff.presentIn.includes(label)
          ? chalk.green('✓')
          : chalk.red('✗'),
      );
    }
    table.push(row);
  }

  console.log(table.toString());
}

/** Print sync/drift summary and optionally exit with code 2 in CI mode. */
function printSummary(diffs: SyncDiff[], ci: boolean): void {
  const inSync = diffs.filter((d) => d.missingFrom.length === 0).length;
  const withDrift = diffs.filter((d) => d.missingFrom.length > 0).length;

  console.log(
    `\n${chalk.green(inSync)} variable${inSync !== 1 ? 's' : ''} in sync, ` +
      `${chalk.red(withDrift)} variable${withDrift !== 1 ? 's' : ''} with drift`,
  );

  if (ci && withDrift > 0) {
    process.exit(EXIT_CODES.SYNC_DRIFT);
  }
}

/** Compare all .env* files and display drift as a table. */
export async function syncCommand(options: {
  files?: string[];
  ci?: boolean;
}): Promise<void> {
  const filePaths =
    options.files && options.files.length > 0
      ? options.files.map((f) => resolve(process.cwd(), f))
      : discoverEnvFiles();

  if (filePaths.length < 2) {
    console.error(
      chalk.yellow(
        'At least 2 .env files are required for a sync comparison. ' +
          `Found: ${filePaths.length}.`,
      ),
    );
    return;
  }

  const [parsed, labels] = parseFiles(filePaths);
  const allVars = collectAllVars(parsed);
  const diffs = buildDiffs(allVars, parsed, labels);

  renderTable(diffs, labels);
  printSummary(diffs, options.ci ?? false);
}
