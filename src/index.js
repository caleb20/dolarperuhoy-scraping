import 'dotenv/config.js';
import { runCycle } from './scraper.js';

async function main() {
  await runCycle();
  process.exit(0); // importante para cron job
}

main();