/**
 * Google Gemini AI Client
 * Configured for Gemini 2.0 Flash (stable) model for signal detection
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Initialize Google Gemini client
 * Uses GOOGLE_AI_API_KEY environment variable
 *
 * @throws Error if API key is not configured
 */
function initializeGemini() {
  console.log('[Gemini Init] ================================');
  console.log('[Gemini Init] Environment:', process.env.NODE_ENV);
  console.log('[Gemini Init] Vercel Env:', process.env.VERCEL_ENV);

  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    // Log available env var names (NOT values) for debugging
    const allKeys = Object.keys(process.env);
    const googleKeys = allKeys.filter(k => k.includes('GOOGLE'));
    const apiKeyVars = allKeys.filter(k => k.includes('API_KEY'));

    console.error('[Gemini Init] ❌ GOOGLE_AI_API_KEY is MISSING');
    console.error('[Gemini Init] GOOGLE_* variables found:', googleKeys.length > 0 ? googleKeys : 'NONE');
    console.error('[Gemini Init] *_API_KEY variables found:', apiKeyVars.length > 0 ? apiKeyVars : 'NONE');
    console.error('[Gemini Init] Total env vars visible:', allKeys.length);
    console.error('[Gemini Init] Sample env var names (first 10):', allKeys.slice(0, 10));
    console.log('[Gemini Init] ================================');

    throw new Error(
      'GOOGLE_AI_API_KEY environment variable is not set. ' +
      'Verify in Vercel Dashboard: Settings → Environment Variables → ' +
      'Ensure Production/Preview/Development are ALL checked.'
    );
  }

  console.log('[Gemini Init] ✅ API key found (length:', apiKey.length, 'chars)');
  console.log('[Gemini Init] ✅ Initializing Google Generative AI...');
  console.log('[Gemini Init] ================================');

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get Gemini 2.0 Flash model instance (stable)
 * Configured for signal detection with JSON output
 *
 * @returns Configured GenerativeModel instance
 *
 * @example
 * const model = getGeminiModel();
 * const result = await model.generateContent(prompt);
 */
export function getGeminiModel() {
  const genAI = initializeGemini();

  // Use Gemini 2.0 Flash (stable release, widely available)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3, // Lower temperature for consistent, focused outputs
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json', // Force JSON response
    },
  });

  return model;
}

/**
 * Gemini 2.0 Flash pricing
 * Used for cost estimation in usage logs
 */
export const GEMINI_PRICING = {
  inputTokensPer1M: 0.075, // $0.075 per 1M input tokens
  outputTokensPer1M: 0.30, // $0.30 per 1M output tokens
};

/**
 * Calculate estimated cost for API call
 *
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @returns Estimated cost in USD
 *
 * @example
 * const cost = calculateGeminiCost(1000, 500);
 * console.log(`Estimated cost: $${cost.toFixed(6)}`);
 */
export function calculateGeminiCost(
  promptTokens: number,
  completionTokens: number
): number {
  const inputCost = (promptTokens / 1_000_000) * GEMINI_PRICING.inputTokensPer1M;
  const outputCost = (completionTokens / 1_000_000) * GEMINI_PRICING.outputTokensPer1M;
  return inputCost + outputCost;
}
