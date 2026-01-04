/**
 * Momentum Analysis Service
 * Analyzes if existing signals are gaining or losing momentum
 */

import { createServiceClient } from '../supabase/service';
import { getGeminiModel } from '../ai/gemini';
import {
  buildMomentumAnalysisPrompt,
  prioritizeRecentForMomentum,
} from '../ai/prompts/momentumAnalysis';
import { logTokenUsage } from './logUsage';
import { getProjectAnalysisContext } from './fetchRawData';
import { linkEvidenceToSignal } from './linkEvidence';
import type {
  MomentumAnalysisResult,
  AIMomentumAnalysisResponse,
  SignalForMomentumAnalysis,
  UpdatedSignal,
  RawIngestionForAnalysis,
  MomentumUpdate,
} from '@/types/analysis';

/**
 * Analyze momentum for existing signals in a project
 *
 * Follows 11-step orchestration pattern from detectSignals:
 * 1. Fetch open signals (status IN New, Accelerating, Stabilizing)
 * 2. Filter signals by age (>= 24h old only)
 * 3. Fetch recent ingestions (48h, ALL processed status for context)
 * 4. Early returns for empty states
 * 5. Fetch project context
 * 6. Build momentum prompt
 * 7. Call Gemini API
 * 8. Parse JSON response
 * 9. Update signals in database with momentum history
 * 10. Log token usage
 * 11. Return result
 *
 * @param projectId - Project UUID to analyze
 * @param hoursBack - Hours of data to analyze (default: 48 for momentum context)
 * @returns Momentum analysis result with updated signals and usage stats
 *
 * @example
 * const result = await analyzeMomentum('project-uuid');
 * console.log(`Updated ${result.signals_updated} signals`);
 */
