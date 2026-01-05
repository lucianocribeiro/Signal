import puppeteer, { Page } from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
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

/**
 * Default scraper options
 */
const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  timeout: 30000,
  waitForSelector: 'body',
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

    // Launch browser with appropriate configuration
    try {
      const executablePath = isProduction
        ? await chromium.executablePath('/tmp/chromium')
        : puppeteer.executablePath();

      console.log('[SCRAPER] Launching browser with executable:', executablePath);

      if (isProduction) {
        // Vercel production: use puppeteer-core with full @sparticuz/chromium
        browser = await puppeteerCore.launch({
          args: [
            ...chromium.args,
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--single-process', // Critical for Vercel serverless
            '--no-zygote',
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        }) as any;
      } else {
        // Local development: use standard puppeteer
        browser = await puppeteer.launch({
          headless: config.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        });
      }

      console.log('[SCRAPER] ✅ Browser launched successfully');
    } catch (launchError) {
      const message = launchError instanceof Error ? launchError.message : String(launchError);
      console.error('[SCRAPER] ❌ Failed to launch browser:', launchError);
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

    // Calculate word count
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    // Get list of selectors that were found
    const foundSelectors = await getFoundSelectors(page, platformConfig);

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
