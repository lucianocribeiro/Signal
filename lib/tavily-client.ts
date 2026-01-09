import { tavily } from '@tavily/core';

export interface TavilyExtractResult {
  url: string;
  raw_content: string;
  images?: string[];
  favicon?: string;
}

export interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results: { url: string; error: string }[];
  response_time: number;
  request_id: string;
}

export interface ExtractedContent {
  url: string;
  content: string;
  wordCount: number;
  success: boolean;
  method: 'tavily';
  error?: string;
}

/**
 * Tavily client wrapper for extracting content from news URLs
 * Handles batch processing, error handling, and retry logic
 */
export class TavilyClient {
  private client: ReturnType<typeof tavily>;
  private maxRetries = 2;
  private retryDelay = 1000;

  constructor() {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      throw new Error('TAVILY_API_KEY environment variable is not set');
    }

    this.client = tavily({ apiKey });
  }

  /**
   * Extract content from multiple news URLs using Tavily Extract API
   * Processes up to 20 URLs per batch with automatic retry logic
   */
  async extractNewsContent(urls: string[]): Promise<ExtractedContent[]> {
    if (!urls || urls.length === 0) {
      return [];
    }

    const batchUrls = urls.slice(0, 20);

    console.log(`[Tavily] Extracting content from ${batchUrls.length} URLs...`);

    try {
      const response = await this.extractWithRetry(batchUrls);
      return this.processResponse(response);
    } catch (error) {
      console.error('[Tavily] Fatal error during extraction:', error);

      return batchUrls.map((url) => ({
        url,
        content: '',
        wordCount: 0,
        success: false,
        method: 'tavily',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  private async extractWithRetry(urls: string[], attempt = 1): Promise<TavilyExtractResponse> {
    try {
      const response = await this.client.extract({
        urls,
        extractDepth: 'advanced',
        format: 'markdown',
        includeImages: false,
        timeout: 30,
      });

      return response as TavilyExtractResponse;
    } catch (error) {
      console.error(`[Tavily] Attempt ${attempt} failed:`, error);

      if (attempt < this.maxRetries) {
        console.log(`[Tavily] Retrying in ${this.retryDelay}ms...`);
        await this.sleep(this.retryDelay);
        return this.extractWithRetry(urls, attempt + 1);
      }

      throw error;
    }
  }

  private processResponse(response: TavilyExtractResponse): ExtractedContent[] {
    const results: ExtractedContent[] = [];

    for (const result of response.results) {
      const content = result.raw_content || '';
      const wordCount = content.split(/\s+/).filter((word) => word.length > 0).length;

      if (wordCount < 100) {
        console.warn(`[Tavily] Low word count for ${result.url}: ${wordCount} words`);
        results.push({
          url: result.url,
          content,
          wordCount,
          success: false,
          method: 'tavily',
          error: 'Content too short',
        });
        continue;
      }

      console.log(`[Tavily] Successfully extracted ${result.url}: ${wordCount} words`);
      results.push({
        url: result.url,
        content,
        wordCount,
        success: true,
        method: 'tavily',
      });
    }

    for (const failed of response.failed_results) {
      console.error(`[Tavily] Failed to extract ${failed.url}: ${failed.error}`);
      results.push({
        url: failed.url,
        content: '',
        wordCount: 0,
        success: false,
        method: 'tavily',
        error: failed.error,
      });
    }

    console.log(
      `[Tavily] Extraction complete: ${results.filter((item) => item.success).length}/${results.length} successful`
    );

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getUsage(): Promise<unknown> {
    try {
      const response = await fetch('https://api.tavily.com/usage', {
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Usage API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[Tavily] Error fetching usage:', error);
      return null;
    }
  }
}

let tavilyClientInstance: TavilyClient | null = null;

export function getTavilyClient(): TavilyClient {
  if (!tavilyClientInstance) {
    tavilyClientInstance = new TavilyClient();
  }
  return tavilyClientInstance;
}
