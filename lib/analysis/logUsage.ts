/**
 * Usage Logging Utility
 * Track AI token consumption and costs in usage_logs table
 */

import { createServiceClient } from '../supabase/service';
import { calculateGeminiCost } from '../ai/gemini';

/**
 * Log AI token usage to database
 *
 * @param projectId - Project UUID
 * @param actionType - Type of action (e.g., 'signal_detection')
 * @param model - AI model used (e.g., 'gemini-1.5-flash')
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @param metadata - Additional metadata (optional)
 * @returns Promise resolving to the log ID
 *
 * @example
 * await logTokenUsage(
 *   'project-uuid',
 *   'signal_detection',
 *   'gemini-1.5-flash',
 *   1500,
 *   800,
 *   { signals_detected: 3 }
 * );
 */
export async function logTokenUsage(
  projectId: string,
  actionType: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  metadata?: Record<string, any>
): Promise<string> {
  const supabase = createServiceClient();

  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = calculateGeminiCost(promptTokens, completionTokens);

  console.log(
    `[Usage] Logging token usage: ${totalTokens} tokens ($${estimatedCost.toFixed(6)})`
  );

  const { data, error } = await supabase
    .from('usage_logs')
    .insert({
      project_id: projectId,
      action_type: actionType,
      model: model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
      metadata: metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Usage] Failed to log token usage:', error);
    throw new Error(`Failed to log usage: ${error.message}`);
  }

  console.log(`[Usage] Logged usage: ${data.id}`);
  return data.id;
}

/**
 * Get usage summary for a project
 *
 * @param projectId - Project UUID
 * @param days - Number of days to look back (default: 30)
 * @returns Usage summary statistics
 *
 * @example
 * const summary = await getProjectUsageSummary('project-uuid', 7);
 * console.log(`Total cost: $${summary.total_cost}`);
 */
export async function getProjectUsageSummary(
  projectId: string,
  days: number = 30
): Promise<{
  total_tokens: number;
  total_cost: number;
  total_calls: number;
  breakdown_by_action: Record<string, { calls: number; tokens: number; cost: number }>;
}> {
  const supabase = createServiceClient();

  // Calculate date threshold
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  const { data, error } = await supabase
    .from('usage_logs')
    .select('action_type, total_tokens, estimated_cost')
    .eq('project_id', projectId)
    .gte('created_at', dateThreshold.toISOString());

  if (error) {
    console.error('[Usage] Failed to fetch usage summary:', error);
    throw new Error(`Failed to fetch usage summary: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      total_tokens: 0,
      total_cost: 0,
      total_calls: 0,
      breakdown_by_action: {},
    };
  }

  // Calculate summary
  let totalTokens = 0;
  let totalCost = 0;
  const breakdownByAction: Record<
    string,
    { calls: number; tokens: number; cost: number }
  > = {};

  data.forEach((log) => {
    totalTokens += log.total_tokens || 0;
    totalCost += parseFloat(log.estimated_cost?.toString() || '0');

    const action = log.action_type || 'unknown';
    if (!breakdownByAction[action]) {
      breakdownByAction[action] = { calls: 0, tokens: 0, cost: 0 };
    }

    breakdownByAction[action].calls += 1;
    breakdownByAction[action].tokens += log.total_tokens || 0;
    breakdownByAction[action].cost += parseFloat(log.estimated_cost?.toString() || '0');
  });

  return {
    total_tokens: totalTokens,
    total_cost: totalCost,
    total_calls: data.length,
    breakdown_by_action: breakdownByAction,
  };
}
