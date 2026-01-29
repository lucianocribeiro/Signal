/**
 * Project-Scoped Scrape Trigger
 * Allows project owners to immediately refresh a specific project
 * Ignores refresh interval - always scrapes immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { updateProjectLastRefresh } from '@/lib/scraper/cron';
import { analyzeContentWithGemini } from '@/lib/gemini-client';
import { storeSignals } from '@/lib/signal-storage';
import { logTokenUsage } from '@/lib/analysis/logUsage';
import { getTavilyClient } from '@/lib/tavily-client';
import { scrapeNewsApifyFallback, scrapeNewsReadabilityFallback, scrapeReddit, scrapeTwitter } from '@/lib/apify-client';
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
  if (platform === 'twitter') {
    return 'twitter';
  }
  return 'news';
}

function buildContentHash(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
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
    let tavilyClient: ReturnType<typeof getTavilyClient> | null = null;

    try {
      tavilyClient = getTavilyClient();
    } catch (error) {
      console.error('[Project Scrape] Tavily client initialization failed:', error);
    }

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

          let items: Array<{
            content: string;
            url: string;
            wordCount: number;
            method: 'tavily' | 'apify' | 'readability';
          }> = [];

          if (source.platform === 'twitter') {
            const { items: twitterItems } = await scrapeTwitter(source.url);
            items = twitterItems.map((item) => ({
              content: item.content,
              url: item.url,
              wordCount: item.content.split(/\s+/).filter((word) => word.length > 0).length,
              method: 'apify',
            }));
          } else if (source.platform === 'reddit') {
            const { items: redditItems } = await scrapeReddit(source.url);
            items = redditItems.map((item) => ({
              content: item.content,
              url: item.url,
              wordCount: item.content.split(/\s+/).filter((word) => word.length > 0).length,
              method: 'apify',
            }));
          } else {
            let finalContent = '';
            let finalWordCount = 0;
            let finalMethod: 'tavily' | 'apify' | 'readability' | null = null;

            if (tavilyClient) {
              try {
                console.log(`[Project Scrape] Attempting Tavily for: ${source.url}`);
                const [tavilyResult] = await tavilyClient.extractNewsContent([source.url]);

                if (tavilyResult?.success) {
                  finalContent = tavilyResult.content;
                  finalWordCount = tavilyResult.wordCount;
                  finalMethod = 'tavily';
                  console.log(`[Project Scrape] ✅ Tavily succeeded: ${finalWordCount} words`);
                } else {
                  throw new Error(tavilyResult?.error || 'Tavily returned no content');
                }
              } catch (tavilyError) {
                console.log(`[Project Scrape] ⚠️ Tavily failed, trying Apify...`);
              }
            }

            if (!finalMethod) {
              const apifyResult = await scrapeNewsApifyFallback(source.url);

              if (apifyResult.success) {
                finalContent = apifyResult.content;
                finalWordCount = apifyResult.wordCount;
                finalMethod = 'apify';
                console.log(`[Project Scrape] ✅ Apify succeeded: ${finalWordCount} words`);
              } else {
                console.log(`[Project Scrape] ⚠️ Apify failed, trying Readability...`);
                const readabilityResult = await scrapeNewsReadabilityFallback(source.url);

                if (readabilityResult.success) {
                  finalContent = readabilityResult.content;
                  finalWordCount = readabilityResult.wordCount;
                  finalMethod = 'readability';
                  console.log(`[Project Scrape] ✅ Readability succeeded: ${finalWordCount} words`);
                }
              }
            }

            if (finalMethod && finalContent) {
              items = [
                {
                  content: finalContent,
                  url: source.url,
                  wordCount: finalWordCount,
                  method: finalMethod,
                },
              ];
            }
          }

          const hadItems = items.length > 0;
          if (!hadItems) {
            failed++;
            const message = `${source.name}: All scraping methods failed`;
            errors.push(message);
            console.error(`[Project Scrape] ❌ ${message}`);
          }

          let sourceSuccess = false;
          let sourceDuplicate = false;

          for (const item of items) {
            const content = item.content.trim();
            const wordCount = item.wordCount;

            if (!content) {
              continue;
            }

            if (wordCount <= 100) {
              console.error(
                `[Project Scrape] ❌ Content too short for ${item.url}: ${wordCount} words`
              );
              continue;
            }

            const contentHash = buildContentHash(content);
            const { data: existingIngestion } = await supabaseService
              .from('raw_ingestions')
              .select('id')
              .eq('content_hash', contentHash)
              .maybeSingle();

            if (existingIngestion) {
              duplicates++;
              sourceDuplicate = true;
              console.log(`[Project Scrape] ⚠️ Duplicate content detected for ${item.url}`);
              continue;
            }

            const { data: ingestion, error: ingestionError } = await supabaseService
              .from('raw_ingestions')
              .insert({
                source_id: source.id,
                project_id: projectId,
                content,
                content_hash: contentHash,
                url: item.url,
                scraped_at: new Date().toISOString(),
                word_count: wordCount,
                scraper_method: item.method,
                status: 'pending_analysis',
              })
              .select()
              .single();

            if (ingestionError || !ingestion) {
              const message = ingestionError?.message || 'Error desconocido al guardar ingestion';
              errors.push(`${source.name}: ${message}`);
              console.error(`[Project Scrape] ❌ Failed to save ingestion:`, ingestionError);
              continue;
            }

            sourceSuccess = true;
            console.log(
              `[Project Scrape] ✅ Saved ingestion: ${ingestion.id} (${item.method}, ${wordCount} words)`
            );

            try {
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
                  'gemini-1.5-flash-latest',
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
              const message =
                analysisError instanceof Error ? analysisError.message : 'Unknown analysis error';
              analysisErrors.push(`${source.name}: ${message}`);
              console.error(`[Project Scrape] ❌ AI analysis failed for ${source.url}:`, analysisError);

              await supabaseService
                .from('raw_ingestions')
                .update({
                  status: 'analysis_failed',
                  error_message: message,
                })
                .eq('id', ingestion.id);
            }
          }

          if (sourceSuccess || sourceDuplicate) {
            successful++;
            if (sourceDuplicate) {
              console.log(`[Project Scrape] ⚠️ Duplicate content for ${source.name}`);
            } else {
              console.log(`[Project Scrape] ✅ Successfully scraped ${source.name}`);
            }

            await supabaseService
              .from('sources')
              .update({ last_scraped_at: new Date().toISOString() })
              .eq('id', source.id);
          } else if (hadItems) {
            failed++;
            errors.push(`${source.name}: No content stored`);
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
