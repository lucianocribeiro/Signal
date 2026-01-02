/**
 * Scraper Type Definitions
 * Core types for the Puppeteer-based web scraper module
 */

/**
 * Result of a scraping operation
 */
export interface ScraperResult {
  /** Whether the scraping operation was successful */
  success: boolean;

  /** Scraped content data (present if success is true) */
  content?: ScrapedContent;

  /** Original URL that was scraped */
  url: string;

  /** Timestamp when the scraping occurred */
  timestamp: Date;

  /** Error message (present if success is false) */
  error?: string;

  /** Additional metadata about the scraping operation */
  metadata?: {
    /** Domain extracted from the URL */
    domain: string;
    /** Time taken to complete the scraping (in ms) */
    duration: number;
    /** Platform detected from URL */
    platform?: Platform;
    /** Selectors that were successfully found */
    selectorsFound?: string[];
    /** Whether the page was scrolled */
    scrolled?: boolean;
    /** Method used for content extraction */
    extractionMethod?: string;
  };
}

/**
 * Configuration options for the scraper
 */
export interface ScraperOptions {
  /** Timeout for page navigation in milliseconds (default: 30000) */
  timeout?: number;

  /** CSS selector to wait for before extracting content */
  waitForSelector?: string;

  /** Whether to run browser in headless mode (default: true) */
  headless?: boolean;

  /** Custom user agent string */
  userAgent?: string;
}

/**
 * Scraped content with metadata
 */
export interface ScrapedContent {
  /** Extracted text content from the page */
  text: string;

  /** Page title */
  title: string;

  /** URL of the scraped page */
  url: string;

  /** Timestamp when content was scraped */
  scrapedAt: Date;

  /** Word count of extracted text */
  wordCount: number;
}

/**
 * Supported platforms for platform-specific scraping
 */
export type Platform = 'twitter' | 'reddit' | 'news' | 'generic';

/**
 * Platform-specific configuration for dynamic content handling
 */
export interface PlatformConfig {
  /** Platform name */
  name: Platform;

  /** CSS selectors to wait for (in priority order) */
  selectors: string[];

  /** CSS selectors to extract content from (in priority order) */
  contentSelectors: string[];

  /** Number of times to scroll down the page */
  scrollCount: number;

  /** Delay in ms to wait after each scroll */
  scrollDelay: number;

  /** Timeout in ms to wait for selectors */
  waitTimeout: number;
}

/**
 * Database Record Types
 * Types for inserting/updating database records
 */

/**
 * Data to insert into raw_ingestions table
 */
export interface RawIngestionInsert {
  /** Foreign key to sources table */
  source_id: string;

  /** Raw scraped data stored as JSONB */
  raw_data: {
    text: string;
    title: string;
    url: string;
    wordCount: number;
    platform: string;
    scrapedAt: string;
  };

  /** Additional metadata about the scraping operation */
  metadata?: {
    extractionMethod?: string;
    selectorsFound?: string[];
    scrolled?: boolean;
    contentHash?: string;
  };
}

/**
 * Data to insert into scraper_logs table
 */
export interface ScraperLogInsert {
  /** Foreign key to sources table */
  source_id: string;

  /** Current status of the scrape operation */
  status: 'pending' | 'running' | 'completed' | 'failed';

  /** When the scrape started */
  started_at?: string;

  /** When the scrape completed */
  completed_at?: string;

  /** Number of items found during scraping */
  items_found?: number;

  /** Number of items successfully processed */
  items_processed?: number;

  /** Error message if scrape failed */
  error_message?: string;

  /** Total execution time in milliseconds */
  execution_time_ms?: number;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Data to update scraper_logs table when completing
 */
export interface ScraperLogUpdate {
  /** Final status */
  status: 'completed' | 'failed';

  /** Completion timestamp */
  completed_at: string;

  /** Number of items found */
  items_found?: number;

  /** Number of items processed */
  items_processed?: number;

  /** Error message if failed */
  error_message?: string;

  /** Total execution time in milliseconds */
  execution_time_ms: number;
}

/**
 * Source record from database
 */
export interface SourceRecord {
  /** Source ID */
  id: string;

  /** Project this source belongs to */
  project_id: string;

  /** URL to scrape */
  url: string;

  /** Display name for the source */
  name: string;

  /** Platform type */
  platform: string;

  /** Whether this source is active */
  is_active: boolean;

  /** Last time this source was fetched */
  last_fetch_at: string | null;
}

/**
 * Cron Job and Refresh Types
 * Types for scheduled scraping with user-configurable intervals
 */

/**
 * Refresh interval options (in hours)
 */
export type RefreshInterval = 2 | 4 | 8 | 12;

/**
 * Refresh interval option with display metadata
 */
export interface RefreshIntervalOption {
  /** Interval value in hours */
  value: RefreshInterval;
  /** Display label in Spanish */
  label: string;
  /** Description of the interval */
  description: string;
}

/**
 * Available refresh interval options
 */
export const REFRESH_INTERVAL_OPTIONS: RefreshIntervalOption[] = [
  { value: 2, label: '2 horas', description: 'Actualizaciones frecuentes' },
  { value: 4, label: '4 horas', description: 'Balance recomendado' },
  { value: 8, label: '8 horas', description: 'Actualizaciones moderadas' },
  { value: 12, label: '12 horas', description: 'Actualizaciones mínimas' },
];

/**
 * Project refresh status information
 */
export interface ProjectRefreshStatus {
  /** Project UUID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Configured refresh interval in hours */
  refreshIntervalHours: number;
  /** Last refresh timestamp (ISO string) */
  lastRefreshAt: string | null;
  /** Hours elapsed since last refresh */
  hoursSinceRefresh: number;
  /** Whether project is due for refresh */
  isDue: boolean;
}

/**
 * Scrape lock to prevent concurrent execution
 */
export interface ScrapeLock {
  /** ISO timestamp when lock was acquired */
  locked_at: string;
  /** Execution ID (e.g., "cron-1234567890-abc") */
  locked_by: string;
  /** ISO timestamp when lock expires (locked_at + 10 minutes) */
  expires_at: string;
}

/**
 * Project settings stored in JSONB
 */
export interface ProjectSettings {
  /** Refresh interval in hours (2, 4, 8, or 12) */
  refresh_interval_hours?: RefreshInterval;
  /** Active scrape lock (null if not locked) */
  scrape_lock?: ScrapeLock | null;
}

/**
 * Result of a cron job execution
 */
export interface CronExecutionResult {
  /** Whether the overall execution was successful */
  success: boolean;
  /** Number of projects checked for refresh */
  projectsChecked: number;
  /** Number of projects actually refreshed */
  projectsRefreshed: number;
  /** Total number of sources scraped */
  sourcesScraped: number;
  /** Total number of duplicate items skipped */
  duplicatesSkipped: number;
  /** Array of error messages */
  errors: string[];
  /** Total execution time in milliseconds */
  executionTimeMs: number;
  /** ISO timestamp of execution start */
  timestamp: string;
  /** Detailed results per project */
  results: Array<{
    /** Project UUID */
    projectId: string;
    /** Project name */
    projectName: string;
    /** Number of sources scraped for this project */
    sourcesScraped: number;
    /** Number of successful scrapes */
    successful: number;
    /** Number of failed scrapes */
    failed: number;
    /** Number of duplicates found */
    duplicates: number;
    /** Error messages specific to this project */
    errors: string[];
  }>;
}
