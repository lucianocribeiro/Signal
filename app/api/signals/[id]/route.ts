import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
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
      console.error('[Signals Delete] Signal lookup failed:', signalError);
      return NextResponse.json({ error: 'Señal no encontrada' }, { status: 404 });
    }

    console.log('[Signals Delete] Signal data:', { id: signal.id, project_id: signal.project_id, projects: signal.projects });

    const project = signal.projects as { owner_id: string } | undefined;
    if (!project || !project.owner_id) {
      console.error('[Signals Delete] Project lookup failed - projects data:', signal.projects);
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const ownerId = project.owner_id;
    console.log('[Signals Delete] Authorization check:', { ownerId, userId: user.id, userRole: profile?.role });

    if (profile?.role !== 'admin' && ownerId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('signals')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('[Signals Delete] Error deleting signal:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar señal' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'signal_deleted',
      resource_type: 'signal',
      resource_id: params.id,
      changes: { deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Signals Delete] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
