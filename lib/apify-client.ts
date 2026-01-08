import { ApifyClient } from 'apify-client';

export type ApifyScrapeItem = {
  content: string;
  url: string;
  metadata: Record<string, unknown>;
};

export type ApifyScrapeResult = {
  items: ApifyScrapeItem[];
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function getClient() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error('Missing APIFY_API_TOKEN environment variable');
  }

  return new ApifyClient({ token });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const anyError = error as { statusCode?: number; message?: string };
  if (anyError.statusCode && [429, 500, 502, 503, 504].includes(anyError.statusCode)) {
    return true;
  }

  const message = anyError.message?.toLowerCase() ?? '';
  return message.includes('rate limit') || message.includes('too many requests');
}

async function callActorWithRetry<TInput>(
  actorId: string,
  input: TInput,
  attempt = 1
) {
  try {
    const client = getClient();
    const run = await client.actor(actorId).call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as Record<string, unknown>[];
  } catch (error) {
    if (attempt >= MAX_RETRIES || !isRetryableError(error)) {
      console.error('[Apify] Actor failed:', actorId, error);
      throw error;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    console.warn(`[Apify] Retry ${attempt}/${MAX_RETRIES} for ${actorId} after ${delay}ms`);
    await sleep(delay);
    return callActorWithRetry(actorId, input, attempt + 1);
  }
}

function normalizeTwitterItem(item: Record<string, unknown>): ApifyScrapeItem | null {
  const text = (item.text || item.fullText || item.content) as string | undefined;
  const url = (item.url || item.tweetUrl || item.link) as string | undefined;

  if (!text || !url) {
    return null;
  }

  return {
    content: text,
    url,
    metadata: item,
  };
}

function normalizeRedditItem(item: Record<string, unknown>): ApifyScrapeItem | null {
  const title = (item.title || item.headline) as string | undefined;
  const body = (item.body || item.selftext || item.content) as string | undefined;
  const url = (item.url || item.permalink || item.link) as string | undefined;

  const combined = [title, body].filter(Boolean).join('\n');

  if (!combined || !url) {
    return null;
  }

  return {
    content: combined,
    url,
    metadata: item,
  };
}

function normalizeNewsItem(item: Record<string, unknown>): ApifyScrapeItem | null {
  const text = (item.text || item.content || item.pageText || item.articleText) as
    | string
    | undefined;
  const url = (item.url || item.link || item.pageUrl) as string | undefined;

  if (!text || !url) {
    return null;
  }

  return {
    content: text,
    url,
    metadata: item,
  };
}

function getTwitterInput(url: string) {
  const parsed = new URL(url);
  const searchTerm = parsed.searchParams.get('q');

  if (searchTerm) {
    return {
      searchTerms: [searchTerm],
      maxTweets: 20,
    };
  }

  return {
    startUrls: [{ url }],
    maxTweets: 20,
  };
}

export async function scrapeTwitter(url: string): Promise<ApifyScrapeResult> {
  console.log('[Apify] Scraping Twitter:', url);

  const items = await callActorWithRetry('apify/twitter-scraper', getTwitterInput(url));
  const normalized = items
    .map(normalizeTwitterItem)
    .filter((item): item is ApifyScrapeItem => Boolean(item));

  return { items: normalized.slice(0, 20) };
}

export async function scrapeReddit(url: string): Promise<ApifyScrapeResult> {
  console.log('[Apify] Scraping Reddit:', url);

  const items = await callActorWithRetry('apify/reddit-scraper', {
    startUrls: [{ url }],
    maxPosts: 50,
  });

  const normalized = items
    .map(normalizeRedditItem)
    .filter((item): item is ApifyScrapeItem => Boolean(item));

  return { items: normalized.slice(0, 50) };
}

export async function scrapeNews(url: string): Promise<ApifyScrapeResult> {
  console.log('[Apify] Scraping News:', url);

  const pageFunction = `async function pageFunction(context) {
    return {
      url: context.request.url,
      title: context.jQuery('title').text(),
      content: context.jQuery('body').text().slice(0, 5000)
    };
  }`;

  const items = await callActorWithRetry('apify/web-scraper', {
    startUrls: [{ url }],
    pageFunction,
  });

  const normalized = items
    .map(normalizeNewsItem)
    .filter((item): item is ApifyScrapeItem => Boolean(item));

  return { items: normalized };
}
