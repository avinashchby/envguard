import { readdirSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join, relative, extname } from 'path';
import ignore, { Ignore } from 'ignore';
import chalk from 'chalk';
import { SecretMatch, EXIT_CODES } from '../types';

/** A named pattern used to detect a secret. */
interface SecretPattern {
  name: string;
  pattern: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'AWS Access Key',        pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key',        pattern: /(?:aws|secret)[^\n]{0,40}[0-9a-zA-Z/+=]{40}/i },
  { name: 'Stripe Secret Key',     pattern: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'Stripe Publishable Key', pattern: /pk_live_[0-9a-zA-Z]{24,}/ },
  { name: 'JWT Token',             pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/ },
  { name: 'Database URL',          pattern: /(?:mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/ },
  { name: 'Private Key',           pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: 'Generic API Key',       pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[a-zA-Z0-9]{20,}/i },
  { name: 'Generic Secret',        pattern: /(?:secret|password|passwd|token)\s*[:=]\s*['"]?[a-zA-Z0-9!@#$%^&*]{8,}/i },
  { name: 'GitHub Token',          pattern: /gh[ps]_[A-Za-z0-9_]{36,}/ },
  { name: 'Slack Token',           pattern: /xox[bpors]-[0-9a-zA-Z-]+/ },
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2',
  '.ttf', '.otf', '.zip', '.gz', '.tar', '.pdf', '.exe', '.bin',
]);

const ALWAYS_IGNORED = ['node_modules/', '.git/', 'dist/', '*.min.js', 'package-lock.json', 'yarn.lock'];

/** Build an ignore filter from .gitignore plus hard-coded defaults. */
function buildIgnoreFilter(dir: string): Ignore {
  const ig = ignore();
  ig.add(ALWAYS_IGNORED);
  const gitignorePath = join(dir, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf8'));
  }
  return ig;
}

/** Collect all non-ignored, non-binary file paths under dir. */
function walkDirectory(dir: string, ig: Ignore): string[] {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: false }) as string[];
  return entries.filter((entry) => {
    const rel = relative(dir, join(dir, entry));
    if (ig.ignores(rel)) return false;
    if (BINARY_EXTENSIONS.has(extname(entry).toLowerCase())) return false;
    return true;
  }).map((entry) => join(dir, entry));
}

/** Redact a secret value: show first 4 chars then '****'. */
function redact(value: string): string {
  return value.slice(0, 4) + '****';
}

/** Scan a single file for secret patterns; return all matches found. */
function scanFile(filePath: string): SecretMatch[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const matches: SecretMatch[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { name, pattern } of SECRET_PATTERNS) {
      const result = pattern.exec(line);
      if (result) {
        matches.push({
          file: filePath,
          line: i + 1,
          pattern: name,
          match: result[0],
          redacted: redact(result[0]),
        });
      }
    }
  }

  return matches;
}

/** Print all matches grouped by file. */
function printResults(matches: SecretMatch[], dir: string): void {
  const byFile = new Map<string, SecretMatch[]>();
  for (const m of matches) {
    const list = byFile.get(m.file) ?? [];
    list.push(m);
    byFile.set(m.file, list);
  }

  for (const [file, fileMatches] of byFile) {
    console.log(chalk.bold.red(`\n  ${relative(dir, file)}`));
    for (const m of fileMatches) {
      console.log(
        chalk.red(`    line ${m.line}`) +
        chalk.gray(` [${m.pattern}]`) +
        `  ${chalk.yellow(m.redacted)}`,
      );
    }
  }
}

/** Derive an env-var placeholder name from a pattern name. */
function toPlaceholder(patternName: string): string {
  return '${' + patternName.toUpperCase().replace(/\s+/g, '_') + '}';
}

/** Apply fix mode: replace each matched secret value in-place with a placeholder. */
function applyFix(matches: SecretMatch[]): void {
  const byFile = new Map<string, SecretMatch[]>();
  for (const m of matches) {
    const list = byFile.get(m.file) ?? [];
    list.push(m);
    byFile.set(m.file, list);
  }

  for (const [file, fileMatches] of byFile) {
    let content = readFileSync(file, 'utf8');
    for (const m of fileMatches) {
      const placeholder = toPlaceholder(m.pattern);
      content = content.replace(m.match, placeholder);
    }
    writeFileSync(file, content, 'utf8');
    console.log(chalk.yellow(`  Fixed: ${file}`));
  }
}

/** Scan a project directory for hardcoded secrets. */
export async function scanCommand(options: { dir: string; fix?: boolean; ci?: boolean }): Promise<void> {
  const ig = buildIgnoreFilter(options.dir);
  const candidates = walkDirectory(options.dir, ig);
  const { statSync } = require('fs') as typeof import('fs');
  const files = candidates.filter((f) => {
    try {
      return statSync(f).isFile();
    } catch {
      return false;
    }
  });

  console.log(chalk.bold(`\nScanning ${options.dir} for hardcoded secrets...\n`));

  const allMatches: SecretMatch[] = [];
  for (const file of files) {
    allMatches.push(...scanFile(file));
  }

  const affectedFiles = new Set(allMatches.map((m) => m.file)).size;

  if (allMatches.length === 0) {
    console.log(chalk.green('  No secrets found.'));
  } else {
    printResults(allMatches, options.dir);
  }

  console.log(
    chalk.bold(
      `\nScanned ${files.length} files, found ${allMatches.length} secrets in ${affectedFiles} files`,
    ),
  );

  if (options.fix && allMatches.length > 0) {
    console.log(chalk.yellow('\nApplying fixes...'));
    applyFix(allMatches);
    console.log(chalk.green('Done.'));
  }

  if (options.ci && allMatches.length > 0) {
    process.exit(EXIT_CODES.SECRETS_FOUND);
  }
}
