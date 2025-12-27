/**
 * Test script for cron job logic
 * Run with: npm run cron:test
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

import { getProjectsDueForRefresh, executeCronScrape } from '../lib/scraper/cron';

async function testCronJob() {
  console.log('🔍 Testing Cron Job Logic\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Show projects due for refresh
    console.log('\n📋 Fetching projects due for refresh...\n');
    const projectsDue = await getProjectsDueForRefresh();

    console.log(`Found ${projectsDue.length} projects due for refresh:\n`);

    if (projectsDue.length === 0) {
      console.log('  ℹ️  No projects are currently due for refresh');
      console.log('  💡 Tip: Projects refresh based on their configured interval (2h, 4h, 8h, 12h)\n');
    } else {
      projectsDue.forEach((project, index) => {
        console.log(`  ${index + 1}. ${project.projectName}`);
        console.log(`     Interval: ${project.refreshIntervalHours}h`);
        console.log(`     Last refresh: ${project.lastRefreshAt || 'Never'}`);
        console.log(`     Hours since: ${project.hoursSinceRefresh.toFixed(1)}h`);
        console.log(`     Status: ${project.isDue ? '✅ Due' : '⏰ Not due yet'}`);
        console.log('');
      });
    }

    // Step 2: Execute cron scrape
    console.log('='.repeat(60));
    console.log('\n🚀 Executing cron scrape...\n');
    console.log('  This may take a while depending on the number of sources...\n');

    const result = await executeCronScrape();

    // Step 3: Print results
    console.log('='.repeat(60));
    console.log('\n✅ Cron execution complete!\n');
    console.log('📊 Summary:');
    console.log(`  - Projects checked: ${result.projectsChecked}`);
    console.log(`  - Projects refreshed: ${result.projectsRefreshed}`);
    console.log(`  - Sources scraped: ${result.sourcesScraped}`);
    console.log(`  - Duplicates skipped: ${result.duplicatesSkipped}`);
    console.log(`  - Execution time: ${result.executionTimeMs}ms (${(result.executionTimeMs / 1000).toFixed(1)}s)`);
    console.log(`  - Status: ${result.success ? '✅ Success' : '❌ Failed'}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (result.results.length > 0) {
      console.log('\n📁 Detailed results by project:\n');
      result.results.forEach((projectResult, index) => {
        console.log(`  ${index + 1}. ${projectResult.projectName}`);
        console.log(`     Sources scraped: ${projectResult.sourcesScraped}`);
        console.log(`     ✅ Successful: ${projectResult.successful}`);
        console.log(`     ❌ Failed: ${projectResult.failed}`);
        console.log(`     🔄 Duplicates: ${projectResult.duplicates}`);

        if (projectResult.errors.length > 0) {
          console.log(`     ⚠️  Errors:`);
          projectResult.errors.forEach(error => {
            console.log(`        - ${error}`);
          });
        }
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('\n✨ Test complete!\n');
  } catch (error) {
    console.error('\n='.repeat(60));
    console.error('\n❌ Test failed with error:\n');
    console.error(error);
    console.error('\n='.repeat(60));
    process.exit(1);
  }
}

// Run the test
testCronJob()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
