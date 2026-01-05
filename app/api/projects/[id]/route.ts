/**
 * Project Settings API
 * Handles updating individual project settings including refresh interval
 * Epic 5 Story 5.5: Added GET and DELETE methods
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

/**
 * GET handler - Get single project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Project API GET] === Request started ===');

    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Project API GET] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[Project API GET] User authenticated:', user.id);

    const { id: projectId } = params;
    console.log('[Project API GET] Fetching project:', projectId);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[Project API GET] Project not found:', projectError);
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    console.log('[Project API GET] === Request completed successfully ===');

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Project API GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Check project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, owner_id, settings')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o acceso denegado' },
        { status: 404 }
      );
    }

    if (profile?.role !== 'admin' && project.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o acceso denegado' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { refresh_interval_hours, name, description, signal_instructions, risk_criteria } = body;

    // Validate refresh_interval_hours if provided
    if (refresh_interval_hours !== undefined) {
      if (![2, 4, 8, 12].includes(refresh_interval_hours)) {
        return NextResponse.json(
          { error: 'Intervalo de actualización inválido. Debe ser 2, 4, 8, o 12 horas.' },
          { status: 400 }
        );
      }
    }

    if (risk_criteria && risk_criteria.length > 2000) {
      return NextResponse.json(
        { error: 'Los criterios de riesgo no pueden exceder 2000 caracteres.' },
        { status: 400 }
      );
    }

    // Build update object
    const updates: any = {};

    // Update simple fields
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (signal_instructions !== undefined) updates.signal_instructions = signal_instructions;
    if (risk_criteria !== undefined) updates.risk_criteria = risk_criteria;

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
      .select('id, name, description, signal_instructions, risk_criteria, settings, created_at, updated_at')
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

/**
 * DELETE handler - Delete project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: projectId } = params;
  console.log('[Project API DELETE] Starting delete for project:', projectId);

  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Project API DELETE] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[Project API DELETE] User authenticated:', user.id);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[Project API DELETE] User role:', profile?.role);

    // Verify ownership and delete
    const deleteQuery = supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (profile?.role !== 'admin') {
      console.log('[Project API DELETE] Non-admin user, checking ownership');
      deleteQuery.eq('owner_id', user.id);
    }

    console.log('[Project API DELETE] Executing delete query...');
    const { data: deletedData, error: deleteError } = await deleteQuery.select();

    if (deleteError) {
      console.error('[Project API DELETE] Error deleting project:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar proyecto: ' + deleteError.message },
        { status: 500 }
      );
    }

    console.log('[Project API DELETE] Delete result:', deletedData);

    if (!deletedData || deletedData.length === 0) {
      console.error('[Project API DELETE] No rows deleted - project not found or access denied');
      return NextResponse.json(
        { error: 'Proyecto no encontrado o sin permisos' },
        { status: 404 }
      );
    }

    console.log('[Project API DELETE] ✅ Project deleted successfully');

    // Log the action
    const supabaseService = createServiceClient();
    try {
      await supabaseService.from('audit_logs').insert({
        user_id: user.id,
        action: 'project_deleted',
        resource_type: 'project',
        resource_id: projectId,
      });
    } catch (auditError) {
      console.warn('[Project API DELETE] Failed to log to audit_logs:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Proyecto eliminado correctamente',
    });
  } catch (error) {
    console.error('[Project API DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
