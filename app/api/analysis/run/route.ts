/**
 * Full Analysis API Endpoint
 * Triggers complete analysis pipeline: detection + momentum
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runFullAnalysis } from '@/lib/analysis/runFullAnalysis';
import { getGeminiModel } from '@/lib/ai/gemini';
import type { FullAnalysisResult } from '@/types/analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for full pipeline

/**
 * Verify authentication (supports both user auth and cron secret)
 */
async function verifyAuth(
  request: NextRequest
): Promise<{ authorized: boolean; error?: string }> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    console.log('[Full Analysis API] Authenticated via cron secret');
    return { authorized: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'No autenticado' };
  }

  console.log('[Full Analysis API] Authenticated as user:', user.id);
  return { authorized: true };
}

/**
 * POST /api/analysis/run
 *
 * Trigger full analysis pipeline for a project
 *
 * Request body:
 * {
 *   "projectId": "uuid"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "new_signals": {
 *     "count": 5,
 *     "signals": [...],
 *     "ingestions_analyzed": 20
 *   },
 *   "momentum_updates": {
 *     "count": 3,
 *     "updated_signals": [...],
 *     "unchanged_count": 7
 *   },
 *   "token_usage": {
 *     "detection": {...},
 *     "momentum": {...},
 *     "total": {...}
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // Early initialization check for Gemini AI
  try {
    console.log('[Full Analysis API] Verifying Gemini initialization...');
    getGeminiModel();
    console.log('[Full Analysis API] ✅ Gemini initialized successfully');
  } catch (initError) {
    console.error('[Full Analysis API] ❌ Failed to initialize Gemini:', initError);
    return NextResponse.json(
      {
        success: false,
        error: 'AI service unavailable. Configuration error.',
        details: initError instanceof Error ? initError.message : 'Unknown error',
        new_signals: { count: 0, signals: [], ingestions_analyzed: 0 },
        momentum_updates: { count: 0, updated_signals: [], unchanged_count: 0 },
        token_usage: {
          detection: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost: 0 },
          momentum: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost: 0 },
          total: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost: 0 },
        },
      },
      { status: 500 }
    );
  }

  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request);

    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'No autorizado' },
        { status: 401 }
      );
    }

    // Step 2: Parse request body
    const body = await request.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'projectId es requerido' },
        { status: 400 }
      );
    }

    // Step 3: Verify project exists and user has access (if user auth)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user?.id || '')
        .single();

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, owner_id, name')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return NextResponse.json(
          { success: false, error: 'Proyecto no encontrado' },
          { status: 404 }
        );
      }

      if (project.owner_id !== user?.id && profile?.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para este proyecto' },
          { status: 403 }
        );
      }
    }

    console.log(`[Full Analysis API] Starting full analysis for project ${projectId}`);

    // Step 4: Run full analysis pipeline
    const result: FullAnalysisResult = await runFullAnalysis(projectId);

    // Step 5: Return result
    console.log('[Full Analysis API] Completed:', {
      new_signals: result.new_signals.count,
      updated_signals: result.momentum_updates.count,
      success: result.success,
    });

    // Return appropriate status code
    // - 200 for full success
    // - 207 Multi-Status for partial success
    // - 500 for complete failure
    const statusCode =
      result.success
        ? 200
        : result.new_signals.count > 0 || result.momentum_updates.count > 0
        ? 207
        : 500;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('[Full Analysis API] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    return NextResponse.json(
      {
        success: false,
        new_signals: {
          count: 0,
          signals: [],
          ingestions_analyzed: 0,
        },
        momentum_updates: {
          count: 0,
          updated_signals: [],
          unchanged_count: 0,
        },
        token_usage: {
          detection: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            estimated_cost: 0,
          },
          momentum: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            estimated_cost: 0,
          },
          total: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            estimated_cost: 0,
          },
        },
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
