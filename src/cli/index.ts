/**
 * CIC CLI — Main entry point
 * Registers all CLI commands and runs the program
 */

import { Command } from 'commander';
import { createCacheCommand } from './cic-cli-cache.ts';

async function main() {
  const program = new Command();

  program
    .name('cic')
    .description('CIC Autonomy & Memory Management CLI')
    .version('0.1.0');

  // Register cache management command
  program.addCommand(createCacheCommand());

  // Parse arguments and execute
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


