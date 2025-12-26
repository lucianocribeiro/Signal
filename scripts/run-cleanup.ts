/**
 * Run data cleanup script
 * Deletes old raw_ingestions (>14 days) and scraper_logs (>30 days)
 *
 * Usage:
 * npm run scraper:cleanup
 */

import { createServiceClient } from '../lib/supabase/service';

async function main() {
  console.log('🧹 Starting data cleanup...\n');

  try {
    const supabase = createServiceClient();

    // Call the cleanup function
    const { data, error } = await supabase.rpc('run_data_cleanup');

    if (error) {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Cleanup completed successfully!\n');
    console.log('========== CLEANUP RESULTS ==========');
    console.log(`Raw ingestions deleted: ${data.ingestions_deleted || 0}`);
    console.log(`Scraper logs deleted:   ${data.logs_deleted || 0}`);
    console.log('=====================================\n');

    if (data.ingestions_deleted === 0 && data.logs_deleted === 0) {
      console.log('ℹ️  No old records found to delete');
    }
  } catch (error) {
    console.error('❌ Unexpected error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
