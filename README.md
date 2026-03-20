# envguard

Stop leaking secrets. Validate, sync, and scan `.env` files from the command line.

## Quick Start

```bash
npx @avinashchby/envguard validate
```

## What It Does

Environment variable mistakes — missing required keys, type mismatches, secrets hardcoded in source, or `.env` files drifting out of sync across environments — are a persistent source of bugs and security incidents. envguard provides a single CLI to enforce a schema against your `.env`, detect drift between `.env.local`/`.env.staging`/`.env.production`, scan your entire codebase for hardcoded secrets, and block accidental commits of `.env` files via a git pre-commit hook. Run it locally or drop it into CI with `--ci` flags that return meaningful exit codes.

## Features

- Schema validation with typed fields (`string`, `number`, `boolean`, `enum`) and `required`/`default`/`secret` modifiers
- Drift detection across all `.env*` files rendered as a terminal table
- Hardcoded-secret scanner covering AWS keys, Stripe keys, JWTs, database URLs, GitHub tokens, Slack tokens, private keys, and generic API secrets
- `--fix` mode that auto-replaces detected secrets with environment variable placeholders
- `init` command to generate a `.env.schema` from an existing `.env` (types and flags inferred automatically)
- `example` command to strip secret values and produce a safe `.env.example` for committing
- Git pre-commit hook installer that blocks staged `.env` files and scans diffs for secrets
- `--ci` flags with distinct exit codes (`1` validation error, `2` sync drift, `3` secrets found) for clean pipeline integration

## Usage

**Validate `.env` against a schema:**
```bash
envguard validate
envguard validate --schema .env.schema --env .env.production --ci
```

**Detect drift across all `.env*` files in the current directory:**
```bash
envguard sync
envguard sync --files .env .env.staging .env.production --ci
```

**Scan the project for hardcoded secrets:**
```bash
envguard scan
envguard scan --dir ./src --ci
envguard scan --fix   # auto-replace secrets with ${PLACEHOLDER} references
```

**Bootstrap a schema and a safe example file:**
```bash
envguard init                        # reads .env, writes .env.schema
envguard example                     # reads .env, writes .env.example with secrets redacted
envguard init --env .env.production --output .env.schema
```

**Install the git pre-commit hook:**
```bash
envguard hook
envguard hook --force   # overwrite an existing hook
```

## Example Output

`envguard validate`:
```
Validating .env against .env.schema

  ✓ NODE_ENV
  ✓ PORT
  ✗ DATABASE_URL: Required variable is missing
  ! REDIS_URL: Missing — will use default: redis://localhost:6379
  ✓ API_KEY

2 ok  1 warnings  1 errors
```

`envguard sync`:
```
┌─────────────┬────────┬──────────────┬────────────────────┐
│ Variable    │ .env   │ .env.staging │ .env.production    │
├─────────────┼────────┼──────────────┼────────────────────┤
│ API_KEY     │ ✓      │ ✓            │ ✗                  │
│ DATABASE_URL│ ✓      │ ✓            │ ✓                  │
│ PORT        │ ✓      │ ✗            │ ✓                  │
└─────────────┴────────┴──────────────┴────────────────────┘

2 variables in sync, 2 variables with drift
```

`envguard scan`:
```
Scanning . for hardcoded secrets...

  src/config.ts
    line 12 [Stripe Secret Key]  sk_l****

Scanned 42 files, found 1 secrets in 1 files
```

## Installation

```bash
npm install -g @avinashchby/envguard
# or
npx @avinashchby/envguard
```

Requires Node.js >= 18.

## Schema Format

`.env.schema` uses a plain-text format, one variable per line:

```
DATABASE_URL=string:required:secret
PORT=number:default=3000
NODE_ENV=enum(development,staging,production):default=development
ENABLE_FEATURE=boolean
API_KEY=string:required:secret
```

Run `envguard init` to generate this file automatically from your existing `.env`.

## License

MIT
