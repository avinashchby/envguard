import { existsSync, writeFileSync, chmodSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';

/** Walk up from cwd looking for a .git directory. Returns its path or null. */
function findGitDir(): string | null {
  let current = resolve(process.cwd());
  while (true) {
    const candidate = join(current, '.git');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(current, '..');
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/** The bash pre-commit hook script content. */
function buildHookScript(): string {
  return `#!/usr/bin/env bash
# envguard pre-commit hook — auto-installed

set -euo pipefail

# ── 1. Block staged .env files ──────────────────────────────────────────────
STAGED_ENV=$(git diff --cached --name-only | grep -E '^\\.env' | grep -v -E '\\.(example|schema)$' || true)

if [ -n "$STAGED_ENV" ]; then
  echo ""
  echo "envguard: blocked — .env file(s) staged for commit:"
  echo "$STAGED_ENV" | sed 's/^/  /'
  echo ""
  echo "Remove them with:  git reset HEAD <file>"
  echo ""
  exit 1
fi

# ── 2. Scan staged file contents for hardcoded secrets ──────────────────────
SECRET_PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z\\-_]{35}'
  'sk_live_[0-9a-zA-Z]{24,}'
  'rk_live_[0-9a-zA-Z]{24,}'
  'ghp_[0-9a-zA-Z]{36}'
  'github_pat_[0-9a-zA-Z_]{82}'
  'xox[baprs]-[0-9a-zA-Z\\-]+'
  'SG\\.[0-9a-zA-Z\\-_]{22}\\.[0-9a-zA-Z\\-_]{43}'
  '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY'
  'password\\s*=\\s*["\x27][^"\x27]{8,}'
  'secret\\s*=\\s*["\x27][^"\x27]{8,}'
)

COMBINED=$(printf '|%s' "\${SECRET_PATTERNS[@]}")
COMBINED="\${COMBINED:1}"

STAGED_FILES=$(git diff --cached --name-only || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

FINDINGS=""
while IFS= read -r file; do
  [ -f "$file" ] || continue
  MATCHES=$(git diff --cached -U0 -- "$file" \
    | grep '^+' | grep -v '^+++' \
    | grep -P "$COMBINED" || true)
  if [ -n "$MATCHES" ]; then
    FINDINGS+="\${file}\\n\${MATCHES}\\n"
  fi
done <<< "$STAGED_FILES"

if [ -n "$FINDINGS" ]; then
  echo ""
  echo "envguard: blocked — possible secrets detected in staged changes:"
  echo ""
  echo -e "$FINDINGS"
  echo "Review the matches above. If they are false positives, use:"
  echo "  git commit --no-verify"
  echo ""
  exit 1
fi

exit 0
`;
}

/** Install a git pre-commit hook that blocks .env files and hardcoded secrets. */
export async function hookCommand(options: { force?: boolean }): Promise<void> {
  const gitDir = findGitDir();
  if (!gitDir) {
    console.error(chalk.red('Error: no .git directory found in this directory or any parent.'));
    return;
  }

  const hooksDir = join(gitDir, 'hooks');
  const hookPath = join(hooksDir, 'pre-commit');

  if (existsSync(hookPath) && !options.force) {
    console.warn(chalk.yellow('Warning: pre-commit hook already exists at:'), hookPath);
    console.warn(chalk.yellow('Run with --force to overwrite it.'));
    return;
  }

  writeFileSync(hookPath, buildHookScript(), { encoding: 'utf8' });
  chmodSync(hookPath, 0o755);

  console.log(chalk.green('envguard hook installed successfully.'));
  console.log(chalk.dim(`  Location : ${hookPath}`));
  console.log(chalk.dim('  Protects : staged .env files and hardcoded secrets'));
  console.log(chalk.dim('  Bypass   : git commit --no-verify  (use sparingly)'));
}
