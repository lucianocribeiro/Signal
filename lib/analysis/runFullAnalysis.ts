/**
 * Full Analysis Orchestrator
 * Runs complete analysis pipeline: detect new signals + analyze momentum
 */

import { detectNewSignals } from './detectSignals';
import { analyzeMomentum } from './analyzeMomentum';
import type { FullAnalysisResult } from '@/types/analysis';

/**
 * Run full analysis for a project
 *
 * Pipeline:
 * 1. detectNewSignals() - Creates NEW signals from unprocessed content
 * 2. analyzeMomentum() - Updates momentum on ALL open signals (including just-created ones)
 * 3. Combine results
 *
 * This ensures new signals are created BEFORE momentum analysis runs,
 * so momentum can immediately start tracking them if they appear in recent content.
 *
 * Error Handling: Partial success model
 * - If detection fails, still attempt momentum analysis
 * - If momentum fails, return partial success with detection results
 * - No rollbacks - operations are independent and idempotent
 *
 * @param projectId - Project UUID to analyze
 * @returns Combined results from both operations
 *
 * @example
 * const result = await runFullAnalysis('project-uuid');
 * console.log(`Created ${result.new_signals.count} new signals`);
 * console.log(`Updated ${result.momentum_updates.count} signals`);
 */
export async function runFullAnalysis(projectId: string): Promise<FullAnalysisResult> {
  console.log(`[Full Analysis] Starting complete analysis for project ${projectId}`);

  const errors: string[] = [];
  let detectionResult = null;
  let momentumResult = null;

  // Step 1: Detect new signals from unprocessed content
  console.log('[Full Analysis] Step 1/2: Detecting new signals...');
  try {
    detectionResult = await detectNewSignals(projectId);

    if (!detectionResult.success) {
      errors.push(`Signal detection: ${detectionResult.error || 'Unknown error'}`);
      console.error('[Full Analysis] Detection failed:', detectionResult.error);
    } else {
      console.log(
        `[Full Analysis] Detection complete: ${detectionResult.signals_detected} new signals created`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Signal detection failed: ${message}`);
    console.error('[Full Analysis] Detection threw error:', error);
  }

  // Step 2: Analyze momentum on all open signals
  // Run this EVEN IF detection failed - momentum analysis is independent
  console.log('[Full Analysis] Step 2/2: Analyzing momentum...');
  try {
    momentumResult = await analyzeMomentum(projectId);

    if (!momentumResult.success) {
      errors.push(`Momentum analysis: ${momentumResult.error || 'Unknown error'}`);
      console.error('[Full Analysis] Momentum analysis failed:', momentumResult.error);
    } else {
      console.log(
        `[Full Analysis] Momentum analysis complete: ${momentumResult.signals_updated} signals updated`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Momentum analysis failed: ${message}`);
    console.error('[Full Analysis] Momentum analysis threw error:', error);
  }

  // Step 3: Combine results
  const success = errors.length === 0;

  // Calculate combined token usage
  const detectionUsage = detectionResult?.token_usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    estimated_cost: 0,
  };

  const momentumUsage = momentumResult?.token_usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    estimated_cost: 0,
  };

  const totalUsage = {
    prompt_tokens: detectionUsage.prompt_tokens + momentumUsage.prompt_tokens,
    completion_tokens: detectionUsage.completion_tokens + momentumUsage.completion_tokens,
    total_tokens: detectionUsage.total_tokens + momentumUsage.total_tokens,
    estimated_cost: detectionUsage.estimated_cost + momentumUsage.estimated_cost,
  };

  const result: FullAnalysisResult = {
    success,
    new_signals: {
      count: detectionResult?.signals_detected || 0,
      signals: detectionResult?.signals || [],
      ingestions_analyzed: detectionResult?.ingestions_analyzed || 0,
    },
    momentum_updates: {
      count: momentumResult?.signals_updated || 0,
      updated_signals: momentumResult?.updated_signals || [],
      unchanged_count: momentumResult?.signals_unchanged || 0,
    },
    token_usage: {
      detection: detectionUsage,
      momentum: momentumUsage,
      total: totalUsage,
    },
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };

  console.log('[Full Analysis] Complete:', {
    success,
    new_signals: result.new_signals.count,
    updated_signals: result.momentum_updates.count,
    total_cost: `$${totalUsage.estimated_cost.toFixed(6)}`,
    errors: errors.length,
  });

  return result;
}
