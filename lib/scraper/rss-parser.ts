import Parser from 'rss-parser';

interface RSSArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content?: string;
}

export async function parseRSSFeed(url: string): Promise<{
  success: boolean;
  articles: RSSArticle[];
  feedTitle: string;
  error?: string;
}> {
  try {
    console.log('[RSS Parser] Parsing feed:', url);

    const parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalBot/1.0)',
      },
    });

    const feed = await parser.parseURL(url);

    console.log('[RSS Parser] Feed title:', feed.title);
    console.log('[RSS Parser] Found items:', feed.items?.length || 0);

    if (!feed.items || feed.items.length === 0) {
      return {
        success: false,
        articles: [],
        feedTitle: feed.title || 'Unknown',
        error: 'No articles found in feed',
      };
    }

    const articles: RSSArticle[] = feed.items.slice(0, 20).map((item) => ({
      title: item.title || 'Untitled',
      link: item.link || url,
      description: item.contentSnippet || item.content || item.description || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      content: item.content || item.contentSnippet || item.description || '',
    }));

    console.log('[RSS Parser] ✅ Successfully parsed', articles.length, 'articles');

    return {
      success: true,
      articles,
      feedTitle: feed.title || 'RSS Feed',
    };
  } catch (error) {
    console.error('[RSS Parser] ❌ Error parsing feed:', error);
    return {
      success: false,
      articles: [],
      feedTitle: 'Unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function isRSSFeed(url: string): boolean {
  const rssIndicators = [
    '/feed',
    '/rss',
    '/atom',
    '.xml',
    'feed.xml',
    'rss.xml',
  ];

  const lowerUrl = url.toLowerCase();
  return rssIndicators.some((indicator) => lowerUrl.includes(indicator));
}
