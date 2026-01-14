/**
 * Signals API Endpoint
 * Epic 5: Connect Dashboard to Real Signals
 *
 * GET /api/signals?project_id=xxx&status=active
 * PATCH /api/signals - Update signal status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

/**
 * GET - Fetch signals for a project with optional filters
 * Query params:
 * - project_id (required): Project UUID
 * - status (optional): 'active', 'all', or specific status
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Signals API GET] === Request started ===');

    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Signals API GET] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!user) {
      console.error('[Signals API GET] No user found in session');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[Signals API GET] User authenticated:', user.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status'); // 'active', 'all', or specific status

    if (!projectId) {
      console.error('[Signals API GET] Missing project_id parameter');
      return NextResponse.json({ error: 'project_id es requerido' }, { status: 400 });
    }

    console.log('[Signals API GET] Fetching signals for project:', projectId, 'status:', status || 'all');

    if (profile?.role === 'viewer') {
      const { data: assignment, error: assignmentError } = await supabase
        .from('project_viewer_assignments')
        .select('id')
        .eq('project_id', projectId)
        .eq('viewer_id', user.id)
        .maybeSingle();

      if (assignmentError || !assignment) {
        console.error('[Signals API GET] Viewer access denied:', assignmentError);
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
      }
    } else if (profile?.role !== 'admin') {
      // Verify user owns this project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('owner_id', user.id)
        .single();

      if (projectError || !project) {
        console.error('[Signals API GET] Project not found or access denied:', projectError);
        return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
      }
    }

    // Build query
    let query = supabase
      .from('signals')
      .select(`
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
        detected_at,
        tags,
        created_at
      `)
      .eq('project_id', projectId)
      .order('detected_at', { ascending: false });

    // Filter by status
    if (status === 'active') {
      query = query.in('status', ['Accelerating', 'Stabilizing', 'New']);
    } else if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: signals, error: signalsError } = await query;

    if (signalsError) {
      console.error('[Signals API GET] Error fetching signals:', signalsError);
      return NextResponse.json({ error: 'Error al obtener señales' }, { status: 500 });
    }

    console.log('[Signals API GET] Fetched', signals?.length || 0, 'signals');

    // Get evidence counts for each signal
    const signalIds = signals?.map(s => s.id) || [];
    let evidenceCounts: Record<string, number> = {};

    if (signalIds.length > 0) {
      console.log('[Signals API GET] Fetching evidence counts for', signalIds.length, 'signals');

      const { data: evidenceData, error: evidenceError } = await supabase
        .from('signal_evidence')
        .select('signal_id')
        .in('signal_id', signalIds);

      if (!evidenceError && evidenceData) {
        evidenceCounts = evidenceData.reduce((acc, item) => {
          acc[item.signal_id] = (acc[item.signal_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('[Signals API GET] Evidence counts:', evidenceCounts);
      } else if (evidenceError) {
        console.error('[Signals API GET] Error fetching evidence counts:', evidenceError);
      }
    }

    // Add evidence count to each signal
    const signalsWithEvidence = signals?.map(signal => ({
      ...signal,
      evidence_count: evidenceCounts[signal.id] || 0,
    })) || [];

    console.log('[Signals API GET] === Request completed successfully ===');

    return NextResponse.json({ signals: signalsWithEvidence });

  } catch (error) {
    console.error('[Signals API GET] Unexpected error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update signal status
 * Body: { signal_id: string, status: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('[Signals API PATCH] === Request started ===');

    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Signals API PATCH] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!user) {
      console.error('[Signals API PATCH] No user found in session');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[Signals API PATCH] User authenticated:', user.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Parse request body
    const body = await request.json();
    const { signal_id, status } = body;

    if (!signal_id || !status) {
      console.error('[Signals API PATCH] Missing required fields');
      return NextResponse.json(
        { error: 'signal_id y status son requeridos' },
        { status: 400 }
      );
    }

    if (status === 'Archived') {
      return NextResponse.json(
        { error: 'El estado "Archived" ya no es válido.' },
        { status: 400 }
      );
    }

    console.log('[Signals API PATCH] Updating signal:', signal_id, 'to status:', status);

    // Verify user owns the project this signal belongs to
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select(`
        id,
        project_id,
        projects!inner (
          owner_id
        )
      `)
      .eq('id', signal_id)
      .single();

    if (signalError || !signal) {
      console.error('[Signals API PATCH] Signal not found or access denied:', signalError);
      return NextResponse.json({ error: 'Señal no encontrada' }, { status: 404 });
    }

    if (profile?.role === 'viewer') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const ownerId = (signal.projects as any).owner_id;
    if (profile?.role !== 'admin' && ownerId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Update the signal
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSignal, error: updateError } = await supabase
      .from('signals')
      .update(updateData)
      .eq('id', signal_id)
      .select()
      .single();

    if (updateError) {
      console.error('[Signals API PATCH] Error updating signal:', updateError);
      return NextResponse.json({ error: 'Error al actualizar señal' }, { status: 500 });
    }

    console.log('[Signals API PATCH] Signal updated successfully');

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'signal_status_updated',
      resource_type: 'signal',
      resource_id: signal_id,
      changes: { status },
    });

    console.log('[Signals API PATCH] === Request completed successfully ===');

    return NextResponse.json({ signal: updatedSignal });

  } catch (error) {
    console.error('[Signals API PATCH] Unexpected error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
