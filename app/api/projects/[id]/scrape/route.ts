/**
 * Project-Scoped Scrape Trigger
 * Allows project owners to immediately refresh a specific project
 * Ignores refresh interval - always scrapes immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { scrapeAndSave } from '@/lib/scraper/scrape-and-save';
import { SourceRecord } from '@/lib/scraper/types';
import { updateProjectLastRefresh } from '@/lib/scraper/cron';
import pLimit from 'p-limit';

// Force dynamic rendering and set max duration (Puppeteer requires memory)
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// Rate limiting
const DELAY_BETWEEN_SOURCES_MS = 2000;
const CONCURRENT_SCRAPES = 5;

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST handler - Immediately refresh a project (ignores interval)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const projectId = params.id;

  try {
    // Verify user owns the project
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Check project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, owner_id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o acceso denegado' },
        { status: 404 }
      );
    }

    console.log(`[Project Scrape] Manual refresh triggered for project: ${project.name}`);

    // Get all active sources for this project
    const supabaseService = createServiceClient();
    const { data: sources, error: sourcesError } = await supabaseService
      .from('sources')
      .select('id, project_id, url, name, platform, is_active, last_fetch_at')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (sourcesError) {
      console.error('[Project Scrape] Error fetching sources:', sourcesError);
      return NextResponse.json(
        { error: 'Error al obtener fuentes' },
        { status: 500 }
      );
    }

    if (!sources || sources.length === 0) {
      console.log(`[Project Scrape] No active sources found for project ${project.name}`);
      return NextResponse.json({
        success: true,
        projectId,
        projectName: project.name,
        sourcesScraped: 0,
        successful: 0,
        failed: 0,
        duplicates: 0,
        message: 'No hay fuentes activas para actualizar',
        executionTimeMs: Date.now() - startTime,
      });
    }

    console.log(`[Project Scrape] Scraping ${sources.length} sources for project ${project.name}`);

    // Scrape all sources in parallel with concurrency limit
    const limit = pLimit(CONCURRENT_SCRAPES);
    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    const errors: string[] = [];

    const scrapePromises = sources.map((source: any, index: number) =>
      limit(async () => {
        try {
          console.log(`[Project Scrape] Scraping: ${source.name}`);

          const sourceRecord: SourceRecord = {
            id: source.id,
            project_id: source.project_id,
            url: source.url,
            name: source.name,
            platform: source.platform,
            is_active: source.is_active,
            last_fetch_at: source.last_fetch_at,
          };

          const result = await scrapeAndSave(sourceRecord);

          if (result.success) {
            successful++;
            if (result.duplicate) {
              duplicates++;
            }
          } else {
            failed++;
            errors.push(`${source.name}: ${result.error || 'Error desconocido'}`);
          }

          // Add delay between sources (rate limiting)
          if (index < sources.length - 1) {
            await delay(DELAY_BETWEEN_SOURCES_MS);
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
          errors.push(`${source.name}: ${errorMsg}`);
          console.error(`[Project Scrape] Error scraping ${source.name}:`, error);
        }
      })
    );

    // Wait for all sources to complete
    await Promise.all(scrapePromises);

    // Update project's last_refresh_at
    await updateProjectLastRefresh(projectId);

    const executionTimeMs = Date.now() - startTime;

    console.log(`[Project Scrape] Complete for ${project.name}: ${successful} successful, ${failed} failed, ${duplicates} duplicates`);

    return NextResponse.json({
      success: errors.length === 0,
      projectId,
      projectName: project.name,
      sourcesScraped: sources.length,
      successful,
      failed,
      duplicates,
      errors,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    console.error(`[Project Scrape] Fatal error for project ${projectId}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
