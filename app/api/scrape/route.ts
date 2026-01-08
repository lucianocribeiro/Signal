import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { scrapeTwitter, scrapeReddit, scrapeNews } from '@/lib/apify-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

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

function getAuthError(request: NextRequest) {
  const secret = process.env.SCRAPER_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret) {
    return 'SCRAPER_SECRET is not configured';
  }

  if (authHeader !== `Bearer ${secret}`) {
    return 'Unauthorized';
  }

  return null;
}

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

async function insertRawIngestion(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sourceId: string;
  projectId: string;
  content: string;
  url: string;
  metadata: Record<string, unknown>;
}) {
  const contentHash = buildContentHash(params.content);

  const { error } = await supabase.from('raw_ingestions').insert({
    source_id: params.sourceId,
    project_id: params.projectId,
    content: params.content,
    content_hash: contentHash,
    url: params.url,
    metadata: params.metadata,
  });

  if (!error) {
    return { inserted: true, duplicate: false };
  }

  if (error.code === '23505') {
    return { inserted: false, duplicate: true };
  }

  throw new Error(error.message);
}

async function scrapeSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: SourceRecord
) {
  const startTime = Date.now();
  const logId = await insertScraperLog(supabase, source.id);
  let itemsFound = 0;
  let itemsProcessed = 0;
  let duplicates = 0;
  const ingestionErrors: string[] = [];

  try {
    console.log('[Scrape] Starting source', source.id, source.url, source.source_type);

    let items: { content: string; url: string; metadata: Record<string, unknown> }[] = [];

    if (source.source_type === 'twitter') {
      ({ items } = await scrapeTwitter(source.url));
    } else if (source.source_type === 'reddit') {
      ({ items } = await scrapeReddit(source.url));
    } else {
      ({ items } = await scrapeNews(source.url));
    }

    itemsFound = items.length;

    for (const item of items) {
      const content = item.content?.trim();
      if (!content) {
        continue;
      }

      try {
        const result = await insertRawIngestion({
          supabase,
          sourceId: source.id,
          projectId: source.project_id,
          content,
          url: item.url || source.url,
          metadata: item.metadata ?? {},
        });

        if (result.duplicate) {
          duplicates += 1;
          console.log('[Scrape] Duplicate content detected for source', source.id);
          continue;
        }

        if (result.inserted) {
          itemsProcessed += 1;
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
      errorMessage: ingestionErrors.length ? ingestionErrors.join(' | ') : null,
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

  for (const source of sources) {
    const result = await scrapeSource(supabase, source);
    scraped += 1;
    newItems += result.itemsProcessed;
    duplicates += result.duplicates;
  }

  return { scraped, new_items: newItems, duplicates };
}

export async function POST(request: NextRequest) {
  const authError = getAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  let sourceId: string | undefined;

  try {
    const body = await request.json();
    sourceId = body?.source_id;
  } catch (error) {
    console.warn('[Scrape] No JSON body provided, defaulting to all sources');
  }

  const summary = await executeScrape(sourceId);
  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  const authError = getAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('source_id') ?? undefined;
  const summary = await executeScrape(sourceId);

  return NextResponse.json(summary);
}
