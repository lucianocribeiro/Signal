/**
 * Keyword Filtering for Marketplace Scraping
 * Extracts keywords from signal_instructions and filters listings
 */

/**
 * Extract meaningful keywords from signal instructions
 *
 * @param instructions - Project's signal_instructions text
 * @returns Array of lowercase keywords
 *
 * @example
 * extractKeywords("Monitor bitcoin mining equipment including ASIC miners")
 * // Returns: ["monitor", "bitcoin", "mining", "equipment", "including", "asic", "miners"]
 */
export function extractKeywords(instructions: string | null): string[] {
  if (!instructions || instructions.trim().length === 0) {
    return [];
  }

  // Common stop words to exclude (Spanish and English)
  const stopWords = new Set([
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    // Spanish
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'en',
    'de', 'del', 'al', 'con', 'por', 'para', 'que', 'es', 'son', 'esta', 'esto',
    'ese', 'eso', 'este', 'mi', 'tu', 'su', 'nuestro', 'vuestro',
  ]);

  // Extract words, convert to lowercase, filter out stop words and short words
  const words = instructions
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, ' ') // Keep Spanish characters
    .split(/\s+/)
    .filter(word => {
      return (
        word.length >= 3 && // At least 3 characters
        !stopWords.has(word) && // Not a stop word
        !/^\d+$/.test(word) // Not pure numbers
      );
    });

  // Remove duplicates and return
  return [...new Set(words)];
}

/**
 * Check if text contains any of the keywords
 *
 * @param text - Text to search in
 * @param keywords - Array of keywords to search for
 * @returns True if text contains at least one keyword
 *
 * @example
 * containsKeywords("Bitcoin mining rig for sale", ["bitcoin", "mining"])
 * // Returns: true
 */
export function containsKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return true; // No filtering if no keywords
  }

  const lowerText = text.toLowerCase();

  // Return true if ANY keyword is found
  return keywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Filter listings based on keywords
 *
 * @param listings - Array of listing objects with title and description
 * @param keywords - Array of keywords to filter by
 * @returns Filtered array of listings
 *
 * @example
 * const listings = [
 *   { title: "Bitcoin Miner", description: "ASIC S19" },
 *   { title: "Laptop", description: "Dell XPS" }
 * ];
 * filterListings(listings, ["bitcoin", "mining"])
 * // Returns: [{ title: "Bitcoin Miner", description: "ASIC S19" }]
 */
export function filterListings<T extends { title: string; description?: string }>(
  listings: T[],
  keywords: string[]
): T[] {
  if (keywords.length === 0) {
    return listings; // Return all if no keywords
  }

  return listings.filter(listing => {
    const searchText = `${listing.title} ${listing.description || ''}`;
    return containsKeywords(searchText, keywords);
  });
}

/**
 * Extract individual listing cards from marketplace page
 *
 * @param page - Puppeteer page instance
 * @param platform - Detected platform type
 * @returns Array of listing objects
 */
export async function extractMarketplaceListings(
  page: any, // Puppeteer Page type
  platform: string
): Promise<Array<{ title: string; description: string; price?: string; link?: string }>> {
  return await page.evaluate((platformName: string) => {
    const listings: Array<{ title: string; description: string; price?: string; link?: string }> = [];

    let cardSelectors: string[] = [];

    // Platform-specific selectors
    if (platformName === 'marketplace') {
      // Try MercadoLibre first
      cardSelectors = [
        '.ui-search-result',
        '.poly-card',
        '.ui-search-layout__item',
        // ZonaProp
        '.PropertyCard',
        '[data-qa="posting PROPERTY"]',
        // Generic
        '.listing-item',
        '.product-card',
        '.search-result',
      ];
    }

    // Find cards using first matching selector
    let cards: NodeListOf<Element> | null = null;
    for (const selector of cardSelectors) {
      cards = document.querySelectorAll(selector);
      if (cards.length > 0) break;
    }

    if (!cards || cards.length === 0) {
      return listings;
    }

    // Extract data from each card
    cards.forEach((card) => {
      try {
        // Extract title
        const titleEl = card.querySelector('.ui-search-item__title, .poly-component__title, .PropertyCard-title, h2, h3, .listing-title, .product-title');
        const title = titleEl?.textContent?.trim() || '';

        // Extract description
        const descEl = card.querySelector('.ui-search-item__description, .poly-component__description, .PropertyCard-description, .listing-description, .product-description, p');
        const description = descEl?.textContent?.trim() || '';

        // Extract price
        const priceEl = card.querySelector('.andes-money-amount__fraction, .price, .PropertyCard-price, .listing-price, .poly-price__current');
        const price = priceEl?.textContent?.trim() || undefined;

        // Extract link
        const linkEl = card.querySelector('a');
        const link = linkEl?.getAttribute('href') || undefined;

        if (title) {
          listings.push({
            title,
            description,
            price,
            link,
          });
        }
      } catch (error) {
        // Skip this card if extraction fails
      }
    });

    return listings;
  }, platform);
}
