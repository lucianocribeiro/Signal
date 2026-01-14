import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'viewer') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select(
        `
        id,
        project_id,
        projects!inner (
          owner_id
        )
      `
      )
      .eq('id', params.id)
      .single();

    if (signalError || !signal) {
      console.error('[Signals Archive] Signal lookup failed:', signalError);
      return NextResponse.json({ error: 'Señal no encontrada' }, { status: 404 });
    }

    console.log('[Signals Archive] Signal data:', { id: signal.id, project_id: signal.project_id, projects: signal.projects });

    const project = signal.projects as { owner_id: string } | null;
    if (!project || !project.owner_id) {
      console.error('[Signals Archive] Project lookup failed - projects data:', signal.projects);
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const ownerId = project.owner_id;
    console.log('[Signals Archive] Authorization check:', { ownerId, userId: user.id, userRole: profile?.role });

    if (profile?.role !== 'admin' && ownerId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { data: updatedSignal, error: updateError } = await supabase
      .from('signals')
      .update({
        status: 'Archived',
        updated_at: new Date().toISOString(),
        archived_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Signals Archive] Error updating signal:', updateError);
      return NextResponse.json({ error: 'Error al archivar señal' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'signal_archived',
      resource_type: 'signal',
      resource_id: params.id,
      changes: { new_status: 'Archived' },
    });

    return NextResponse.json({ success: true, signal: updatedSignal });
  } catch (error) {
    console.error('[Signals Archive] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
