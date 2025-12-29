/**
 * Momentum Analysis API Endpoint
 * Triggers AI-powered momentum analysis for existing signals
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeMomentum } from '@/lib/analysis/analyzeMomentum';
import type { MomentumAnalysisResult } from '@/types/analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for AI processing

/**
 * Verify authentication (supports both user auth and cron secret)
 */
async function verifyAuth(
  request: NextRequest
): Promise<{ authorized: boolean; error?: string }> {
  // Check for cron secret first (for automated triggers)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    console.log('[Momentum Analysis API] Authenticated via cron secret');
    return { authorized: true };
  }

  // Otherwise, require user authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'No autenticado' };
  }

  console.log('[Momentum Analysis API] Authenticated as user:', user.id);
  return { authorized: true };
}

/**
 * POST /api/analysis/analyze-momentum
 *
 * Trigger momentum analysis for a project's existing signals
 *
 * Request body:
 * {
 *   "projectId": "uuid",
 *   "hours": 48 (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "signals_analyzed": 10,
 *   "signals_updated": 3,
 *   "signals_unchanged": 7,
 *   "updated_signals": [...],
 *   "token_usage": {...},
 *   "analysis_notes": "..."
 * }
 */
export async function POST(request: NextRequest) {
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
    const { projectId, hours } = body;

    // Validate projectId
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'projectId es requerido' },
        { status: 400 }
      );
    }

    // Validate hours if provided
    let hoursBack = 48; // Default: 48 hours for momentum context
    if (hours !== undefined) {
      const parsedHours = parseInt(hours, 10);
      if (isNaN(parsedHours) || parsedHours < 1 || parsedHours > 168) {
        return NextResponse.json(
          { success: false, error: 'hours debe estar entre 1 y 168' },
          { status: 400 }
        );
      }
      hoursBack = parsedHours;
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

      if (project.owner_id !== user?.id) {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para este proyecto' },
          { status: 403 }
        );
      }
    }

    console.log(
      `[Momentum Analysis API] Starting analysis for project ${projectId}, last ${hoursBack} hours`
    );

    // Step 4: Run momentum analysis
    const result: MomentumAnalysisResult = await analyzeMomentum(projectId, hoursBack);

    // Step 5: Return result
    console.log(
      `[Momentum Analysis API] Completed: ${result.signals_updated} signals updated, ${result.signals_analyzed} analyzed`
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[Momentum Analysis API] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
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
      },
      { status: 500 }
    );
  }
}
