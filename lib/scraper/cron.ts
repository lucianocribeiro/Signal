/**
 * Cron Job Module for Scheduled Scraping
 * Handles scheduled project refreshes with configurable intervals
 */

import pLimit from 'p-limit';
import { createServiceClient } from '@/lib/supabase/service';
import {
  CronExecutionResult,
  ProjectRefreshStatus,
  RefreshInterval,
  ScrapeLock,
  SourceRecord,
} from './types';
import { scrapeAndSave } from './scrape-and-save';

// Rate limiting configuration to prevent getting blocked
const DELAY_BETWEEN_SOURCES_MS = 2000; // 2 seconds between each source scrape
const DELAY_BETWEEN_PROJECTS_MS = 3000; // 3 seconds between each project

// Execution limits to stay within Vercel's 5-minute timeout
const MAX_PROJECTS_PER_RUN = 10; // Maximum projects to scrape per execution
const MAX_SOURCES_PER_PROJECT = 20; // Maximum sources per project

// Concurrency limit for parallel scraping
const CONCURRENT_SCRAPES = 5; // Max 5 concurrent source scrapes

// Lock expiration (10 minutes)
const LOCK_DURATION_MS = 10 * 60 * 1000;

/**
 * Delay helper function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get all projects that are due for refresh based on their interval
 */
export async function getProjectsDueForRefresh(): Promise<ProjectRefreshStatus[]> {
  const supabase = createServiceClient();

  try {
    const { data, error } = await supabase.rpc('get_projects_due_for_refresh');

    if (error) {
      console.error('[Cron] Error fetching projects due for refresh:', error);
      throw error;
    }

    // Filter to only return projects that are actually due
    const projectsDue = (data || [])
      .filter((p: any) => p.is_due)
      .map((p: any) => ({
        projectId: p.project_id,
        projectName: p.project_name,
        refreshIntervalHours: p.refresh_interval_hours,
        lastRefreshAt: p.last_refresh_at,
        hoursSinceRefresh: parseFloat(p.hours_since_refresh),
        isDue: p.is_due,
      }));

    console.log(`[Cron] Found ${projectsDue.length} projects due for refresh`);
    return projectsDue;
  } catch (error) {
    console.error('[Cron] Failed to get projects due for refresh:', error);
    throw error;
  }
}

/**
 * Update project's last_refresh_at timestamp
 */
export async function updateProjectLastRefresh(projectId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('projects')
    .update({ last_refresh_at: new Date().toISOString() })
    .eq('id', projectId);

  if (error) {
    console.error(`[Cron] Error updating last_refresh_at for project ${projectId}:`, error);
    throw error;
  }

  console.log(`[Cron] Updated last_refresh_at for project ${projectId}`);
}

/**
 * Get project's configured refresh interval (default: 4 hours)
 */
export async function getProjectRefreshInterval(projectId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('projects')
    .select('settings')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error(`[Cron] Error fetching refresh interval for project ${projectId}:`, error);
    return 4; // Default to 4 hours on error
  }

  const interval = data?.settings?.refresh_interval_hours;
  return interval && [2, 4, 8, 12].includes(interval) ? interval : 4;
}

/**
 * Set project's refresh interval
 */
export async function setProjectRefreshInterval(
  projectId: string,
  hours: RefreshInterval
): Promise<void> {
  // Validate hours
  if (![2, 4, 8, 12].includes(hours)) {
    throw new Error(`Invalid refresh interval: ${hours}. Must be 2, 4, 8, or 12`);
  }

  const supabase = createServiceClient();

  const { error } = await supabase.rpc('jsonb_set', {
    target: 'projects',
    id: projectId,
    path: '{refresh_interval_hours}',
    value: hours.toString(),
  });

  if (error) {
    // Fallback: use raw SQL update
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        settings: supabase.raw(`
          jsonb_set(
            COALESCE(settings, '{}'::jsonb),
            '{refresh_interval_hours}',
            '${hours}'
          )
        `),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error(`[Cron] Error setting refresh interval for project ${projectId}:`, updateError);
      throw updateError;
    }
  }

  console.log(`[Cron] Set refresh interval to ${hours}h for project ${projectId}`);
}

/**
 * Acquire a scrape lock for a project
 * Returns true if lock was acquired, false if already locked
 */