export async function analyzeMomentum(
  projectId: string,
  hoursBack: number = 48 // Longer window than detection for momentum context
): Promise<MomentumAnalysisResult> {
  console.log(`[Momentum Analysis] Starting analysis for project ${projectId}`);

  try {
    // Step 1: Fetch all OPEN signals (exclude Archived)
    const signals = await fetchOpenSignals(projectId);

    if (signals.length === 0) {
      console.log('[Momentum Analysis] No open signals to analyze');
      return {
        success: true,
        signals_analyzed: 0,
        signals_updated: 0,
        signals_unchanged: 0,
        updated_signals: [],
        token_usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost: 0,
        },
        analysis_notes: 'No hay señales abiertas para analizar.',
      };
    }

    console.log(`[Momentum Analysis] Found ${signals.length} open signals`);

    // Step 2: Filter to only signals that are old enough for momentum analysis (>= 24h)
    const eligibleSignals = signals.filter((signal) => {
      const ageInHours =
        (Date.now() - new Date(signal.detected_at).getTime()) / (1000 * 60 * 60);
      return ageInHours >= 24;
    });

    if (eligibleSignals.length === 0) {
      console.log(
        '[Momentum Analysis] All signals too new for momentum analysis (< 24h)'
      );
      return {
        success: true,
        signals_analyzed: signals.length,
        signals_updated: 0,
        signals_unchanged: signals.length,
        updated_signals: [],
        token_usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost: 0,
        },
        analysis_notes: 'Todas las señales son muy recientes para análisis de momentum (< 24h).',
      };
    }

    console.log(
      `[Momentum Analysis] ${eligibleSignals.length} signals eligible for analysis (>= 24h old)`
    );

    // Step 3: Fetch recent ingestions (INCLUDING processed ones for full context)
    const ingestions = await fetchRecentIngestionsForMomentum(projectId, hoursBack);

    console.log(
      `[Momentum Analysis] Found ${ingestions.length} recent ingestions (${hoursBack}h)`
    );

    // Step 4: Early return if no recent content
    if (ingestions.length === 0) {
      console.log(
        '[Momentum Analysis] No recent content to analyze momentum against - signals unchanged'
      );
      return {
        success: true,
        signals_analyzed: eligibleSignals.length,
        signals_updated: 0,
        signals_unchanged: eligibleSignals.length,
        updated_signals: [],
        token_usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost: 0,
        },
        analysis_notes: 'No hay contenido reciente para evaluar momentum.',
      };
    }

    // Step 5: Fetch project context
    const projectContext = await getProjectAnalysisContext(projectId);

    console.log(`[Momentum Analysis] Project: ${projectContext.name}`);

    // Step 6: Prioritize recent content if needed
    const ingestionsToAnalyze = prioritizeRecentForMomentum(ingestions, 100);

    // Step 7: Build momentum analysis prompt
    const { systemPrompt, userPrompt } = buildMomentumAnalysisPrompt(
      projectContext.name,
      eligibleSignals,
      projectContext.risk_criteria,
      ingestionsToAnalyze
    );

    console.log(
      `[Momentum Analysis] Calling Gemini API with ${eligibleSignals.length} signals and ${ingestionsToAnalyze.length} ingestions`
    );

    // Step 8: Call Gemini API
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const model = getGeminiModel();
    const result = await model.generateContent(fullPrompt);

    const response = result.response;
    const text = response.text();

    console.log(`[Momentum Analysis] Received response from Gemini (${text.length} chars)`);

    // Step 9: Parse JSON response
    let aiResponse: AIMomentumAnalysisResponse;
    try {
      // Clean up potential markdown code blocks
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('[Momentum Analysis] Failed to parse JSON response:', parseError);
      console.error('[Momentum Analysis] Raw response:', text);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log(
      `[Momentum Analysis] AI returned ${aiResponse.signal_updates.length} updates, ${aiResponse.unchanged_signals.length} unchanged`
    );

    // Step 10: Update signals in database
    const updatedSignals: UpdatedSignal[] = [];

    for (const update of aiResponse.signal_updates) {
      try {
        const updatedSignal = await updateSignalMomentum(update, eligibleSignals);
        updatedSignals.push(updatedSignal);
      } catch (error) {
        console.error('[Momentum Analysis] Failed to update signal:', error);
        // Continue with other updates even if one fails
      }
    }

    console.log(`[Momentum Analysis] Updated ${updatedSignals.length} signals in database`);

    // Step 11: Calculate token usage and log
    const usageMetadata = response.usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const completionTokens = usageMetadata?.candidatesTokenCount || 0;

    await logTokenUsage(
      projectId,
      'momentum_analysis',
      'gemini-1.5-flash',
      promptTokens,
      completionTokens,
      {
        signals_analyzed: eligibleSignals.length,
        signals_updated: updatedSignals.length,
        signals_unchanged: aiResponse.unchanged_signals.length,
      }
    );

    // Calculate cost
    const estimatedCost =
      (promptTokens / 1_000_000) * 0.075 + (completionTokens / 1_000_000) * 0.3;

    return {
      success: true,
      signals_analyzed: eligibleSignals.length,
      signals_updated: updatedSignals.length,
      signals_unchanged: aiResponse.unchanged_signals.length,
      updated_signals: updatedSignals,
      token_usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        estimated_cost: estimatedCost,
      },
      analysis_notes: aiResponse.analysis_notes,
    };
  } catch (error) {
    console.error('[Momentum Analysis] Error during analysis:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      signals_analyzed: 0,
      signals_updated: 0,
      signals_unchanged: 0,
      updated_signals: [],
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
 * Fetch open signals for momentum analysis
 * Includes all non-archived signals
 *
 * @param projectId - Project UUID
 * @returns Array of signals ready for momentum analysis
 */
async function fetchOpenSignals(
  projectId: string
): Promise<SignalForMomentumAnalysis[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('signals')
    .select('id, headline, summary, status, momentum, risk_level, detected_at, tags')
    .eq('project_id', projectId)
    .in('status', ['New', 'Accelerating', 'Stabilizing'])
    .order('detected_at', { ascending: false });

  if (error) {
    console.error('[Momentum Analysis] Error fetching open signals:', error);
    throw new Error(`Failed to fetch signals: ${error.message}`);
  }

  return (data || []) as SignalForMomentumAnalysis[];
}

/**
 * Fetch recent ingestions INCLUDING processed ones for full momentum context
 * This differs from fetchUnprocessedIngestions which only gets unprocessed
 *
 * @param projectId - Project UUID
 * @param hoursBack - Hours of data to fetch
 * @returns Array of recent ingestions
 */
async function fetchRecentIngestionsForMomentum(
  projectId: string,
  hoursBack: number
): Promise<RawIngestionForAnalysis[]> {
  const supabase = createServiceClient();

  const timeThreshold = new Date();
  timeThreshold.setHours(timeThreshold.getHours() - hoursBack);

  console.log(
    `[Momentum Analysis] Fetching ALL ingestions (processed + unprocessed) from last ${hoursBack} hours`
  );

  // Key difference: NO filter on processed flag
  const { data, error } = await supabase
    .from('raw_ingestions')
    .select(
      `
      id,
      source_id,
      raw_data,
      ingested_at,
      metadata,
      sources!inner (
        name,
        url,
        platform,
        project_id
      )
    `
    )
    .eq('sources.project_id', projectId)
    .gte('ingested_at', timeThreshold.toISOString())
    .order('ingested_at', { ascending: false });

  if (error) {
    console.error('[Momentum Analysis] Error fetching recent ingestions:', error);
    throw new Error(`Failed to fetch ingestions: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Transform to RawIngestionForAnalysis format (same as fetchUnprocessedIngestions)
  const ingestions: RawIngestionForAnalysis[] = data.map((row: any) => ({
    id: row.id,
    source_id: row.source_id,
    content: row.raw_data.text || '',
    url: row.raw_data.url || '',
    title: row.raw_data.title || '',
    ingested_at: row.ingested_at,
    platform: row.raw_data.platform || row.sources.platform || 'generic',
    word_count: row.raw_data.wordCount || 0,
    content_hash: row.metadata?.contentHash,
    source: {
      name: row.sources.name,
      url: row.sources.url,
      platform: row.sources.platform || 'generic',
    },
    metadata: {
      extractionMethod: row.metadata?.extractionMethod,
      selectorsFound: row.metadata?.selectorsFound,
      scrolled: row.metadata?.scrolled,
    },
  }));

  return ingestions;
}

/**
 * Update a signal's momentum in the database
 * Preserves momentum history in metadata
 *
 * @param update - Momentum update from AI
 * @param allSignals - All signals being analyzed (to find original values)
 * @returns Updated signal record with before/after comparison
 */
async function updateSignalMomentum(
  update: MomentumUpdate,
  allSignals: SignalForMomentumAnalysis[]
): Promise<UpdatedSignal> {
  const supabase = createServiceClient();

  // Find the original signal
  const originalSignal = allSignals.find((s) => s.id === update.signal_id);
  if (!originalSignal) {
    throw new Error(`Signal not found: ${update.signal_id}`);
  }

  // Fetch current metadata to preserve history
  const { data: currentSignal } = await supabase
    .from('signals')
    .select('metadata')
    .eq('id', update.signal_id)
    .single();

  const existingMetadata = currentSignal?.metadata || {};
  const momentumHistory = existingMetadata.momentum_history || [];

  // Add new history entry
  const nextRiskLevel = update.new_risk_level || originalSignal.risk_level || 'monitor';
  const newHistoryEntry = {
    checked_at: new Date().toISOString(),
    previous_status: originalSignal.status,
    new_status: update.new_status,
    previous_momentum: originalSignal.momentum,
    new_momentum: update.new_momentum,
    previous_risk_level: originalSignal.risk_level || 'monitor',
    new_risk_level: nextRiskLevel,
    reason: update.reason,
    supporting_ingestion_ids: update.supporting_ingestion_ids,
    evidence_count: update.supporting_ingestion_ids.length,
  };

  momentumHistory.push(newHistoryEntry);

  // Update signal
  const { data, error } = await supabase
    .from('signals')
    .update({
      status: update.new_status,
      momentum: update.new_momentum,
      risk_level: nextRiskLevel,
      metadata: {
        ...existingMetadata,
        momentum_history: momentumHistory,
        last_momentum_check: new Date().toISOString(),
        total_momentum_checks: (existingMetadata.total_momentum_checks || 0) + 1,
        last_momentum_reason: update.reason,
        last_supporting_ingestion_ids: update.supporting_ingestion_ids,
        last_risk_level: nextRiskLevel,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', update.signal_id)
    .select('id, headline, status, momentum, updated_at')
    .single();

  if (error) {
    console.error('[Momentum Analysis] Failed to update signal:', error);
    throw new Error(`Failed to update signal: ${error.message}`);
  }

  console.log(
    `[Momentum Analysis] Updated signal: ${originalSignal.headline} (${originalSignal.status}/${originalSignal.momentum} → ${update.new_status}/${update.new_momentum})`
  );

  // Link momentum evidence (supporting_ingestion_ids) to the signal
  if (update.supporting_ingestion_ids && update.supporting_ingestion_ids.length > 0) {
    const { linked, errors } = await linkEvidenceToSignal(
      data.id,
      update.supporting_ingestion_ids,
      'momentum',
      {
        momentum_update: update.new_status,
        reason: update.reason,
        updated_at: new Date().toISOString(),
      }
    );

    console.log(`[Momentum Analysis] Linked ${linked} momentum evidence items to signal ${data.id}`);

    if (errors.length > 0) {
      console.error('[Momentum Analysis] Evidence linking errors:', errors);
    }
  }

  return {
    id: data.id,
    headline: data.headline,
    old_status: originalSignal.status,
    new_status: data.status,
    old_momentum: originalSignal.momentum,
    new_momentum: data.momentum,
    new_risk_level: nextRiskLevel,
    reason: update.reason,
    updated_at: data.updated_at,
  };
}
