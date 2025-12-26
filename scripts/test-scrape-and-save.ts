/**
 * Test script for scraping and saving to database
 *
 * Usage:
 * npm run scraper:test:db -- --source-id=<uuid>     # Scrape specific source
 * npm run scraper:test:db -- --project-id=<uuid>    # Scrape all sources in project
 * npm run scraper:test:db -- --due                  # Scrape sources due for refresh
 * npm run scraper:test:db -- --due --interval=60    # Scrape sources not updated in 60min
 */

import {
  getSourceById,
  getActiveSources,
  getSourcesDueForScraping,
  scrapeAndSave,
  scrapeMultipleSources,
} from '../lib/scraper';

interface Args {
  sourceId?: string;
  projectId?: string;
  due?: boolean;
  interval?: number;
}

function parseArgs(): Args {
  const args: Args = {};

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--source-id=')) {
      args.sourceId = arg.split('=')[1];
    } else if (arg.startsWith('--project-id=')) {
      args.projectId = arg.split('=')[1];
    } else if (arg === '--due') {
      args.due = true;
    } else if (arg.startsWith('--interval=')) {
      args.interval = parseInt(arg.split('=')[1], 10);
    }
  }

  return args;
}

function printUsage() {
  console.log('Usage:');
  console.log('  npm run scraper:test:db -- --source-id=<uuid>     # Scrape specific source');
  console.log('  npm run scraper:test:db -- --project-id=<uuid>    # Scrape all sources in project');
  console.log('  npm run scraper:test:db -- --due                  # Scrape sources due for refresh');
  console.log('  npm run scraper:test:db -- --due --interval=60    # Scrape sources not updated in 60min');
}

async function main() {
  const args = parseArgs();

  console.log('🚀 Starting scrape and save test...\n');

  try {
    // Mode 1: Scrape specific source by ID
    if (args.sourceId) {
      console.log(`Mode: Single source by ID`);
      console.log(`Source ID: ${args.sourceId}\n`);

      const source = await getSourceById(args.sourceId);

      if (!source) {
        console.error(`❌ Source not found: ${args.sourceId}`);
        process.exit(1);
      }

      const result = await scrapeAndSave(source);

      console.log('\n========== RESULT ==========');
      console.log(JSON.stringify({
        success: result.success,
        duplicate: result.duplicate,
        ingestionId: result.ingestionId,
        logId: result.logId,
        error: result.error,
        executionTimeMs: result.executionTimeMs,
      }, null, 2));
      console.log('============================\n');

      if (!result.success) {
        process.exit(1);
      }

      return;
    }

    // Mode 2: Scrape all sources in a project
    if (args.projectId) {
      console.log(`Mode: All sources in project`);
      console.log(`Project ID: ${args.projectId}\n`);

      const sources = await getActiveSources(args.projectId);

      if (sources.length === 0) {
        console.log('⚠️  No active sources found in this project');
        return;
      }

      const summary = await scrapeMultipleSources(sources);

      console.log('\n========== DETAILED RESULTS ==========');
      for (const result of summary.results) {
        console.log(`\n${result.sourceName} (${result.sourceId})`);
        console.log(`  Success: ${result.success}`);
        console.log(`  Duplicate: ${result.duplicate}`);
        if (result.ingestionId) {
          console.log(`  Ingestion ID: ${result.ingestionId}`);
        }
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      }
      console.log('\n======================================\n');

      return;
    }

    // Mode 3: Scrape sources due for refresh
    if (args.due) {
      const interval = args.interval || 15;
      console.log(`Mode: Sources due for scraping`);
      console.log(`Interval: ${interval} minutes\n`);

      const sources = await getSourcesDueForScraping(interval);

      if (sources.length === 0) {
        console.log('⚠️  No sources due for scraping');
        return;
      }

      const summary = await scrapeMultipleSources(sources);

      console.log('\n========== DETAILED RESULTS ==========');
      for (const result of summary.results) {
        console.log(`\n${result.sourceName} (${result.sourceId})`);
        console.log(`  Success: ${result.success}`);
        console.log(`  Duplicate: ${result.duplicate}`);
        if (result.ingestionId) {
          console.log(`  Ingestion ID: ${result.ingestionId}`);
        }
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      }
      console.log('\n======================================\n');

      return;
    }

    // No valid mode specified
    console.error('❌ Error: No valid mode specified\n');
    printUsage();
    process.exit(1);
  } catch (error) {
    console.error('❌ Unexpected error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
