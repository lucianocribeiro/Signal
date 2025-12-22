import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE - Remove source from project (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const sourceId = params.id;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Validate source ID
    if (!sourceId || typeof sourceId !== 'string') {
      return NextResponse.json(
        { error: 'ID de fuente inválido' },
        { status: 400 }
      );
    }

    // Step 1: Verify the source exists and user owns the project
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select(`
        id,
        url,
        name,
        project_id,
        is_active,
        projects!inner (
          id,
          name,
          owner_id
        )
      `)
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: 'Fuente no encontrada' },
        { status: 404 }
      );
    }

    // Check authorization - user must own the project
    if (source.projects.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar esta fuente' },
        { status: 403 }
      );
    }

    // Check if source is already deleted (inactive)
    if (!source.is_active) {
      return NextResponse.json(
        { error: 'Esta fuente ya fue eliminada' },
        { status: 400 }
      );
    }

    // Step 2: Soft delete - Set is_active to false
    const { error: deleteError } = await supabase
      .from('sources')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId);

    if (deleteError) {
      console.error('Error deleting source:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar fuente' },
        { status: 500 }
      );
    }

    // Step 3: Log to audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'source_deleted',
        resource_type: 'source',
        resource_id: sourceId,
        changes: {
          project_id: source.project_id,
          url: source.url,
          name: source.name,
          soft_delete: true,
        },
      });

    // Step 4: Return success
    return NextResponse.json(
      {
        success: true,
        message: 'Fuente eliminada correctamente',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Unexpected error deleting source:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
