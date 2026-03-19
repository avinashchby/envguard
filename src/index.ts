#!/usr/bin/env node
import { Command } from 'commander';
import { validateCommand } from './commands/validate';
import { syncCommand } from './commands/sync';
import { scanCommand } from './commands/scan';
import { initCommand, exampleCommand } from './commands/generate';
import { hookCommand } from './commands/hook';

const program = new Command();

program
  .name('envguard')
  .description('Validate, sync, and secure .env files')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate .env against .env.schema')
  .option('-s, --schema <path>', 'Path to schema file', '.env.schema')
  .option('-e, --env <path>', 'Path to env file', '.env')
  .option('--ci', 'CI mode: exit 1 on any issues')
  .action(validateCommand);

program
  .command('sync')
  .description('Compare all .env* files for drift')
  .option('-f, --files <files...>', 'Specific env files to compare')
  .option('--ci', 'CI mode: exit 1 on drift')
  .action(syncCommand);

program
  .command('scan')
  .description('Scan project for hardcoded secrets')
  .option('-d, --dir <path>', 'Directory to scan', '.')
  .option('--fix', 'Auto-replace secrets with env var references')
  .option('--ci', 'CI mode: exit 1 on secrets found')
  .action(scanCommand);

program
  .command('init')
  .description('Generate .env.schema from existing .env')
  .option('-e, --env <path>', 'Path to env file', '.env')
  .option('-o, --output <path>', 'Output schema path', '.env.schema')
  .action(initCommand);

program
  .command('example')
  .description('Generate .env.example from .env (strips secrets)')
  .option('-e, --env <path>', 'Path to env file', '.env')
  .option('-s, --schema <path>', 'Path to schema file', '.env.schema')
  .option('-o, --output <path>', 'Output path', '.env.example')
  .action(exampleCommand);

program
  .command('hook')
  .description('Install pre-commit git hook')
  .option('--force', 'Overwrite existing hook')
  .action(hookCommand);

program.parse();
