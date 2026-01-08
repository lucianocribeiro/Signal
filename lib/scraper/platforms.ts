/**
 * Platform Detection and Configuration
 * Handles platform-specific scraping configurations for Twitter/X, Reddit, and generic sites
 */

import { Platform, PlatformConfig } from './types';

/**
 * Platform-specific scraping configurations
 */
const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  twitter: {
    name: 'twitter',
    selectors: [
      'article[data-testid="tweet"]',
      'div[data-testid="tweetText"]',
      '[data-testid="primaryColumn"]',
    ],
    contentSelectors: [
      'div[data-testid="tweetText"]',
      'article[data-testid="tweet"]',
    ],
    scrollCount: 1,
    scrollDelay: 1000,
    waitTimeout: 10000,
  },

  reddit: {
    name: 'reddit',
    selectors: [
      'shreddit-post',
      '[data-test-id="post-content"]',
      '.Post',
      'div[data-click-id="body"]',
    ],
    contentSelectors: [
      '[slot="title"]',
      '[slot="text-body"]',
      '.Post h1',
      '.Post .RichTextJSON-root',
      '[data-click-id="body"]',
    ],
    scrollCount: 1,
    scrollDelay: 1000,
    waitTimeout: 10000,
  },

  news: {
    name: 'news',
    selectors: [
      'main article',
      'main .nota',
      'main .nota__body',
      'main .nota__content',
      'main .nota__contenido',
      'main .cuerpo-nota',
      'main .story-list',
      'main .home__list',
      'main .article-body',
      'main .article__body',
      'main .article__content',
      'main .article-content',
      'main .entry-content',
      'main .content',
      'main',
      '#content article',
      '#content',
      '.article-body',
      '.post-content',
    ],
    contentSelectors: [
      'main article',
      'main .nota',
      'main .nota__body',
      'main .nota__content',
      'main .nota__contenido',
      'main .cuerpo-nota',
      'main .story-list',
      'main .home__list',
      'main .article-body',
      'main .article__body',
      'main .article__content',
      'main .article-content',
      'main .entry-content',
      'main .content',
      'main',
      '#content article',
      '#content',
      '.article-body',
      '.post-content',
    ],
    scrollCount: 0,
    scrollDelay: 0,
    waitTimeout: 5000,
  },

  generic: {
    name: 'generic',
    selectors: [
      'body',
    ],
    contentSelectors: [
      'article',
      'main',
      'body',
    ],
    scrollCount: 0,
    scrollDelay: 0,
    waitTimeout: 5000,
  },

  rss: {
    name: 'rss',
    selectors: [
      'body',
    ],
    contentSelectors: [
      'body',
    ],
    scrollCount: 0,
    scrollDelay: 0,
    waitTimeout: 5000,
  },
};

/**
 * Detect platform from URL domain
 *
 * @param url - URL to analyze
 * @returns Detected platform type
 *
 * @example
 * detectPlatform("https://x.com/user/status/123") // Returns "twitter"
 * detectPlatform("https://www.reddit.com/r/technology") // Returns "reddit"
 * detectPlatform("https://www.bbc.com/news") // Returns "news"
 * detectPlatform("https://example.com") // Returns "generic"
 */
export function detectPlatform(url: string): Platform {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    // Remove www. prefix for easier matching
    const domain = hostname.replace(/^www\./, '');

    // Feed detection (RSS/Atom/XML)
    if (pathname.endsWith('.xml') || pathname.endsWith('.rss') || url.toLowerCase().includes('/feed/')) {
      return 'news';
    }

    // Twitter/X detection
    if (domain === 'x.com' || domain === 'twitter.com') {
      return 'twitter';
    }

    // Reddit detection
    if (domain === 'reddit.com' || domain.endsWith('.reddit.com')) {
      return 'reddit';
    }

    // News site detection (common news domains)
    const newsDomains = [
      'bbc.com',
      'bbc.co.uk',
      'cnn.com',
      'nytimes.com',
      'theguardian.com',
      'washingtonpost.com',
      'reuters.com',
      'bloomberg.com',
      'apnews.com',
      'forbes.com',
      'wsj.com',
      'ft.com',
    ];

    if (newsDomains.some(newsDomain => domain === newsDomain || domain.endsWith(`.${newsDomain}`))) {
      return 'news';
    }

    // Default to generic
    return 'generic';
  } catch (error) {
    // If URL parsing fails, return generic
    return 'generic';
  }
}

/**
 * Get platform configuration for a specific platform
 *
 * @param platform - Platform type
 * @returns Platform configuration
 *
 * @example
 * const config = getPlatformConfig('twitter');
 * console.log(config.selectors); // ['article[data-testid="tweet"]', ...]
 */
export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

/**
 * Get platform configuration for a URL (convenience function)
 *
 * @param url - URL to analyze
 * @returns Platform configuration
 *
 * @example
 * const config = getPlatformConfigForUrl("https://x.com/user/status/123");
 * console.log(config.name); // "twitter"
 */
export function getPlatformConfigForUrl(url: string): PlatformConfig {
  const platform = detectPlatform(url);
  return getPlatformConfig(platform);
}
