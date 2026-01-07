import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

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
    // Note: projects is an object (not array) because we used .single()
    const project = source.projects as any;
    if (!project || project.owner_id !== user.id) {
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

// PATCH - Update source details (url, name, source_type)
export async function PATCH(
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

    const body = await request.json();
    const { url, name, source_type, is_active } = body || {};

    if (url === undefined && name === undefined && source_type === undefined && is_active === undefined) {
      return NextResponse.json(
        { error: 'No hay cambios para actualizar' },
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
        source_type,
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

    const project = source.projects as any;
    if (!project || project.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para editar esta fuente' },
        { status: 403 }
      );
    }

    // Build updates with validation
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (url !== undefined) {
      if (typeof url !== 'string' || url.trim().length === 0) {
        return NextResponse.json(
          { error: 'La URL es requerida' },
          { status: 400 }
        );
      }

      let urlObj: URL;
      try {
        urlObj = new URL(url);
      } catch {
        return NextResponse.json(
          { error: 'URL inválida. Debe comenzar con http:// o https://' },
          { status: 400 }
        );
      }

      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return NextResponse.json(
          { error: 'URL inválida. Debe comenzar con http:// o https://' },
          { status: 400 }
        );
      }

      const trimmedUrl = url.trim();

      if (trimmedUrl !== source.url) {
        // Check for duplicate URL in the same project
        const { data: existingSource, error: existingError } = await supabase
          .from('sources')
          .select('id')
          .eq('project_id', source.project_id)
          .eq('url', trimmedUrl)
          .neq('id', sourceId)
          .maybeSingle();

        if (existingError) {
          console.error('Error checking duplicate source:', existingError);
        }

        if (existingSource) {
          return NextResponse.json(
            { error: 'Esta URL ya existe en este proyecto' },
            { status: 409 }
          );
        }
      }

      updates.url = trimmedUrl;
    }

    if (name !== undefined) {
      if (typeof name !== 'string') {
        return NextResponse.json(
          { error: 'El nombre debe ser texto' },
          { status: 400 }
        );
      }

      if (name.length > 200) {
        return NextResponse.json(
          { error: 'El nombre no puede exceder 200 caracteres' },
          { status: 400 }
        );
      }

      const trimmedName = name.trim();
      updates.name = trimmedName.length > 0 ? trimmedName : null;
    }

    if (source_type !== undefined) {
      const allowedTypes = ['x_twitter', 'reddit', 'news', 'other'];
      if (!allowedTypes.includes(source_type)) {
        return NextResponse.json(
          { error: 'Tipo de fuente inválido' },
          { status: 400 }
        );
      }

      updates.source_type = source_type;
      updates.platform = source_type;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return NextResponse.json(
          { error: 'Estado de fuente inválido' },
          { status: 400 }
        );
      }

      updates.is_active = is_active;
    }

    const { data: updatedSource, error: updateError } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', sourceId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating source:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar fuente' },
        { status: 500 }
      );
    }

    // Log to audit_logs
    const changes: Record<string, any> = {};
    if (updates.url && updates.url !== source.url) {
      changes.url = { from: source.url, to: updates.url };
    }
    if (updates.name !== undefined && updates.name !== source.name) {
      changes.name = { from: source.name, to: updates.name };
    }
    if (updates.source_type && updates.source_type !== source.source_type) {
      changes.source_type = { from: source.source_type, to: updates.source_type };
    }
    if (updates.is_active !== undefined && updates.is_active !== source.is_active) {
      changes.is_active = { from: source.is_active, to: updates.is_active };
    }

    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'source_updated',
        resource_type: 'source',
        resource_id: sourceId,
        changes,
      });

    return NextResponse.json(
      {
        success: true,
        source: updatedSource,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Unexpected error updating source:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
