/**
 * Signal Detection Service
 * Main orchestrator for AI-powered signal detection
 */

import { createServiceClient } from '../supabase/service';
import { getGeminiModel } from '../ai/gemini';
import { buildSignalDetectionPrompt, prioritizeRecent } from '../ai/prompts/signalDetection';
import { logTokenUsage } from './logUsage';
import { fetchUnprocessedIngestions, getProjectAnalysisContext } from './fetchRawData';
import { linkEvidenceToSignal } from './linkEvidence';
import type {
  SignalDetectionResult,
  AISignalDetectionResponse,
  CreatedSignal,
  DetectedSignal,
} from '@/types/analysis';

/**
 * Detect new signals for a project using AI analysis
 *
 * This is the main orchestrator that:
 * 1. Fetches unprocessed ingestions (raw scraped content)
 * 2. Fetches project context (including signal_instructions)
 * 3. Builds AI prompt combining instructions + content
 * 4. Calls Gemini API for analysis
 * 5. Creates signals in database
 * 6. Logs token usage
 * 7. Marks ingestions as processed
 *
 * @param projectId - Project UUID to analyze
 * @param hoursBack - Hours of data to analyze (default: 24)
 * @returns Signal detection result with created signals and usage stats
 *
 * @example
 * const result = await detectNewSignals('project-uuid');
 * console.log(`Detected ${result.signals_detected} signals`);
 */
export async function detectNewSignals(
  projectId: string,
  hoursBack: number = 24
): Promise<SignalDetectionResult> {
  console.log(`[Signal Detection] Starting analysis for project ${projectId}`);

  try {
    // Step 1: Fetch unprocessed ingestions (raw scraped content)
    const ingestions = await fetchUnprocessedIngestions(projectId, hoursBack);

    if (ingestions.length === 0) {
      console.log('[Signal Detection] No unprocessed ingestions found');
      return {
        success: true,
        ingestions_analyzed: 0,
        signals_detected: 0,
        signals: [],
        token_usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost: 0,
        },
        analysis_notes: 'No hay contenido nuevo para analizar.',
      };
    }

    console.log(`[Signal Detection] Found ${ingestions.length} unprocessed ingestions`);

    // Step 2: Fetch project context (name, signal_instructions, sources)
    const projectContext = await getProjectAnalysisContext(projectId);

    console.log(
      `[Signal Detection] Project: ${projectContext.name}, Instructions: ${projectContext.signal_instructions?.substring(0, 50) || 'None'}...`
    );

    // Step 3: Prioritize recent content if needed (to avoid token limits)
    const ingestionsToAnalyze = prioritizeRecent(ingestions, 100);

    // Step 4: Build AI prompt
    const { systemPrompt, userPrompt } = buildSignalDetectionPrompt(
      projectContext.name,
      projectContext.signal_instructions,
      projectContext.risk_criteria,
      ingestionsToAnalyze
    );

    const contentToAnalyze = ingestionsToAnalyze
      .map(
        (ing) =>
          `[ID: ${ing.id}] [Fuente: ${ing.source.name}] [URL: ${ing.url}]\n${ing.content}`
      )
      .join('\n\n---\n\n');

    console.log(`[Analysis] Sending ${contentToAnalyze.length} chars to Gemini`);

    console.log(`[Signal Detection] Calling Gemini API with ${ingestionsToAnalyze.length} items`);

    // Step 5: Call Gemini API
    // Combine system and user prompts into a single prompt
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const model = getGeminiModel();
    const result = await model.generateContent(fullPrompt);

    const response = result.response;
    const text = response.text();

    console.log(`[Signal Detection] Received response from Gemini (${text.length} chars)`);

    // Step 6: Parse JSON response
    let aiResponse: AISignalDetectionResponse;
    try {
      // Clean up potential markdown code blocks
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('[Signal Detection] Failed to parse JSON response:', parseError);
      console.error('[Signal Detection] Raw response:', text);

      // Try one more time with stricter prompt
      throw new Error('Failed to parse AI response as JSON. Raw response logged.');
    }

    console.log(`[Signal Detection] AI detected ${aiResponse.signals.length} signals`);
    console.log('[Signal Detection] Analysis notes:', aiResponse.analysis_notes || 'None');

    // Step 7: Create signals in database
    const createdSignals: CreatedSignal[] = [];

    for (const detectedSignal of aiResponse.signals) {
      try {
        const createdSignal = await createSignalInDatabase(projectId, detectedSignal);
        createdSignals.push(createdSignal);
      } catch (error) {
        console.error('[Signal Detection] Failed to create signal:', error);
        // Continue with other signals even if one fails
      }
    }

    console.log(`[Signal Detection] Created ${createdSignals.length} signals in database`);

    // Step 8: Calculate token usage
    const usageMetadata = response.usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const completionTokens = usageMetadata?.candidatesTokenCount || 0;

    // Step 9: Log token usage
    await logTokenUsage(projectId, 'signal_detection', 'gemini-1.5-flash', promptTokens, completionTokens, {
      signals_detected: createdSignals.length,
      ingestions_analyzed: ingestionsToAnalyze.length,
    });

    // Step 10: Mark ingestions as processed
    await markIngestionsAsProcessed(ingestionsToAnalyze.map((ing) => ing.id));

    console.log(`[Signal Detection] Marked ${ingestionsToAnalyze.length} ingestions as processed`);

    // Step 11: Calculate cost
    const estimatedCost =
      (promptTokens / 1_000_000) * 0.075 + (completionTokens / 1_000_000) * 0.3;

    return {
      success: true,
      ingestions_analyzed: ingestionsToAnalyze.length,
      signals_detected: createdSignals.length,
      signals: createdSignals,
      token_usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        estimated_cost: estimatedCost,
      },
      analysis_notes: aiResponse.analysis_notes,
    };
  } catch (error) {
    console.error('[Signal Detection] Error during detection:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      ingestions_analyzed: 0,
      signals_detected: 0,
      signals: [],
      token_usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost: 0,
      },
      analysis_notes: '',
      error: errorMessage,
    };
  }
}

