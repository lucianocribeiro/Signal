/**
 * Admin Projects API Endpoint
 * Epic 6.8: Cross-Project Overview
 *
 * GET /api/admin/projects - List all projects across all users (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Admin Projects API] === Request started ===');

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Admin Projects API] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[Admin Projects API] Profile error:', profileError);
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    if (profile.role !== 'admin') {
      console.error('[Admin Projects API] Access denied - not admin');
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const adminClient = createServiceClient();

    const { data: projects, error: projectsError } = await adminClient
      .from('projects')
      .select(
        `
        id,
        name,
        description,
        created_at,
        updated_at,
        settings,
        owner_id,
        user_profiles!projects_owner_id_fkey (
          email,
          full_name
        )
      `
      )
      .order('updated_at', { ascending: false });

    if (projectsError) {
      console.error('[Admin Projects API] Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
    }

    const enrichedProjects = await Promise.all(
      (projects || []).map(async (project) => {
        const { data: signals } = await adminClient
          .from('signals')
          .select('id, status, detected_at')
          .eq('project_id', project.id);

        const { data: sources } = await adminClient
          .from('sources')
          .select('id, is_active')
          .eq('project_id', project.id);

        const signalList = signals || [];
        const sourceList = sources || [];

        const totalSignals = signalList.length;
        const archivedSignals = signalList.filter((signal) => signal.status === 'Archived').length;
        const openSignals = totalSignals - archivedSignals;
        const totalSources = sourceList.length;
        const activeSources = sourceList.filter((source) => source.is_active).length;

        const latestSignal = signalList
          .filter((signal) => signal.detected_at)
          .sort((a, b) => {
            const aTime = new Date(a.detected_at).getTime();
            const bTime = new Date(b.detected_at).getTime();
            return bTime - aTime;
          })[0];

        const lastActivity = latestSignal?.detected_at || project.updated_at;

        let healthScore = 50;
        if (latestSignal?.detected_at) {
          const daysSinceActivity = Math.floor(
            (Date.now() - new Date(latestSignal.detected_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          if (daysSinceActivity < 1) healthScore += 30;
          else if (daysSinceActivity < 3) healthScore += 20;
          else if (daysSinceActivity < 7) healthScore += 10;
        }

        if (activeSources > 0) {
          healthScore += Math.min(activeSources * 5, 20);
        }

        if (openSignals > 0) {
          healthScore += Math.min(openSignals * 2, 20);
        }

        healthScore = Math.min(healthScore, 100);

        let healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
        if (healthScore >= 80) healthStatus = 'excellent';
        else if (healthScore >= 60) healthStatus = 'good';
        else if (healthScore >= 40) healthStatus = 'fair';
        else healthStatus = 'poor';

        return {
          ...project,
          metrics: {
            totalSignals,
            openSignals,
            archivedSignals,
            totalSources,
            activeSources,
            lastActivity,
            healthScore,
            healthStatus,
          },
        };
      })
    );

    const stats = {
      totalProjects: enrichedProjects.length,
      totalSignals: enrichedProjects.reduce((sum, project) => sum + project.metrics.totalSignals, 0),
      totalSources: enrichedProjects.reduce((sum, project) => sum + project.metrics.totalSources, 0),
      averageHealth: Math.round(
        enrichedProjects.reduce((sum, project) => sum + project.metrics.healthScore, 0) /
          (enrichedProjects.length || 1)
      ),
    };

    console.log('[Admin Projects API] === Request completed successfully ===');

    return NextResponse.json({
      projects: enrichedProjects,
      stats,
    });
  } catch (error) {
    console.error('[Admin Projects API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
