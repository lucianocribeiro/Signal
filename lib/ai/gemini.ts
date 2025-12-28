/**
 * Google Gemini AI Client
 * Configured for Gemini 1.5 Flash model for signal detection
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Initialize Google Gemini client
 * Uses GOOGLE_AI_API_KEY environment variable
 *
 * @throws Error if API key is not configured
 */
function initializeGemini() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get Gemini 1.5 Flash model instance
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

  // Use Gemini 1.5 Flash for fast, cost-effective analysis
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
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
 * Gemini 1.5 Flash pricing (as of 2024)
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