/**
 * Create a signal record in the database
 *
 * @param projectId - Project UUID
 * @param detectedSignal - Signal detected by AI
 * @returns Created signal record
 */
async function createSignalInDatabase(
  projectId: string,
  detectedSignal: DetectedSignal
): Promise<CreatedSignal> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('signals')
    .insert({
      project_id: projectId,
      headline: detectedSignal.headline.substring(0, 100), // Ensure max 100 chars
      summary: detectedSignal.summary,
      key_points: detectedSignal.key_points || [],
      status: detectedSignal.status || 'New',
      momentum: detectedSignal.momentum || 'medium',
      risk_level: detectedSignal.risk_level || 'monitor',
      tags: detectedSignal.tags,
      source_name: detectedSignal.source_name || null,
      source_url: detectedSignal.source_url || null,
      metadata: {
        raw_ingestion_ids: detectedSignal.raw_ingestion_ids,
        sources: detectedSignal.source_url ? [detectedSignal.source_url] : [],
        ai_model: 'gemini-1.5-flash',
        ai_suggested_status: detectedSignal.status || 'New',
        ai_suggested_momentum: detectedSignal.momentum || 'medium',
        ai_suggested_risk_level: detectedSignal.risk_level || 'monitor',
      },
    })
    .select(
      `
      id,
      project_id,
      headline,
      summary,
      key_points,
      status,
      momentum,
      risk_level,
      source_name,
      source_url,
      tags,
      detected_at,
      metadata
    `
    )
    .single();

  if (error) {
    console.error('[Signal Detection] Failed to create signal:', error);
    throw new Error(`Failed to create signal: ${error.message}`);
  }

  console.log(`[Signal Detection] Created signal: ${data.headline} (${data.id})`);

  // Link evidence (raw_ingestions) to the newly created signal
  if (detectedSignal.raw_ingestion_ids && detectedSignal.raw_ingestion_ids.length > 0) {
    const { linked, errors } = await linkEvidenceToSignal(
      data.id,
      detectedSignal.raw_ingestion_ids,
      'detected',
      { detected_at: new Date().toISOString() }
    );

    console.log(`[Signal Detection] Linked ${linked} evidence items to signal ${data.id}`);

    if (errors.length > 0) {
      console.error('[Signal Detection] Evidence linking errors:', errors);
    }
  }

  return data as CreatedSignal;
}

/**
 * Mark ingestions as processed in the database
 *
 * @param ingestionIds - Array of ingestion IDs to mark as processed
 */
async function markIngestionsAsProcessed(ingestionIds: string[]): Promise<void> {
  if (ingestionIds.length === 0) {
    return;
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('raw_ingestions')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
    })
    .in('id', ingestionIds);

  if (error) {
    console.error('[Signal Detection] Failed to mark ingestions as processed:', error);
    throw new Error(`Failed to mark ingestions as processed: ${error.message}`);
  }
}
