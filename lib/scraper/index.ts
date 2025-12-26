/**
 * Scraper Module
 * Barrel export file for all scraper functionality
 */

// Core scraping function
export { scrapeUrl } from './core';

// Platform detection and configuration
export { detectPlatform, getPlatformConfig, getPlatformConfigForUrl } from './platforms';

// Dynamic content handling
export {
  waitForDynamicContent,
  scrollPage,
  extractPlatformContent,
  getFoundSelectors,
} from './dynamic-handler';

// Utility functions
export {
  cleanText,
  extractDomain,
  generateContentHash,
  isValidUrl,
  delay,
} from './utils';

// Persistence functions
export {
  startScraperLog,
  completeScraperLog,
  saveRawIngestion,
  updateSourceLastFetch,
  isDuplicateContent,
  persistScrapeResult,
} from './persistence';

// Source fetching functions
export {
  getActiveSources,
  getSourceById,
  getSourcesDueForScraping,
} from './sources';

// High-level scrape and save functions
export {
  scrapeAndSave,
  scrapeMultipleSources,
} from './scrape-and-save';

// Type exports
export type {
  ScraperResult,
  ScraperOptions,
  ScrapedContent,
  Platform,
  PlatformConfig,
  RawIngestionInsert,
  ScraperLogInsert,
  ScraperLogUpdate,
  SourceRecord,
} from './types';
