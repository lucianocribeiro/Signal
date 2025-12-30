/**
 * Project Settings API
 * Handles updating individual project settings including refresh interval
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

/**
 * PATCH handler - Update project settings
 * Supports updating refresh_interval_hours and other project fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    // Verify authentication
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Check project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, owner_id, settings')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o acceso denegado' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { refresh_interval_hours, name, description, signal_instructions } = body;

    // Validate refresh_interval_hours if provided
    if (refresh_interval_hours !== undefined) {
      if (![2, 4, 8, 12].includes(refresh_interval_hours)) {
        return NextResponse.json(
          { error: 'Intervalo de actualización inválido. Debe ser 2, 4, 8, o 12 horas.' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: any = {};

    // Update simple fields
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (signal_instructions !== undefined) updates.signal_instructions = signal_instructions;

    // Update settings JSONB if refresh_interval_hours provided
    if (refresh_interval_hours !== undefined) {
      const currentSettings = project.settings || {};
      updates.settings = {
        ...currentSettings,
        refresh_interval_hours,
      };
    }

    // Perform update using service client (to update JSONB properly)
    const supabaseService = createServiceClient();
    const { data: updatedProject, error: updateError } = await supabaseService
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select('id, name, description, signal_instructions, settings, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('[Projects] Error updating project:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar el proyecto' },
        { status: 500 }
      );
    }

    // Log to audit_logs (if table exists)
    try {
      await supabaseService.from('audit_logs').insert({
        user_id: user.id,
        action: 'project_updated',
        resource_type: 'project',
        resource_id: projectId,
        changes: {
          updates,
          previous_refresh_interval: project.settings?.refresh_interval_hours,
          new_refresh_interval: refresh_interval_hours,
        },
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.warn('[Projects] Failed to log to audit_logs:', auditError);
    }

    console.log(`[Projects] Updated project ${project.name}:`, updates);

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: 'Proyecto actualizado correctamente',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[Projects] Fatal error updating project ${projectId}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
