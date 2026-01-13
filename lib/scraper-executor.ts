import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import {
  scrapeTwitter,
  scrapeReddit,
  scrapeNewsApifyFallback,
  scrapeNewsReadabilityFallback,
} from '@/lib/apify-client';
import { ExtractedContent, getTavilyClient } from '@/lib/tavily-client';
import { analyzeContentWithGemini } from '@/lib/gemini-client';
import { storeSignals } from '@/lib/signal-storage';
import { logTokenUsage } from '@/lib/analysis/logUsage';

type SourceRecord = {
  id: string;
  project_id: string;
  url: string;
  source_type: string;
  is_active: boolean;
};

type ScrapeSummary = {
  scraped: number;
  new_items: number;
  duplicates: number;
};

type AnalysisSourceType = 'news' | 'twitter' | 'reddit';

type ScrapedItem = {
  content: string;
  url: string;
  wordCount: number;
  method: 'tavily' | 'apify' | 'readability';
  metadata?: Record<string, unknown>;
};

async function getSourcesToScrape(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId?: string
) {
  let query = supabase
    .from('sources')
    .select('id, project_id, url, source_type, is_active')
    .eq('is_active', true);

  if (sourceId) {
    query = query.eq('id', sourceId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load sources: ${error.message}`);
  }

  return data as SourceRecord[];
}

async function insertScraperLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId: string
) {
  const { data, error } = await supabase
    .from('scraper_logs')
    .insert({
      source_id: sourceId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Scrape] Failed to create scraper log', error);
    return null;
  }

  return data?.id as string | null;
}

async function completeScraperLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logId: string | null,
  update: {
    status: 'success' | 'failed';
    itemsFound: number;
    itemsProcessed: number;
    errorMessage?: string | null;
    durationMs: number;
  }
) {
  if (!logId) {
    return;
  }

  const { error } = await supabase.from('scraper_logs').update({
    status: update.status,
    completed_at: new Date().toISOString(),
    items_found: update.itemsFound,
    items_processed: update.itemsProcessed,
    error_message: update.errorMessage ?? null,
    execution_time_ms: update.durationMs,
  }).eq('id', logId);

  if (error) {
    console.error('[Scrape] Failed to update scraper log', error);
  }
}

async function updateSourceLastScraped(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId: string
) {
  const { error } = await supabase
    .from('sources')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', sourceId);

  if (error) {
    console.error('[Scrape] Failed to update source last_scraped_at', error);
  }
}

function buildContentHash(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function countWords(content: string) {
  return content.split(/\s+/).filter((word) => word.length > 0).length;
}

function resolveAnalysisSourceType(sourceType: string): AnalysisSourceType {
  if (sourceType === 'reddit') {
    return 'reddit';
  }
  if (sourceType === 'twitter' || sourceType === 'x_twitter') {
    return 'twitter';
  }
  return 'news';
}

async function insertRawIngestion(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sourceId: string;
  projectId: string;
  content: string;
  url: string;
  wordCount: number;
  method: 'tavily' | 'apify' | 'readability';
  metadata?: Record<string, unknown>;
}) {
  const contentHash = buildContentHash(params.content);

  const { data: existingIngestion } = await params.supabase
    .from('raw_ingestions')
    .select('id')
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (existingIngestion) {
    return { inserted: false, duplicate: true };
  }

  const { data, error } = await params.supabase
    .from('raw_ingestions')
    .insert({
      source_id: params.sourceId,
      project_id: params.projectId,
      content: params.content,
      content_hash: contentHash,
      url: params.url,
      word_count: params.wordCount,
      scraper_method: params.method,
      metadata: params.metadata ?? {},
      status: 'pending_analysis',
      scraped_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!error) {
    return { inserted: true, duplicate: false, ingestionId: data?.id as string };
  }

  if (error.code === '23505') {
    return { inserted: false, duplicate: true };
  }

  throw new Error(error.message);
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function scrapeSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: SourceRecord,
  tavilyResult?: ExtractedContent
) {
  const startTime = Date.now();
  const logId = await insertScraperLog(supabase, source.id);
  let itemsFound = 0;
  let itemsProcessed = 0;
  let duplicates = 0;
  const ingestionErrors: string[] = [];
  const analysisErrors: string[] = [];
  const fallbackErrors: string[] = [];

  try {
    console.log('[Scrape] Starting source', source.id, source.url, source.source_type);

    let items: ScrapedItem[] = [];

    if (source.source_type === 'twitter' || source.source_type === 'x_twitter') {
      const { items: twitterItems } = await scrapeTwitter(source.url);
      items = twitterItems.map((item) => ({
        content: item.content,
        url: item.url,
        wordCount: countWords(item.content),
        method: 'apify',
        metadata: item.metadata,
      }));
    } else if (source.source_type === 'reddit') {
      const { items: redditItems } = await scrapeReddit(source.url);
      items = redditItems.map((item) => ({
        content: item.content,
        url: item.url,
        wordCount: countWords(item.content),
        method: 'apify',
        metadata: item.metadata,
      }));
    } else {
      let finalContent = '';
      let finalWordCount = 0;
      let finalMethod: 'tavily' | 'apify' | 'readability' | null = null;

      if (tavilyResult?.success) {
        finalContent = tavilyResult.content;
        finalWordCount = tavilyResult.wordCount;
        finalMethod = 'tavily';
        console.log(`[Scrape] Tavily success for ${source.url} (${finalWordCount} words)`);
      } else {
        if (tavilyResult?.error) {
          fallbackErrors.push(`tavily: ${tavilyResult.error}`);
        }

        console.log(`[Scrape] Tavily failed for ${source.url}, trying Apify fallback...`);
        const apifyResult = await scrapeNewsApifyFallback(source.url);

        if (apifyResult.success) {
          finalContent = apifyResult.content;
          finalWordCount = apifyResult.wordCount;
          finalMethod = 'apify';
          console.log(`[Scrape] Apify fallback success for ${source.url} (${finalWordCount} words)`);
        } else {
          if (apifyResult.error) {
            fallbackErrors.push(`apify: ${apifyResult.error}`);
          }

          console.log(`[Scrape] Apify failed for ${source.url}, trying Readability fallback...`);
          const readabilityResult = await scrapeNewsReadabilityFallback(source.url);

          if (readabilityResult.success) {
            finalContent = readabilityResult.content;
            finalWordCount = readabilityResult.wordCount;
            finalMethod = 'readability';
            console.log(
              `[Scrape] Readability fallback success for ${source.url} (${finalWordCount} words)`
            );
          } else if (readabilityResult.error) {
            fallbackErrors.push(`readability: ${readabilityResult.error}`);
          }
        }
      }

      if (!finalMethod || !finalContent) {
        throw new Error(
          fallbackErrors.length
            ? fallbackErrors.join(' | ')
            : 'All scraping methods failed'
        );
      }

      items = [
        {
          content: finalContent,
          url: source.url,
          wordCount: finalWordCount || countWords(finalContent),
          method: finalMethod,
          metadata: {
            tavily_error: tavilyResult?.error ?? null,
          },
        },
      ];
    }

    itemsFound = items.length;

    for (const item of items) {
      const content = item.content?.trim();
      if (!content) {
        continue;
      }

      if (item.wordCount <= 100) {
        console.error(
          `[Scrape] Content too short for ${item.url || source.url}: ${item.wordCount} words`
        );
        continue;
      }

      try {
        const result = await insertRawIngestion({
          supabase,
          sourceId: source.id,
          projectId: source.project_id,
          content,
          url: item.url || source.url,
          wordCount: item.wordCount,
          method: item.method,
          metadata: item.metadata,
        });

        if (result.duplicate) {
          duplicates += 1;
          console.log('[Scrape] Duplicate content detected for source', source.id);
          continue;
        }

        if (result.inserted) {
          itemsProcessed += 1;
          const ingestionId = result.ingestionId;
          if (!ingestionId) {
            console.warn('[Scrape] Missing ingestion ID after insert, skipping analysis');
            continue;
          }

          try {
            console.log(`[Scrape] Starting AI analysis for ingestion ${ingestionId}`);
            const analysisStart = Date.now();

            const analysisResult = await analyzeContentWithGemini({
              projectId: source.project_id,
              ingestionId,
              content,
              sourceType: resolveAnalysisSourceType(source.source_type),
              sourceUrl: item.url || source.url,
            });

            const analysisDuration = Date.now() - analysisStart;
            console.log(
              `[Scrape] AI analysis complete for ${ingestionId}: ${analysisResult.signals.length} signals in ${analysisDuration}ms`
            );

            await storeSignals({
              projectId: source.project_id,
              ingestionId,
              sourceId: source.id,
              sourceUrl: item.url || source.url,
              signals: analysisResult.signals,
            });

            const { error: statusError } = await supabase
              .from('raw_ingestions')
              .update({
                status: 'analyzed',
                analyzed_at: new Date().toISOString(),
                error_message: null,
              })
              .eq('id', ingestionId);

            if (statusError) {
              console.error('[Scrape] Failed to update ingestion status', statusError);
            } else {
              console.log(`[Scrape] Updated ingestion ${ingestionId} status to analyzed`);
            }

            try {
              await logTokenUsage(
                source.project_id,
                'ingestion_analysis',
                'gemini-1.5-flash',
                analysisResult.promptTokens,
                analysisResult.completionTokens,
                {
                  ingestion_id: ingestionId,
                  signals_detected: analysisResult.signals.length,
                  duration_ms: analysisDuration,
                  source_url: item.url || source.url,
                }
              );
            } catch (usageError) {
              console.error('[Scrape] Failed to log token usage', usageError);
            }
          } catch (analysisError) {
            const message = analysisError instanceof Error ? analysisError.message : 'Unknown analysis error';
            analysisErrors.push(message);
            console.error(`[Scrape] AI analysis failed for ${ingestionId}`, analysisError);

            await supabase
              .from('raw_ingestions')
              .update({
                status: 'analysis_failed',
                error_message: message,
              })
              .eq('id', ingestionId);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown insert error';
        ingestionErrors.push(message);
        console.error('[Scrape] Failed to insert raw ingestion', error);
      }
    }

    await updateSourceLastScraped(supabase, source.id);
    await completeScraperLog(supabase, logId, {
      status: 'success',
      itemsFound,
      itemsProcessed,
      durationMs: Date.now() - startTime,
      errorMessage:
        ingestionErrors.length || analysisErrors.length
          ? [...ingestionErrors, ...analysisErrors].join(' | ')
          : null,
    });

    return {
      itemsFound,
      itemsProcessed,
      duplicates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Scrape] Source scrape failed', message);

    await completeScraperLog(supabase, logId, {
      status: 'failed',
      itemsFound,
      itemsProcessed,
      durationMs: Date.now() - startTime,
      errorMessage: message,
    });

    return {
      itemsFound,
      itemsProcessed,
      duplicates,
      error: message,
    };
  }
}

export async function executeScrape(sourceId?: string): Promise<ScrapeSummary> {
  const supabase = await createClient();
  const sources = await getSourcesToScrape(supabase, sourceId);

  if (!sources.length) {
    return { scraped: 0, new_items: 0, duplicates: 0 };
  }

  let scraped = 0;
  let newItems = 0;
  let duplicates = 0;

  const twitterSources = sources.filter(
    (source) => source.source_type === 'twitter' || source.source_type === 'x_twitter'
  );
  const redditSources = sources.filter((source) => source.source_type === 'reddit');
  const newsSources = sources.filter(
    (source) =>
      source.source_type !== 'twitter' &&
      source.source_type !== 'x_twitter' &&
      source.source_type !== 'reddit'
  );

  for (const source of twitterSources) {
    const result = await scrapeSource(supabase, source);
    scraped += 1;
    newItems += result.itemsProcessed;
    duplicates += result.duplicates;
  }

  for (const source of redditSources) {
    const result = await scrapeSource(supabase, source);
    scraped += 1;
    newItems += result.itemsProcessed;
    duplicates += result.duplicates;
  }

  if (newsSources.length > 0) {
    console.log(`[Scrape] Processing ${newsSources.length} news sources with Tavily batches...`);
    let tavilyClient: ReturnType<typeof getTavilyClient> | null = null;

    try {
      tavilyClient = getTavilyClient();
    } catch (error) {
      console.error('[Scrape] Tavily client initialization failed:', error);
    }
    const batches = chunkArray(newsSources, 20);

    for (const batch of batches) {
      const urls = batch.map((source) => source.url);
      let tavilyResults: ExtractedContent[] = [];

      try {
        if (!tavilyClient) {
          throw new Error('Tavily client not available');
        }

        tavilyResults = await tavilyClient.extractNewsContent(urls);
      } catch (error) {
        console.error('[Scrape] Tavily batch extraction failed:', error);
        tavilyResults = urls.map((url) => ({
          url,
          content: '',
          wordCount: 0,
          success: false,
          method: 'tavily',
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }

      for (const source of batch) {
        const tavilyResult = tavilyResults.find((result) => result.url === source.url) ?? {
          url: source.url,
          content: '',
          wordCount: 0,
          success: false,
          method: 'tavily',
          error: 'No Tavily result',
        };
        const result = await scrapeSource(supabase, source, tavilyResult);
        scraped += 1;
        newItems += result.itemsProcessed;
        duplicates += result.duplicates;
      }
    }
  }

  return { scraped, new_items: newItems, duplicates };
}
