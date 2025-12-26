/**
 * Source Fetching Module
 * Functions for fetching source records from the database
 */

import { createServiceClient } from '../supabase/service';
import { SourceRecord } from './types';

/**
 * Get all active sources, optionally filtered by project
 *
 * @param projectId - Optional project ID to filter by
 * @returns Promise resolving to array of active source records
 *
 * @example
 * // Get all active sources
 * const sources = await getActiveSources();
 *
 * // Get active sources for a specific project
 * const projectSources = await getActiveSources(projectId);
 */
export async function getActiveSources(
  projectId?: string
): Promise<SourceRecord[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('sources')
    .select('id, project_id, url, name, platform, is_active, last_fetch_at')
    .eq('is_active', true);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Sources] Failed to fetch active sources:', error);
    throw new Error(`Failed to fetch active sources: ${error.message}`);
  }

  console.log(`[Sources] Found ${data.length} active source(s)`);
  return data as SourceRecord[];
}

/**
 * Get a single source by ID
 *
 * @param sourceId - ID of the source to fetch
 * @returns Promise resolving to source record or null if not found
 *
 * @example
 * const source = await getSourceById(sourceId);
 * if (source) {
 *   console.log(`Found source: ${source.name}`);
 * }
 */
export async function getSourceById(
  sourceId: string
): Promise<SourceRecord | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('sources')
    .select('id, project_id, url, name, platform, is_active, last_fetch_at')
    .eq('id', sourceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      console.warn(`[Sources] Source not found: ${sourceId}`);
      return null;
    }
    console.error('[Sources] Failed to fetch source:', error);
    throw new Error(`Failed to fetch source: ${error.message}`);
  }

  console.log(`[Sources] Found source: ${data.name} (${data.id})`);
  return data as SourceRecord;
}

/**
 * Get sources that need scraping based on last fetch time
 *
 * @param intervalMinutes - Minimum minutes since last fetch (default: 15)
 * @returns Promise resolving to array of sources due for scraping
 *
 * @example
 * // Get sources that haven't been scraped in 15 minutes
 * const duesSources = await getSourcesDueForScraping();
 *
 * // Get sources that haven't been scraped in 1 hour
 * const staleSources = await getSourcesDueForScraping(60);
 */
export async function getSourcesDueForScraping(
  intervalMinutes: number = 15
): Promise<SourceRecord[]> {
  const supabase = createServiceClient();

  // Calculate cutoff time
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - intervalMinutes);

  const { data, error } = await supabase
    .from('sources')
    .select('id, project_id, url, name, platform, is_active, last_fetch_at')
    .eq('is_active', true)
    .or(`last_fetch_at.is.null,last_fetch_at.lt.${cutoffTime.toISOString()}`);

  if (error) {
    console.error('[Sources] Failed to fetch sources due for scraping:', error);
    throw new Error(`Failed to fetch sources due for scraping: ${error.message}`);
  }

  console.log(
    `[Sources] Found ${data.length} source(s) due for scraping (interval: ${intervalMinutes}min)`
  );
  return data as SourceRecord[];
}