async function acquireScrapeLock(projectId: string, executionId: string): Promise<boolean> {
  const supabase = createServiceClient();

  try {
    // Get current project settings
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('settings')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      console.error(`[Cron] Error fetching project ${projectId} for lock:`, fetchError);
      return false;
    }

    // Check if already locked and not expired
    const currentLock = project?.settings?.scrape_lock as ScrapeLock | undefined;
    if (currentLock) {
      const expiresAt = new Date(currentLock.expires_at);
      if (expiresAt > new Date()) {
        console.log(`[Cron] Project ${projectId} is already locked by ${currentLock.locked_by}`);
        return false;
      }
      // Lock is expired, we can proceed
      console.log(`[Cron] Lock for project ${projectId} has expired, acquiring new lock`);
    }

    // Acquire new lock
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

    const newLock: ScrapeLock = {
      locked_at: now.toISOString(),
      locked_by: executionId,
      expires_at: expiresAt.toISOString(),
    };

    const currentSettings = project?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      scrape_lock: newLock,
    };

    const { error: updateError } = await supabase
      .from('projects')
      .update({ settings: updatedSettings })
      .eq('id', projectId);

    if (updateError) {
      console.error(`[Cron] Error acquiring lock for project ${projectId}:`, updateError);
      return false;
    }

    console.log(`[Cron] Acquired lock for project ${projectId} (execution: ${executionId})`);
    return true;
  } catch (error) {
    console.error(`[Cron] Failed to acquire lock for project ${projectId}:`, error);
    return false;
  }
}

/**
 * Release scrape lock for a project
 */
async function releaseScrapeLock(projectId: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Get current settings
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('settings')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      console.error(`[Cron] Error fetching project ${projectId} for lock release:`, fetchError);
      return;
    }

    // Remove lock from settings
    const currentSettings = project?.settings || {};
    const { scrape_lock, ...settingsWithoutLock } = currentSettings;

    const { error: updateError } = await supabase
      .from('projects')
      .update({ settings: settingsWithoutLock })
      .eq('id', projectId);

    if (updateError) {
      console.error(`[Cron] Error releasing lock for project ${projectId}:`, updateError);
      return;
    }

    console.log(`[Cron] Released lock for project ${projectId}`);
  } catch (error) {
    console.error(`[Cron] Failed to release lock for project ${projectId}:`, error);
  }
}

/**
 * Get projects with their active sources in a single query (avoid N+1)
 */
