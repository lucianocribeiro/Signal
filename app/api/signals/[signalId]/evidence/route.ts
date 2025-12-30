/**
 * Signal Evidence API Endpoint
 * Epic 4 Story 4.4: Link Evidence (Raw Data) to Signals
 *
 * GET /api/signals/[signalId]/evidence
 * Returns all evidence (raw_ingestions) linked to a specific signal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSignalEvidence } from '@/lib/analysis/linkEvidence';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

/**
 * GET handler - Retrieve all evidence for a signal
 *
 * Returns evidence grouped by type (detected, momentum, manual)
 * Includes full ingestion content and source information
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing signalId
 * @returns JSON response with signal evidence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { signalId: string } }
) {
  try {
    console.log('[Signal Evidence API] === Request started ===');
    console.log('[Signal Evidence API] Signal ID:', params.signalId);

    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Signal Evidence API] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!user) {
      console.error('[Signal Evidence API] No user found in session');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[Signal Evidence API] User authenticated:', user.id);

    const { signalId } = params;

    // Verify the signal exists and user has access
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select(
        `
        id,
        project_id,
        headline,
        summary,
        status,
        momentum,
        detected_at,
        projects!inner (
          owner_id,
          name
        )
      `
      )
      .eq('id', signalId)
      .eq('projects.owner_id', user.id)
      .single();

    if (signalError || !signal) {
      console.error('[Signal Evidence API] Signal not found or access denied:', signalError);
      return NextResponse.json({ error: 'Señal no encontrada' }, { status: 404 });
    }

    console.log('[Signal Evidence API] Signal found:', signal.headline);

    // Get all evidence for this signal
    const evidence = await getSignalEvidence(signalId);

    console.log('[Signal Evidence API] Evidence retrieved:', evidence.length);

    // Group evidence by type for easier consumption
    const evidenceByType = {
      detected: evidence.filter((e) => e.reference_type === 'detected'),
      momentum: evidence.filter((e) => e.reference_type === 'momentum'),
      manual: evidence.filter((e) => e.reference_type === 'manual'),
    };

    // Truncate content for preview (first 500 chars)
    const evidenceWithPreviews = evidence.map((e) => ({
      ...e,
      ingestion: {
        ...e.ingestion,
        content_preview: e.ingestion.content.substring(0, 500) + (e.ingestion.content.length > 500 ? '...' : ''),
        content_length: e.ingestion.content.length,
        content_full: e.ingestion.content, // Full content still available if needed
      },
    }));

    console.log('[Signal Evidence API] === Request completed successfully ===');

    return NextResponse.json({
      signal: {
        id: signal.id,
        headline: signal.headline,
        summary: signal.summary,
        status: signal.status,
        momentum: signal.momentum,
        detected_at: signal.detected_at,
        project: {
          id: signal.project_id,
          name: (signal.projects as any).name,
        },
      },
      evidence_count: evidence.length,
      evidence_by_type: {
        detected_count: evidenceByType.detected.length,
        momentum_count: evidenceByType.momentum.length,
        manual_count: evidenceByType.manual.length,
      },
      evidence: evidenceWithPreviews,
    });
  } catch (error) {
    console.error('[Signal Evidence API] Unexpected error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Error al obtener evidencia',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
