/**
 * Test script for the Puppeteer scraper
 * Usage: npm run scraper:test <url>
 *
 * @example
 * npm run scraper:test https://example.com
 */

import { scrapeUrl } from '../lib/scraper/core';
import { isValidUrl } from '../lib/scraper/utils';

async function main() {
  // Get URL from command line arguments
  const url = process.argv[2];

  // Validate URL argument
  if (!url) {
    console.error('Error: URL argument is required');
    console.log('Usage: npm run scraper:test <url>');
    console.log('Example: npm run scraper:test https://example.com');
    process.exit(1);
  }

  // Validate URL format
  if (!isValidUrl(url)) {
    console.error(`Error: Invalid URL format: ${url}`);
    process.exit(1);
  }

  console.log('🚀 Starting scraper...');
  console.log(`📍 Target URL: ${url}\n`);

  try {
    // Call scraper
    const result = await scrapeUrl(url);

    // Display results
    if (result.success && result.content) {
      console.log('✅ Scraping successful!\n');
      console.log('========== RESULTS ==========');
      console.log(JSON.stringify({
        success: result.success,
        url: result.url,
        timestamp: result.timestamp,
        metadata: result.metadata,
        content: {
          title: result.content.title,
          url: result.content.url,
          scrapedAt: result.content.scrapedAt,
          wordCount: result.content.wordCount,
          textPreview: result.content.text.substring(0, 200) + '...',
        },
      }, null, 2));
      console.log('=============================\n');

      // Display full text if needed (commented out by default to avoid clutter)
      // console.log('Full text content:');
      // console.log(result.content.text);
    } else {
      console.log('❌ Scraping failed!\n');
      console.log('========== ERROR ==========');
      console.log(JSON.stringify({
        success: result.success,
        url: result.url,
        timestamp: result.timestamp,
        error: result.error,
        metadata: result.metadata,
      }, null, 2));
      console.log('===========================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
