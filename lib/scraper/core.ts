import puppeteer, { Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { ScraperResult, ScraperOptions, ScrapedContent } from './types';
import { cleanText, extractDomain } from './utils';
import { detectPlatform, getPlatformConfig } from './platforms';
import {
  waitForDynamicContent,
  scrollPage,
  extractPlatformContent,
  getFoundSelectors,
} from './dynamic-handler';
import { scrapeRedditJson, scrapeWithReadability } from './fast-path';
import { parseRSSFeedXml, isRSSFeed } from './rss-parser';

/**
 * Default scraper options
 */
const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  timeout: 30000,
  waitForSelector: 'body',
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const MIN_WORD_COUNT = 80;

const shouldEnforceMinimumWordCount = (platform: string) =>
  platform === 'news' || platform === 'rss' || platform === 'generic';

const isHtmlResponse = (contentType: string | null, body: string) => {
  if (contentType && contentType.toLowerCase().includes('text/html')) {
    return true;
  }
  const lowerBody = body.trim().slice(0, 500).toLowerCase();
  return lowerBody.startsWith('<!doctype html') || lowerBody.startsWith('<html');
};

const sanitizeRssXml = (rawXml: string) => {
  const cleaned = rawXml.replace(
    /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi,
    '&amp;'
  );

  return cleaned.replace(/<(?![/?a-zA-Z!])/g, '&lt;');
};

/**
 * Scrape content from a URL using Puppeteer
 *
 * @param url - Target URL to scrape
 * @param options - Optional configuration for the scraper
 * @returns Promise resolving to ScraperResult with content or error
 *
 * @example
 * const result = await scrapeUrl("https://example.com");
 * if (result.success) {
 *   console.log(result.content.text);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function scrapeUrl(
  url: string,
  options?: ScraperOptions
): Promise<ScraperResult> {
  const startTime = Date.now();
  let browser: any = null;
  let fastPathAttempted = false;
  let scrapingMethod = 'puppeteer';

  // Merge options with defaults
  const config: Required<ScraperOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  try {
    // Validate URL
    new URL(url);

    if (isRSSFeed(url)) {
      console.log('[Scraper] Detected RSS feed URL, attempting XML fetch');
      try {
        const controller = new AbortController();
        const feedTimeout = Math.min(config.timeout, 15000);
        const timeoutId = setTimeout(() => controller.abort(), feedTimeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': config.userAgent,
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Feed fetch failed with status ${response.status}`);
        }

        const rawXml = await response.text();

        if (isHtmlResponse(response.headers.get('content-type'), rawXml)) {
          throw new Error('Feed returned HTML content');
        }

        const sanitizedXml = sanitizeRssXml(rawXml);
        const rssResult = await parseRSSFeedXml(sanitizedXml, url);

        if (rssResult.success && rssResult.articles.length > 0) {
          const combinedContent = rssResult.articles.map((article, index) => {
            return `
Article ${index + 1}: ${article.title}
Published: ${article.pubDate}
Link: ${article.link}
Content: ${article.description || article.content}

---
`;
          }).join('\n');

          const wordCount = combinedContent.split(/\s+/).filter(word => word.length > 0).length;

          if (shouldEnforceMinimumWordCount('rss') && wordCount < MIN_WORD_COUNT) {
            console.warn('[Scraper] RSS content below minimum word count, marking as failed');
            return {
              success: false,
              url,
              timestamp: new Date(),
              error: `Content too short (${wordCount} words)`,
              metadata: {
                domain: extractDomain(url),
                duration: Date.now() - startTime,
                platform: 'rss',
                extractionMethod: 'rss-parser',
              },
            };
          }

          console.log('[Scraper] ✅ RSS feed parsed successfully');
          console.log('[Scraper] Total content length:', combinedContent.length);

          return {
            success: true,
            content: {
              text: combinedContent,
              title: rssResult.feedTitle,
              url,
              scrapedAt: new Date(),
              wordCount,
              metadata: {
                articleCount: rssResult.articles.length,
                articles: rssResult.articles.map(article => ({
                  title: article.title,
                  link: article.link,
                  pubDate: article.pubDate,
                })),
              },
            },
            url,
            timestamp: new Date(),
            metadata: {
              domain: extractDomain(url),
              duration: Date.now() - startTime,
              platform: 'rss',
              extractionMethod: 'rss-parser',
            },
          };
        }

        console.warn('[Scraper] RSS feed parsed with no articles, falling back to Puppeteer');
      } catch (rssError) {
        console.warn('[Scraper] RSS feed fetch/parse failed, falling back to Puppeteer', rssError);
      }
    }

    // Detect platform from URL
    const platform = detectPlatform(url);
    console.log(`[Scraper] Detected platform: ${platform} for URL: ${url}`);

    // ===== PHASE 1: Try Fast Path First (except for Twitter) =====
    if (platform === 'reddit') {
      console.log(`[Scraper] Attempting Reddit JSON fast path for: ${url}`);
      const fastResult = await scrapeRedditJson(url);
      fastPathAttempted = true;

      if (fastResult.success && fastResult.content.length > 0) {
        scrapingMethod = fastResult.method;
        const wordCount = fastResult.content.split(/\s+/).filter(word => word.length > 0).length;

        if (shouldEnforceMinimumWordCount(platform) && wordCount < MIN_WORD_COUNT) {
          console.warn('[Scraper] Fast path content below minimum word count, marking as failed');
          return {
            success: false,
            url,
            timestamp: new Date(),
            error: `Content too short (${wordCount} words)`,
            metadata: {
              domain: extractDomain(url),
              duration: Date.now() - startTime,
              platform,
              extractionMethod: 'fast-path',
            },
          };
        }

        console.log(`[Scraper] ✅ Fast path succeeded in ${Date.now() - startTime}ms`);

        return {
          success: true,
          content: {
            text: fastResult.content,
            title: 'Reddit Content', // Reddit JSON doesn't have a single title for listings
            url,
            scrapedAt: new Date(),
            wordCount,
          },
          url,
          timestamp: new Date(),
          metadata: {
            domain: extractDomain(url),
            duration: Date.now() - startTime,
            platform,
            extractionMethod: 'fast-path',
          },
        };
      } else {
        console.log(`[Scraper] ⚠️ Fast path failed: ${fastResult.error}, falling back to Puppeteer`);
      }
    } else if (platform === 'news' || platform === 'generic') {
      console.log(`[Scraper] Attempting Readability fast path for: ${url}`);
      const fastResult = await scrapeWithReadability(url);
      fastPathAttempted = true;

      if (fastResult.success && fastResult.content.length > 0) {
        scrapingMethod = fastResult.method;
        const wordCount = fastResult.content.split(/\s+/).filter(word => word.length > 0).length;

        if (shouldEnforceMinimumWordCount(platform) && wordCount < MIN_WORD_COUNT) {
          console.warn('[Scraper] Fast path content below minimum word count, marking as failed');
          return {
            success: false,
            url,
            timestamp: new Date(),
            error: `Content too short (${wordCount} words)`,
            metadata: {
              domain: extractDomain(url),
              duration: Date.now() - startTime,
              platform,
              extractionMethod: 'fast-path',
            },
          };
        }

        console.log(`[Scraper] ✅ Fast path succeeded in ${Date.now() - startTime}ms`);

        return {
          success: true,
          content: {
            text: fastResult.content,
            title: 'Article Content',
            url,
            scrapedAt: new Date(),
            wordCount,
          },
          url,
          timestamp: new Date(),
          metadata: {
            domain: extractDomain(url),
            duration: Date.now() - startTime,
            platform,
            extractionMethod: 'fast-path',
          },
        };
      } else {
        console.log(`[Scraper] ⚠️ Fast path failed: ${fastResult.error}, falling back to Puppeteer`);
      }
    }

    // ===== PHASE 2: Puppeteer Fallback =====
    console.log(`[Scraper] Using Puppeteer for: ${url}`);

    // Detect environment: production (Vercel) or local development
    const isProduction = process.env.NODE_ENV === 'production';

    // Launch browser with proven configuration
    try {
      console.log('[SCRAPER] Environment:', process.env.NODE_ENV);
      console.log('[SCRAPER] Starting Puppeteer launch...');

      if (isProduction) {
        // Vercel production - proven working config
        browser = await puppeteer.launch({
          args: [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(
            'https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar'
          ),
          headless: chromium.headless,
        });
      } else {
        // Local development
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox'],
        });
      }

      console.log('[SCRAPER] ✅ Browser launched successfully');
    } catch (launchError) {
      const message = launchError instanceof Error ? launchError.message : String(launchError);
      console.error('[SCRAPER] ❌ Launch failed:', launchError);
      throw new Error(`Browser launch failed: ${message}`);
    }

    // Create new page
    const page: Page = await browser.newPage();

    // Set default navigation timeout to prevent infinite hangs
    page.setDefaultNavigationTimeout(60000);

    // Set user agent
    await page.setUserAgent(config.userAgent);

    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    // Navigate to URL with faster wait strategy
    await page.goto(url, {
      timeout: 60000,
      waitUntil: 'domcontentloaded', // Faster than networkidle2
    });

    const platformConfig = getPlatformConfig(platform);

    // Wait for dynamic content to load
    const selectorsFound = await waitForDynamicContent(page, platformConfig);

    // Scroll page if configured (for lazy loading)
    let scrolled = false;
    if (platformConfig.scrollCount > 0) {
      await scrollPage(page, platformConfig);
      scrolled = true;
    }

    // Extract page title
    const title = await page.title();

    // Try platform-specific extraction first
    let text = await extractPlatformContent(page, platformConfig);
    let extractionMethod: 'platform-specific' | 'fallback' = 'platform-specific';

    // Fall back to generic extraction if platform-specific failed
    if (!text || text.length === 0) {
      console.warn('[Scraper] Platform-specific extraction failed, using fallback');
      extractionMethod = 'fallback';

      text = await page.evaluate(() => {
        // Try to find article element first
        const article = document.querySelector('article');
        if (article) {
          return article.innerText;
        }

        // Try to find main element
        const main = document.querySelector('main');
        if (main) {
          return main.innerText;
        }

        // Fall back to body
        const body = document.querySelector('body');
        return body ? body.innerText : '';
      });

      text = cleanText(text);
    }

    // Get list of selectors that were found
    const foundSelectors = await getFoundSelectors(page, platformConfig);

    // Calculate word count
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    if (shouldEnforceMinimumWordCount(platform) && wordCount < MIN_WORD_COUNT) {
      console.warn('[Scraper] Puppeteer content below minimum word count, marking as failed');
      return {
        success: false,
        url,
        timestamp: new Date(),
        error: `Content too short (${wordCount} words)`,
        metadata: {
          domain: extractDomain(url),
          duration: Date.now() - startTime,
          platform,
          selectorsFound: foundSelectors,
          scrolled,
          extractionMethod,
        },
      };
    }

    // Prepare scraped content
    const content: ScrapedContent = {
      text,
      title,
      url,
      scrapedAt: new Date(),
      wordCount,
    };

    // Calculate duration
    const duration = Date.now() - startTime;

    console.log(`[Scraper] ✅ Puppeteer succeeded in ${duration}ms`);

    // Return success result with platform metadata
    return {
      success: true,
      content,
      url,
      timestamp: new Date(),
      metadata: {
        domain: extractDomain(url),
        duration,
        platform,
        selectorsFound: foundSelectors,
        scrolled,
        extractionMethod,
      },
    };
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Log error to console with context
    console.error('[Scraper Error]', {
      url,
      domain: extractDomain(url),
      error: errorMessage,
      timestamp: new Date().toISOString(),
      fastPathAttempted,
      scrapingMethod,
    });

    return {
      success: false,
      url,
      timestamp: new Date(),
      error: errorMessage,
      metadata: {
        domain: extractDomain(url),
        duration: Date.now() - startTime,
      },
    };
  } finally {
    // Always close browser
    if (browser) {
      await browser.close();
    }
  }
}
