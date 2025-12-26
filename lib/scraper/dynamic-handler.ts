/**
 * Dynamic Content Handler
 * Handles waiting for dynamic content, scrolling, and platform-specific extraction
 */

import { Page } from 'puppeteer';
import { PlatformConfig } from './types';
import { cleanText, delay } from './utils';

/**
 * Wait for dynamic content to load by checking for platform-specific selectors
 *
 * @param page - Puppeteer page instance
 * @param config - Platform configuration
 * @returns Promise resolving to true if selectors found, false if timeout
 *
 * @example
 * const found = await waitForDynamicContent(page, twitterConfig);
 * if (found) {
 *   console.log("Dynamic content loaded");
 * }
 */
export async function waitForDynamicContent(
  page: Page,
  config: PlatformConfig
): Promise<boolean> {
  // Try each selector in order
  for (const selector of config.selectors) {
    try {
      await page.waitForSelector(selector, {
        timeout: config.waitTimeout,
      });
      console.log(`[Dynamic Handler] Found selector: ${selector}`);
      return true;
    } catch (error) {
      // Selector not found, try next one
      continue;
    }
  }

  // No selectors found within timeout
  console.warn(
    `[Dynamic Handler] No selectors found for platform: ${config.name}`
  );
  return false;
}

/**
 * Scroll the page down to trigger lazy loading
 *
 * @param page - Puppeteer page instance
 * @param config - Platform configuration
 * @returns Promise that resolves when scrolling is complete
 *
 * @example
 * await scrollPage(page, twitterConfig);
 */
export async function scrollPage(
  page: Page,
  config: PlatformConfig
): Promise<void> {
  if (config.scrollCount === 0) {
    return;
  }

  try {
    for (let i = 0; i < config.scrollCount; i++) {
      // Scroll down by viewport height
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });

      console.log(
        `[Dynamic Handler] Scrolled ${i + 1}/${config.scrollCount} for ${config.name}`
      );

      // Wait for content to load after scroll
      await delay(config.scrollDelay);
    }
  } catch (error) {
    console.warn('[Dynamic Handler] Scroll failed:', error);
    // Don't throw - continue with extraction anyway
  }
}

/**
 * Extract content using platform-specific selectors
 *
 * @param page - Puppeteer page instance
 * @param config - Platform configuration
 * @returns Promise resolving to extracted text content
 *
 * @example
 * const content = await extractPlatformContent(page, twitterConfig);
 * console.log(content); // "Tweet text here..."
 */
export async function extractPlatformContent(
  page: Page,
  config: PlatformConfig
): Promise<string> {
  // Try each content selector in order
  for (const selector of config.contentSelectors) {
    try {
      const text = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);

        if (elements.length === 0) {
          return null;
        }

        // For multiple elements (e.g., multiple tweets), join them
        if (elements.length > 1) {
          const texts = Array.from(elements)
            .map((el) => el.textContent?.trim())
            .filter((text) => text && text.length > 0);
          return texts.join('\n\n');
        }

        // Single element
        return elements[0].textContent?.trim() || null;
      }, selector);

      if (text && text.length > 0) {
        console.log(
          `[Dynamic Handler] Extracted ${text.length} chars using selector: ${selector}`
        );
        return cleanText(text);
      }
    } catch (error) {
      // Selector failed, try next one
      continue;
    }
  }

  // No content extracted with platform-specific selectors
  console.warn(
    `[Dynamic Handler] No content extracted for platform: ${config.name}`
  );
  return '';
}

/**
 * Get list of selectors that were found on the page
 *
 * @param page - Puppeteer page instance
 * @param config - Platform configuration
 * @returns Promise resolving to array of found selector strings
 *
 * @example
 * const found = await getFoundSelectors(page, twitterConfig);
 * console.log(found); // ['div[data-testid="tweetText"]']
 */
export async function getFoundSelectors(
  page: Page,
  config: PlatformConfig
): Promise<string[]> {
  const foundSelectors: string[] = [];

  for (const selector of config.selectors) {
    try {
      const exists = await page.evaluate((sel) => {
        return document.querySelector(sel) !== null;
      }, selector);

      if (exists) {
        foundSelectors.push(selector);
      }
    } catch (error) {
      // Ignore errors
      continue;
    }
  }

  return foundSelectors;
}