async function getProjectsWithSources(projectIds: string[]) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      owner_id,
      settings,
      last_refresh_at,
      sources!inner (
        id,
        url,
        name,
        platform,
        is_active,
        last_fetch_at,
        project_id
      )
    `)
    .in('id', projectIds)
    .eq('is_active', true)
    .eq('sources.is_active', true);

  if (error) {
    console.error('[Cron] Error fetching projects with sources:', error);
    throw error;
  }

  return data || [];
}

/**
 * Main cron execution function
 *
 * NOTE: scrapeAndSave() from Epic 3.3 already includes:
 * - Content hash generation via generateContentHash()
 * - Duplicate detection via isDuplicateContent()
 * - Skipping database insert for duplicate content
 * The cron module inherits this automatically - no additional deduplication code is needed.
 */
export async function executeCronScrape(): Promise<CronExecutionResult> {
  const startTime = Date.now();
  const executionId = `cron-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[Cron] Starting execution ${executionId}`);

  const result: CronExecutionResult = {
    success: true,
    projectsChecked: 0,
    projectsRefreshed: 0,
    sourcesScraped: 0,
    duplicatesSkipped: 0,
    errors: [],
    executionTimeMs: 0,
    timestamp: new Date().toISOString(),
    results: [],
  };

  try {
    // Step 1: Get projects due for refresh
    const projectsDue = await getProjectsDueForRefresh();
    result.projectsChecked = projectsDue.length;

    if (projectsDue.length === 0) {
      console.log('[Cron] No projects due for refresh');
      result.executionTimeMs = Date.now() - startTime;
      return result;
    }

    // Step 2: Limit to MAX_PROJECTS_PER_RUN
    const projectsToRefresh = projectsDue.slice(0, MAX_PROJECTS_PER_RUN);
    if (projectsDue.length > MAX_PROJECTS_PER_RUN) {
      console.log(`[Cron] Limiting to ${MAX_PROJECTS_PER_RUN} projects (${projectsDue.length - MAX_PROJECTS_PER_RUN} deferred)`);
    }

    // Step 3: Fetch projects with sources in single query
    const projectIds = projectsToRefresh.map(p => p.projectId);
    const projectsWithSources = await getProjectsWithSources(projectIds);

    // Step 4: Process each project
    for (const project of projectsWithSources) {
      try {
        // Try to acquire lock
        const lockAcquired = await acquireScrapeLock(project.id, executionId);
        if (!lockAcquired) {
          console.log(`[Cron] Skipping project ${project.name} - could not acquire lock`);
          result.errors.push(`Project ${project.name}: Could not acquire lock (another scrape in progress)`);
          continue;
        }

        console.log(`[Cron] Processing project: ${project.name} (${project.sources?.length || 0} sources)`);

        const projectResult = {
          projectId: project.id,
          projectName: project.name,
          sourcesScraped: 0,
          successful: 0,
          failed: 0,
          duplicates: 0,
          errors: [] as string[],
        };

        // Limit sources per project
        const sources = (project.sources || []).slice(0, MAX_SOURCES_PER_PROJECT);
        if ((project.sources?.length || 0) > MAX_SOURCES_PER_PROJECT) {
          console.log(`[Cron] Limiting to ${MAX_SOURCES_PER_PROJECT} sources for project ${project.name}`);
        }

        // Step 5: Scrape sources in parallel with concurrency limit
        const limit = pLimit(CONCURRENT_SCRAPES);

        const scrapePromises = sources.map((source: any, index: number) =>
          limit(async () => {
            try {
              console.log(`[Cron] Scraping source: ${source.name} (${source.url})`);

              const sourceRecord: SourceRecord = {
                id: source.id,
                project_id: project.id,
                url: source.url,
                name: source.name,
                platform: source.platform,
                is_active: source.is_active,
                last_fetch_at: source.last_fetch_at,
              };

              const scrapeResult = await scrapeAndSave(sourceRecord);

              projectResult.sourcesScraped++;

              if (scrapeResult.success) {
                projectResult.successful++;
                if (scrapeResult.duplicate) {
                  projectResult.duplicates++;
                }
              } else {
                projectResult.failed++;
                projectResult.errors.push(`${source.name}: ${scrapeResult.error || 'Unknown error'}`);
              }

              // Add delay between sources (rate limiting)
              if (index < sources.length - 1) {
                await delay(DELAY_BETWEEN_SOURCES_MS);
              }
            } catch (error) {
              projectResult.failed++;
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              projectResult.errors.push(`${source.name}: ${errorMsg}`);
              console.error(`[Cron] Error scraping source ${source.name}:`, error);
            }
          })
        );

        // Wait for all sources to complete
        await Promise.all(scrapePromises);

        // Step 6: Update project's last_refresh_at
        await updateProjectLastRefresh(project.id);

        // Step 7: Release lock
        await releaseScrapeLock(project.id);

        // Add to results
        result.results.push(projectResult);
        result.projectsRefreshed++;
        result.sourcesScraped += projectResult.sourcesScraped;
        result.duplicatesSkipped += projectResult.duplicates;

        // Add project errors to global errors
        if (projectResult.errors.length > 0) {
          result.errors.push(...projectResult.errors.map(e => `[${project.name}] ${e}`));
        }

        console.log(`[Cron] Completed project ${project.name}: ${projectResult.successful} successful, ${projectResult.failed} failed, ${projectResult.duplicates} duplicates`);

        // Delay between projects
        await delay(DELAY_BETWEEN_PROJECTS_MS);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Project ${project.name}: ${errorMsg}`);
        console.error(`[Cron] Error processing project ${project.name}:`, error);

        // Make sure to release lock even on error
        await releaseScrapeLock(project.id);
      }
    }

    result.executionTimeMs = Date.now() - startTime;
    result.success = result.errors.length === 0;

    console.log(`[Cron] Execution ${executionId} complete: ${result.projectsRefreshed} projects refreshed, ${result.sourcesScraped} sources scraped, ${result.duplicatesSkipped} duplicates skipped in ${result.executionTimeMs}ms`);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.success = false;
    result.errors.push(`Fatal error: ${errorMsg}`);
    result.executionTimeMs = Date.now() - startTime;

    console.error(`[Cron] Fatal error in execution ${executionId}:`, error);
    return result;
  }
}
