/**
 * Scraper Persistence Module
 * Handles saving scraped content to Supabase database
 */

import { createServiceClient } from '../supabase/service';
import {
  RawIngestionInsert,
  ScraperLogInsert,
  ScraperLogUpdate,
  ScrapedContent,
  ScraperResult,
  SourceRecord,
} from './types';
import { generateContentHash } from './utils';

/**
 * Start a scraper log entry with status 'running'
 *
 * @param sourceId - ID of the source being scraped
 * @returns Promise resolving to the log ID
 *
 * @example
 * const logId = await startScraperLog(sourceId);
 */
export async function startScraperLog(sourceId: string): Promise<string> {
  const supabase = createServiceClient();

  const logData: ScraperLogInsert = {
    source_id: sourceId,
    status: 'running',
    started_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('scraper_logs')
    .insert(logData)
    .select('id')
    .single();

  if (error) {
    console.error('[Persistence] Failed to start scraper log:', error);
    throw new Error(`Failed to start scraper log: ${error.message}`);
  }

  console.log(`[Persistence] Started scraper log: ${data.id}`);
  return data.id;
}

/**
 * Complete a scraper log entry with final status
 *
 * @param logId - ID of the log entry to update
 * @param status - Final status (completed or failed)
 * @param details - Additional details about the completion
 * @returns Promise that resolves when update is complete
 *
 * @example
 * await completeScraperLog(logId, 'completed', {
 *   itemsFound: 1,
 *   itemsProcessed: 1,
 *   executionTimeMs: 5000
 * });
 */
export async function completeScraperLog(
  logId: string,
  status: 'completed' | 'failed',
  details: {
    itemsFound?: number;
    itemsProcessed?: number;
    errorMessage?: string;
    executionTimeMs: number;
  }
): Promise<void> {
  const supabase = createServiceClient();

  const updateData: Partial<ScraperLogUpdate> = {
    status,
    completed_at: new Date().toISOString(),
    items_found: details.itemsFound,
    items_processed: details.itemsProcessed,
    error_message: details.errorMessage,
    execution_time_ms: details.executionTimeMs,
  };

  const { error } = await supabase
    .from('scraper_logs')
    .update(updateData)
    .eq('id', logId);

  if (error) {
    console.error('[Persistence] Failed to complete scraper log:', error);
    throw new Error(`Failed to complete scraper log: ${error.message}`);
  }

  console.log(`[Persistence] Completed scraper log: ${logId} (${status})`);
}

/**
 * Save scraped content to raw_ingestions table
 *
 * @param sourceId - ID of the source
 * @param scrapedContent - The scraped content to save
 * @param metadata - Additional metadata
 * @returns Promise resolving to the ingestion ID
 *
 * @example
 * const ingestionId = await saveRawIngestion(
 *   sourceId,
 *   scrapedContent,
 *   { extractionMethod: 'platform-specific' }
 * );
 */
export async function saveRawIngestion(
  sourceId: string,
  scrapedContent: ScrapedContent,
  metadata?: Record<string, any>
): Promise<string> {
  const supabase = createServiceClient();

  // Generate content hash for deduplication
  const contentHash = generateContentHash(scrapedContent.text);

  const ingestionData: RawIngestionInsert = {
    source_id: sourceId,
    raw_data: {
      text: scrapedContent.text,
      title: scrapedContent.title,
      url: scrapedContent.url,
      wordCount: scrapedContent.wordCount,
      platform: metadata?.platform || 'generic',
      scrapedAt: scrapedContent.scrapedAt.toISOString(),
    },
    metadata: {
      ...metadata,
      contentHash,
    },
  };

  const { data, error } = await supabase
    .from('raw_ingestions')
    .insert(ingestionData)
    .select('id')
    .single();

  if (error) {
    console.error('[Persistence] Failed to save raw ingestion:', error);
    throw new Error(`Failed to save raw ingestion: ${error.message}`);
  }

  console.log(
    `[Persistence] Saved raw ingestion: ${data.id} (${scrapedContent.wordCount} words)`
  );
  return data.id;
}

/**
 * Update source's last_fetch_at timestamp
 *
 * @param sourceId - ID of the source to update
 * @returns Promise that resolves when update is complete
 *
 * @example
 * await updateSourceLastFetch(sourceId);
 */
export async function updateSourceLastFetch(sourceId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('sources')
    .update({ last_fetch_at: new Date().toISOString() })
    .eq('id', sourceId);

  if (error) {
    console.error('[Persistence] Failed to update source last_fetch_at:', error);
    throw new Error(`Failed to update source: ${error.message}`);
  }

  console.log(`[Persistence] Updated last_fetch_at for source: ${sourceId}`);
}

/**
 * Check if content already exists by hash to avoid duplicates
 *
 * @param sourceId - ID of the source
 * @param contentHash - SHA-256 hash of the content
 * @returns Promise resolving to true if duplicate found, false otherwise
 *
 * @example
 * const isDupe = await isDuplicateContent(sourceId, contentHash);
 * if (isDupe) {
 *   console.log('Content already exists, skipping');
 * }
 */
export async function isDuplicateContent(
  sourceId: string,
  contentHash: string
): Promise<boolean> {
  const supabase = createServiceClient();

  // Check for existing content with same hash from this source
  const { data, error } = await supabase
    .from('raw_ingestions')
    .select('id')
    .eq('source_id', sourceId)
    .eq('metadata->>contentHash', contentHash)
    .limit(1);

  if (error) {
    console.error('[Persistence] Error checking for duplicates:', error);
    // If there's an error checking, assume not duplicate to be safe
    return false;
  }

  const isDuplicate = data && data.length > 0;
  if (isDuplicate) {
    console.log(`[Persistence] Duplicate content detected (hash: ${contentHash.substring(0, 8)}...)`);
  }

  return isDuplicate;
}

/**
 * High-level function to persist a scrape result with full logging
 *
 * @param source - The source record being scraped
 * @param result - The scraper result to persist
 * @returns Promise resolving to persistence result details
 *
 * @example
 * const persistResult = await persistScrapeResult(source, scraperResult);
 * if (persistResult.success) {
 *   console.log(`Saved as ingestion: ${persistResult.ingestionId}`);
 * }
 */
export async function persistScrapeResult(
  source: SourceRecord,
  result: ScraperResult
): Promise<{
  success: boolean;
  ingestionId?: string;
  logId: string;
  duplicate: boolean;
  error?: string;
}> {
  const startTime = Date.now();
  let logId: string;

  try {
    // Start scraper log
    logId = await startScraperLog(source.id);

    // If scraping failed, complete log as failed
    if (!result.success) {
      const executionTimeMs = Date.now() - startTime;
      await completeScraperLog(logId, 'failed', {
        errorMessage: result.error || 'Unknown error',
        executionTimeMs,
      });

      return {
        success: false,
        logId,
        duplicate: false,
        error: result.error,
      };
    }

    // Check if content is duplicate
    const contentHash = generateContentHash(result.content!.text);
    const isDuplicate = await isDuplicateContent(source.id, contentHash);

    if (isDuplicate) {
      // Complete log as successful but note it was a duplicate
      const executionTimeMs = Date.now() - startTime;
      await completeScraperLog(logId, 'completed', {
        itemsFound: 1,
        itemsProcessed: 0, // Not processed because duplicate
        executionTimeMs,
      });

      // Still update last_fetch_at to track that we checked
      await updateSourceLastFetch(source.id);

      return {
        success: true,
        logId,
        duplicate: true,
      };
    }

    // Save raw ingestion
    const ingestionId = await saveRawIngestion(
      source.id,
      result.content!,
      {
        platform: result.metadata?.platform,
        extractionMethod: result.metadata?.extractionMethod,
        selectorsFound: result.metadata?.selectorsFound,
        scrolled: result.metadata?.scrolled,
      }
    );

    // Update source last_fetch_at
    await updateSourceLastFetch(source.id);

    // Complete log as successful
    const executionTimeMs = Date.now() - startTime;
    await completeScraperLog(logId, 'completed', {
      itemsFound: 1,
      itemsProcessed: 1,
      executionTimeMs,
    });

    return {
      success: true,
      ingestionId,
      logId,
      duplicate: false,
    };
  } catch (error) {
    // If we have a logId, try to complete it as failed
    if (logId!) {
      try {
        const executionTimeMs = Date.now() - startTime;
        await completeScraperLog(logId!, 'failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          executionTimeMs,
        });
      } catch (logError) {
        console.error('[Persistence] Failed to complete error log:', logError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Persistence] Failed to persist scrape result:', errorMessage);

    return {
      success: false,
      logId: logId!,
      duplicate: false,
      error: errorMessage,
    };
  }
}
