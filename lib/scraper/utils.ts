import crypto from 'crypto';

/**
 * Scraper Utility Functions
 * Helper functions for text processing and URL validation
 */

/**
 * Clean text by removing extra whitespace and normalizing line breaks
 *
 * @param text - Raw text to clean
 * @returns Cleaned text with normalized whitespace
 *
 * @example
 * cleanText("Hello  \n\n  World") // Returns "Hello\nWorld"
 */
export function cleanText(text: string): string {
  return text
    // Replace multiple spaces with single space
    .replace(/ +/g, ' ')
    // Replace multiple newlines with single newline
    .replace(/\n\n+/g, '\n')
    // Trim whitespace from start and end
    .trim();
}

/**
 * Extract domain from a URL
 *
 * @param url - URL to extract domain from
 * @returns Domain string (e.g., "example.com")
 *
 * @example
 * extractDomain("https://www.example.com/path") // Returns "www.example.com"
 */
export function extractDomain(url: string): string {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch (error) {
    return '';
  }
}

/**
 * Generate a SHA-256 hash of content for deduplication
 *
 * @param content - Content to hash
 * @returns Hexadecimal hash string
 *
 * @example
 * generateContentHash("Hello World") // Returns "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"
 */
export function generateContentHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Validate if a string is a valid URL
 *
 * @param url - String to validate
 * @returns True if valid URL, false otherwise
 *
 * @example
 * isValidUrl("https://example.com") // Returns true
 * isValidUrl("not a url") // Returns false
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delay execution for a specified number of milliseconds
 *
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the delay
 *
 * @example
 * await delay(1000); // Wait for 1 second
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
