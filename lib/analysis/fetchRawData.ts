/**
 * Analysis Data Fetching Utilities
 * Fetch raw data from the database for AI analysis
 */

import { createServiceClient } from '../supabase/service';
import { extractKeywords, containsKeywords } from '../scraper/keyword-filter';
import type {
  RawIngestionForAnalysis,
  ProjectAnalysisContext,
  RawIngestionRow,
  ProjectRow,
} from '../../types/analysis';

/**
 * Fetch unprocessed raw ingestions for a project within a time window
 *
 * @param projectId - The project UUID to fetch data for
 * @param hoursBack - Number of hours to look back (default: 24)
 * @returns Promise resolving to array of raw ingestions ready for analysis
 *
 * @example
 * const ingestions = await fetchUnprocessedIngestions('project-uuid', 24);
 * console.log(`Found ${ingestions.length} unprocessed items`);
 */
export async function fetchUnprocessedIngestions(
  projectId: string,
  hoursBack: number = 24
): Promise<RawIngestionForAnalysis[]> {
  const supabase = createServiceClient();

  // Calculate the time threshold
  const timeThreshold = new Date();
  timeThreshold.setHours(timeThreshold.getHours() - hoursBack);

  console.log(
    `[Analysis] Fetching unprocessed ingestions for project ${projectId} from last ${hoursBack} hours`
  );

  // Query raw_ingestions with join to sources
  // We need to filter by:
  // 1. Source belongs to the given project (via sources.project_id)
  // 2. ingested_at >= time threshold
  // 3. processed = false
  const { data, error } = await supabase
    .from('raw_ingestions')
    .select(
      `
      id,
      source_id,
      content,
      url,
      title,
      platform,
      word_count,
      ingested_at,
      metadata,
      sources!inner (
        name,
        url,
        platform,
        project_id
      )
    `
    )
    .eq('sources.project_id', projectId)
    .eq('processed', false)
    .gte('ingested_at', timeThreshold.toISOString())
    .order('ingested_at', { ascending: false });

  if (error) {
    console.error('[Analysis] Error fetching unprocessed ingestions:', error);
    throw new Error(`Failed to fetch ingestions: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('[Analysis] No unprocessed ingestions found');
    return [];
  }

  console.log(`[Analysis] Found ${data.length} unprocessed ingestions`);

  // Transform database rows to RawIngestionForAnalysis format
  const ingestions: RawIngestionForAnalysis[] = data.map((row: any) => ({
    id: row.id,
    source_id: row.source_id,
    content: row.content || '',
    url: row.url || '',
    title: row.title || '',
    ingested_at: row.ingested_at,
    platform: row.platform || row.sources.platform || 'generic',
    word_count: row.word_count || 0,
    content_hash: row.metadata?.contentHash,
    source: {
      name: row.sources.name,
      url: row.sources.url,
      platform: row.sources.platform || 'generic',
    },
    metadata: {
      extractionMethod: row.metadata?.extractionMethod,
      selectorsFound: row.metadata?.selectorsFound,
      scrolled: row.metadata?.scrolled,
    },
  }));

  return ingestions;
}

/**
 * Get project context for AI analysis
 * Fetches project information including signal instructions and active sources
 *
 * @param projectId - The project UUID
 * @returns Promise resolving to project analysis context
 *
 * @example
 * const context = await getProjectAnalysisContext('project-uuid');
 * console.log(`Project: ${context.name}`);
 * console.log(`Instructions: ${context.signal_instructions}`);
 */
export async function getProjectAnalysisContext(
  projectId: string
): Promise<ProjectAnalysisContext> {
  const supabase = createServiceClient();

  console.log(`[Analysis] Fetching project context for ${projectId}`);

  // Fetch project with its active sources
  const { data, error } = await supabase
    .from('projects')
    .select(
      `
      id,
      name,
      signal_instructions,
      risk_criteria,
      sources!inner (
        id,
        name,
        platform,
        url,
        is_active
      )
    `
    )
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('[Analysis] Error fetching project context:', error);
    throw new Error(`Failed to fetch project context: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Project not found: ${projectId}`);
  }

  console.log(`[Analysis] Found project: ${data.name}`);

  // Filter active sources and transform to expected format
  const activeSources = Array.isArray(data.sources)
    ? data.sources
        .filter((source: any) => source.is_active)
        .map((source: any) => ({
          id: source.id,
          name: source.name,
          platform: source.platform || 'generic',
          url: source.url,
        }))
    : [];

  console.log(`[Analysis] Found ${activeSources.length} active sources`);

  return {
    id: data.id,
    name: data.name,
    signal_instructions: data.signal_instructions,
    risk_criteria: data.risk_criteria ?? null,
    sources: activeSources,
  };
}

/**
 * Calculate statistics about the fetched ingestions
 *
 * @param ingestions - Array of raw ingestions
 * @param hoursBack - Number of hours that were queried
 * @returns Statistics object
 *
 * @example
 * const stats = calculateIngestionStats(ingestions, 24);
 * console.log(`Total items: ${stats.total_items}`);
 */
export function calculateIngestionStats(
  ingestions: RawIngestionForAnalysis[],
  hoursBack: number
): {
  total_items: number;
  time_range_start: string | null;
  time_range_end: string | null;
  hours_included: number;
  platforms: Record<string, number>;
} {
  if (ingestions.length === 0) {
    return {
      total_items: 0,
      time_range_start: null,
      time_range_end: null,
      hours_included: hoursBack,
      platforms: {},
    };
  }

  // Calculate time range (ingestions are already sorted by ingested_at DESC)
  const timeRangeEnd = ingestions[0].ingested_at; // Most recent
  const timeRangeStart = ingestions[ingestions.length - 1].ingested_at; // Oldest

  // Calculate platform breakdown
  const platforms: Record<string, number> = {};
  ingestions.forEach((ingestion) => {
    const platform = ingestion.platform || 'unknown';
    platforms[platform] = (platforms[platform] || 0) + 1;
  });

  return {
    total_items: ingestions.length,
    time_range_start: timeRangeStart,
    time_range_end: timeRangeEnd,
    hours_included: hoursBack,
    platforms,
  };
}

/**
 * Filter marketplace ingestions by project keywords
 * Extracts keywords from signal_instructions and filters listing content
 *
 * @param ingestions - Array of raw ingestions to filter
 * @param projectId - The project ID to get signal_instructions from
 * @returns Filtered array of ingestions
 *
 * @example
 * const filtered = await filterMarketplaceIngestions(ingestions, 'project-uuid');
 */
export async function filterMarketplaceIngestions(
  ingestions: RawIngestionForAnalysis[],
  projectId: string
): Promise<RawIngestionForAnalysis[]> {
  const supabase = createServiceClient();

  // Get project's signal_instructions
  const { data: project } = await supabase
    .from('projects')
    .select('signal_instructions')
    .eq('id', projectId)
    .single();

  if (!project || !project.signal_instructions) {
    console.log('[Filter] No signal_instructions found, returning all ingestions');
    return ingestions;
  }

  // Extract keywords
  const keywords = extractKeywords(project.signal_instructions);

  if (keywords.length === 0) {
    console.log('[Filter] No keywords extracted, returning all ingestions');
    return ingestions;
  }

  console.log(`[Filter] Extracted ${keywords.length} keywords:`, keywords.slice(0, 10));

  // Filter marketplace ingestions only
  const filtered = ingestions.filter(ingestion => {
    const isMarketplace = ingestion.platform === 'marketplace';

    if (!isMarketplace) {
      return true; // Keep all non-marketplace ingestions
    }

    // For marketplace, check if content matches keywords
    const text = ingestion.content || '';
    const matches = containsKeywords(text, keywords);

    if (!matches) {
      console.log(`[Filter] Filtered out marketplace ingestion (no keyword match): ${ingestion.id}`);
    }

    return matches;
  });

  const filteredCount = ingestions.length - filtered.length;
  if (filteredCount > 0) {
    console.log(`[Filter] Filtered out ${filteredCount} marketplace ingestions (${filtered.length} remaining)`);
  }

  return filtered;
}
