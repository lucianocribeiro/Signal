/**
 * Scrape and Save Module
 * High-level functions that combine scraping and database persistence
 */

import { scrapeUrl } from './core';
import { persistScrapeResult } from './persistence';
import { SourceRecord } from './types';

/**
 * Scrape a source and save the result to the database
 *
 * @param source - The source record to scrape
 * @returns Promise resolving to scrape and save result
 *
 * @example
 * const result = await scrapeAndSave(source);
 * if (result.success) {
 *   console.log(`Saved as ingestion: ${result.ingestionId}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 */
export async function scrapeAndSave(source: SourceRecord): Promise<{
  success: boolean;
  ingestionId?: string;
  logId: string;
  duplicate: boolean;
  error?: string;
  executionTimeMs: number;
}> {
  const startTime = Date.now();

  console.log(`\n[Scrape & Save] ========== Starting scrape ==========`);
  console.log(`[Scrape & Save] Source Name: ${source.name}`);
  console.log(`[Scrape & Save] Source ID: ${source.id}`);
  console.log(`[Scrape & Save] URL: ${source.url}`);
  console.log(`[Scrape & Save] Platform: ${source.platform}`);
  console.log(`[Scrape & Save] Project ID: ${source.project_id}`);

  try {
    // Scrape the URL
    console.log(`[Scrape & Save] Calling scrapeUrl('${source.url}')...`);
    const scrapeResult = await scrapeUrl(source.url);
    console.log(`[Scrape & Save] scrapeUrl returned:`, JSON.stringify({
      success: scrapeResult.success,
      hasContent: !!scrapeResult.content,
      contentLength: scrapeResult.content?.text?.length || 0,
      error: scrapeResult.error,
      metadata: scrapeResult.metadata
    }, null, 2));

    // Persist the result
    console.log(`[Scrape & Save] Calling persistScrapeResult...`);
    const persistResult = await persistScrapeResult(source, scrapeResult);
    console.log(`[Scrape & Save] persistScrapeResult returned:`, JSON.stringify(persistResult, null, 2));

    const executionTimeMs = Date.now() - startTime;

    if (persistResult.success) {
      if (persistResult.duplicate) {
        console.log(
          `[Scrape & Save] ✅ Completed (duplicate content, skipped save) - ${executionTimeMs}ms`
        );
      } else {
        console.log(
          `[Scrape & Save] ✅ Completed successfully - ${executionTimeMs}ms`
        );
        console.log(`[Scrape & Save] Ingestion ID: ${persistResult.ingestionId}`);
      }
    } else {
      console.error(
        `[Scrape & Save] ❌ Failed: ${persistResult.error} - ${executionTimeMs}ms`
      );
    }

    return {
      ...persistResult,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`[Scrape & Save] ❌ Exception: ${errorMessage} - ${executionTimeMs}ms`);

    return {
      success: false,
      logId: '', // No log ID if we failed before creating one
      duplicate: false,
      error: errorMessage,
      executionTimeMs,
    };
  }
}

/**
 * Scrape multiple sources sequentially
 *
 * @param sources - Array of source records to scrape
 * @returns Promise resolving to summary of results
 *
 * @example
 * const summary = await scrapeMultipleSources(sources);
 * console.log(`Scraped ${summary.total} sources: ${summary.successful} successful`);
 */
export async function scrapeMultipleSources(sources: SourceRecord[]): Promise<{
  total: number;
  successful: number;
  failed: number;
  duplicates: number;
  results: Array<{
    sourceId: string;
    sourceName: string;
    success: boolean;
    duplicate: boolean;
    ingestionId?: string;
    error?: string;
  }>;
}> {
  console.log(`\n[Scrape Multiple] Starting batch scrape of ${sources.length} source(s)\n`);

  const results: Array<{
    sourceId: string;
    sourceName: string;
    success: boolean;
    duplicate: boolean;
    ingestionId?: string;
    error?: string;
  }> = [];

  let successful = 0;
  let failed = 0;
  let duplicates = 0;

  for (const source of sources) {
    const result = await scrapeAndSave(source);

    results.push({
      sourceId: source.id,
      sourceName: source.name,
      success: result.success,
      duplicate: result.duplicate,
      ingestionId: result.ingestionId,
      error: result.error,
    });

    if (result.success) {
      successful++;
      if (result.duplicate) {
        duplicates++;
      }
    } else {
      failed++;
    }
  }

  console.log(`\n[Scrape Multiple] ========== BATCH SUMMARY ==========`);
  console.log(`[Scrape Multiple] Total sources: ${sources.length}`);
  console.log(`[Scrape Multiple] Successful: ${successful}`);
  console.log(`[Scrape Multiple] Failed: ${failed}`);
  console.log(`[Scrape Multiple] Duplicates: ${duplicates}`);
  console.log(`[Scrape Multiple] ===================================\n`);

  return {
    total: sources.length,
    successful,
    failed,
    duplicates,
    results,
  };
}
