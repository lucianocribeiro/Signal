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
import { analyzeContentWithGemini } from '@/lib/gemini-client';
import { storeSignals } from '@/lib/signal-storage';
import { logTokenUsage } from '@/lib/analysis/logUsage';
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

function resolveAnalysisSourceType(platform: string): 'news' | 'twitter' | 'reddit' {
  if (platform === 'reddit') {
    return 'reddit';
  }
  if (platform === 'twitter' || platform === 'x_twitter') {
    return 'twitter';
  }
  return 'news';
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

    console.log(`[Project Scrape] === Manual refresh triggered ===`);
    console.log(`[Project Scrape] Project ID: ${projectId}`);
    console.log(`[Project Scrape] Project Name: ${project.name}`);
    console.log(`[Project Scrape] Owner ID: ${project.owner_id}`);

    // Get all active sources for this project
    console.log(`[Project Scrape] Fetching sources from database...`);
    console.log(`[Project Scrape] Query: SELECT * FROM sources WHERE project_id = '${projectId}' AND is_active = true`);

    const supabaseService = createServiceClient();
    const { data: sources, error: sourcesError } = await supabaseService
      .from('sources')
      .select('id, project_id, url, name, platform, is_active, last_fetch_at')
      .eq('project_id', projectId)
      .eq('is_active', true);

    console.log(`[Project Scrape] Database query completed`);
    console.log(`[Project Scrape] Sources error:`, sourcesError);
    console.log(`[Project Scrape] Sources found:`, sources?.length || 0);
    console.log(`[Project Scrape] Sources data:`, JSON.stringify(sources, null, 2));

    if (sourcesError) {
      console.error('[Project Scrape] ❌ Error fetching sources:', sourcesError);
      return NextResponse.json(
        { error: 'Error al obtener fuentes' },
        { status: 500 }
      );
    }

    if (!sources || sources.length === 0) {
      console.log(`[Project Scrape] ⚠️ No active sources found for project ${project.name}`);
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

    console.log(`[Project Scrape] ✅ Starting scrape of ${sources.length} sources for project ${project.name}`);

    // Scrape all sources in parallel with concurrency limit
    const limit = pLimit(CONCURRENT_SCRAPES);
    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    let totalSignalsDetected = 0;
    const errors: string[] = [];
    const analysisErrors: string[] = [];

    const scrapePromises = sources.map((source: any, index: number) =>
      limit(async () => {
        try {
          console.log(`\n[Project Scrape] === Processing source ${index + 1}/${sources.length} ===`);
          console.log(`[Project Scrape] Source ID: ${source.id}`);
          console.log(`[Project Scrape] Source Name: ${source.name}`);
          console.log(`[Project Scrape] Source URL: ${source.url}`);
          console.log(`[Project Scrape] Platform: ${source.platform}`);
          console.log(`[Project Scrape] Is Active: ${source.is_active}`);
          console.log(`[Project Scrape] Last Fetch: ${source.last_fetch_at}`);

          const sourceRecord: SourceRecord = {
            id: source.id,
            project_id: source.project_id,
            url: source.url,
            name: source.name,
            platform: source.platform,
            is_active: source.is_active,
            last_fetch_at: source.last_fetch_at,
          };

          console.log(`[Project Scrape] Calling scrapeAndSave...`);
          const result = await scrapeAndSave(sourceRecord);
          console.log(`[Project Scrape] scrapeAndSave returned:`, JSON.stringify(result, null, 2));

          if (result.success) {
            successful++;
            if (result.duplicate) {
              duplicates++;
              console.log(`[Project Scrape] ⚠️ Duplicate content for ${source.name}`);
            } else {
              console.log(`[Project Scrape] ✅ Successfully scraped ${source.name}`);
            }
          } else {
            failed++;
            errors.push(`${source.name}: ${result.error || 'Error desconocido'}`);
            console.error(`[Project Scrape] ❌ Failed to scrape ${source.name}: ${result.error}`);
          }

          if (result.success && !result.duplicate && result.ingestionId) {
            try {
              const { data: ingestion, error: ingestionError } = await supabaseService
                .from('raw_ingestions')
                .select('id, raw_data')
                .eq('id', result.ingestionId)
                .single();

              if (ingestionError || !ingestion) {
                throw new Error(ingestionError?.message || 'No ingestion found for analysis');
              }

              const rawData = ingestion.raw_data as { text?: string } | null;
              const content = rawData?.text?.trim() || '';

              if (!content) {
                throw new Error('Ingestion content is empty, skipping analysis');
              }

              console.log(`[Project Scrape] 🤖 Starting AI analysis for ingestion: ${ingestion.id}`);
              const analysisStart = Date.now();

              const analysisResult = await analyzeContentWithGemini({
                projectId,
                ingestionId: ingestion.id,
                content,
                sourceType: resolveAnalysisSourceType(source.platform),
                sourceUrl: source.url,
              });

              const analysisDuration = Date.now() - analysisStart;
              totalSignalsDetected += analysisResult.signals.length;

              await storeSignals({
                projectId,
                ingestionId: ingestion.id,
                sourceId: source.id,
                sourceUrl: source.url,
                signals: analysisResult.signals,
              });

              const { error: updateError } = await supabaseService
                .from('raw_ingestions')
                .update({
                  status: 'analyzed',
                  analyzed_at: new Date().toISOString(),
                  error_message: null,
                })
                .eq('id', ingestion.id);

              if (updateError) {
                console.error('[Project Scrape] ❌ Failed to update ingestion status:', updateError);
              }

              try {
                await logTokenUsage(
                  projectId,
                  'ingestion_analysis',
                  'gemini-1.5-flash',
                  analysisResult.promptTokens,
                  analysisResult.completionTokens,
                  {
                    ingestion_id: ingestion.id,
                    signals_detected: analysisResult.signals.length,
                    duration_ms: analysisDuration,
                    trigger: 'manual_scrape',
                  }
                );
              } catch (usageError) {
                console.error('[Project Scrape] ⚠️ Failed to log token usage:', usageError);
              }

              console.log(`[Project Scrape] ✅ AI analysis complete for source: ${source.url}`);
            } catch (analysisError) {
              const message = analysisError instanceof Error ? analysisError.message : 'Unknown analysis error';
              analysisErrors.push(`${source.name}: ${message}`);
              console.error(`[Project Scrape] ❌ AI analysis failed for ${source.url}:`, analysisError);

              await supabaseService
                .from('raw_ingestions')
                .update({
                  status: 'analysis_failed',
                  error_message: message,
                })
                .eq('id', result.ingestionId);
            }
          }

          // Add delay between sources (rate limiting)
          if (index < sources.length - 1) {
            console.log(`[Project Scrape] Waiting ${DELAY_BETWEEN_SOURCES_MS}ms before next source...`);
            await delay(DELAY_BETWEEN_SOURCES_MS);
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
          errors.push(`${source.name}: ${errorMsg}`);
          console.error(`[Project Scrape] ❌ Exception scraping ${source.name}:`, error);
          console.error(`[Project Scrape] Stack trace:`, error instanceof Error ? error.stack : 'N/A');
        }
      })
    );

    // Wait for all sources to complete
    console.log(`[Project Scrape] Waiting for all ${scrapePromises.length} scrape operations to complete...`);
    await Promise.all(scrapePromises);
    console.log(`[Project Scrape] All scrape operations completed`);

    // Update project's last_refresh_at
    console.log(`[Project Scrape] Updating project last_refresh_at...`);
    await updateProjectLastRefresh(projectId);

    const executionTimeMs = Date.now() - startTime;

    console.log(`\n[Project Scrape] ========== FINAL SUMMARY ==========`);
    console.log(`[Project Scrape] Project: ${project.name}`);
    console.log(`[Project Scrape] Total sources: ${sources.length}`);
    console.log(`[Project Scrape] Successful: ${successful}`);
    console.log(`[Project Scrape] Failed: ${failed}`);
    console.log(`[Project Scrape] Duplicates: ${duplicates}`);
    console.log(`[Project Scrape] Signals detected: ${totalSignalsDetected}`);
    console.log(`[Project Scrape] Execution time: ${executionTimeMs}ms`);
    console.log(`[Project Scrape] Errors:`, errors);
    console.log(`[Project Scrape] Analysis Errors:`, analysisErrors);
    console.log(`[Project Scrape] ===================================\n`);

    return NextResponse.json({
      success: errors.length === 0,
      projectId,
      projectName: project.name,
      sourcesScraped: sources.length,
      successful,
      failed,
      duplicates,
      errors,
      analysisErrors,
      signals_detected: totalSignalsDetected,
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
