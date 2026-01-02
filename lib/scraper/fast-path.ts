import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface FastPathResult {
  content: string;
  success: boolean;
  method: 'reddit-json' | 'readability' | 'failed';
  error?: string;
}

/**
 * Fast path for Reddit - use JSON endpoint
 */
export async function scrapeRedditJson(url: string): Promise<FastPathResult> {
  try {
    // Convert Reddit URL to JSON endpoint
    const jsonUrl = url.replace(/\/$/, '') + '.json';

    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalBot/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Extract text from Reddit JSON structure
    let content = '';

    if (Array.isArray(data) && data[0]?.data?.children) {
      // Post with comments
      const post = data[0].data.children[0]?.data;
      if (post) {
        content += `Title: ${post.title}\n\n`;
        if (post.selftext) {
          content += `${post.selftext}\n\n`;
        }

        // Add top 10 comments
        if (data[1]?.data?.children) {
          content += 'Top Comments:\n';
          data[1].data.children.slice(0, 10).forEach((comment: any) => {
            if (comment.data?.body) {
              content += `- ${comment.data.body}\n`;
            }
          });
        }
      }
    } else if (data?.data?.children) {
      // Subreddit listing
      data.data.children.slice(0, 20).forEach((post: any) => {
        if (post.data) {
          content += `${post.data.title}\n`;
          if (post.data.selftext) {
            content += `${post.data.selftext.substring(0, 200)}...\n`;
          }
          content += '\n';
        }
      });
    }

    return {
      content: content.trim(),
      success: true,
      method: 'reddit-json',
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      method: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fast path for news sites - use Readability
 */
export async function scrapeWithReadability(url: string): Promise<FastPathResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Configure JSDOM to suppress CSS parsing errors
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => {
      // Suppress JSDOM errors (e.g., CSS parsing)
    });
    virtualConsole.on('warn', () => {
      // Suppress JSDOM warnings
    });

    const dom = new JSDOM(html, {
      url,
      resources: 'usable',
      pretendToBeVisual: false,
      virtualConsole
    });

    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      throw new Error('Readability could not extract content');
    }

    return {
      content: article.textContent.trim(),
      success: true,
      method: 'readability',
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      method: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
