import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchUnprocessedIngestions,
  getProjectAnalysisContext,
  calculateIngestionStats,
} from '@/lib/analysis/fetchRawData';
import type { AnalysisDataResponse } from '@/types/analysis';

/**
 * GET /api/analysis/raw-data
 *
 * Fetch unprocessed raw ingestions for AI analysis
 *
 * Query Parameters:
 * - projectId (required): UUID of the project to fetch data for
 * - hours (optional): Number of hours to look back (default: 24, max: 168)
 *
 * Returns:
 * - ingestions: Array of raw data ready for AI analysis
 * - project: Project context (name, instructions)
 * - stats: Statistics about the fetched data
 *
 * @example
 * GET /api/analysis/raw-data?projectId=abc-123&hours=24
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Step 1: Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Step 2: Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const hoursParam = searchParams.get('hours');

    // Validate projectId
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'projectId es requerido' },
        { status: 400 }
      );
    }

    // Validate and parse hours parameter
    let hours = 24; // Default to 24 hours
    if (hoursParam) {
      const parsedHours = parseInt(hoursParam, 10);
      if (isNaN(parsedHours) || parsedHours < 1) {
        return NextResponse.json(
          { success: false, error: 'hours debe ser un número mayor a 0' },
          { status: 400 }
        );
      }
      if (parsedHours > 168) {
        // Max 7 days
        return NextResponse.json(
          { success: false, error: 'hours no puede ser mayor a 168 (7 días)' },
          { status: 400 }
        );
      }
      hours = parsedHours;
    }

    // Step 3: Verify project exists and user has access
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

    // Verify ownership
    if (project.owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para acceder a este proyecto' },
        { status: 403 }
      );
    }

    console.log(
      `[API Analysis] Fetching raw data for project ${project.name} (${projectId}), last ${hours} hours`
    );

    // Step 4: Fetch unprocessed ingestions using service client
    // (Service client is used in the utility functions to bypass RLS)
    const ingestions = await fetchUnprocessedIngestions(projectId, hours);

    // Step 5: Fetch project context
    const projectContext = await getProjectAnalysisContext(projectId);

    // Step 6: Calculate statistics
    const stats = calculateIngestionStats(ingestions, hours);

    // Step 7: Build response
    const response: AnalysisDataResponse = {
      success: true,
      ingestions,
      project: projectContext,
      stats,
    };

    console.log(
      `[API Analysis] Returning ${ingestions.length} ingestions for project ${project.name}`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API Analysis] Unexpected error:', error);

    // Check if it's an error we threw with a message
    const errorMessage =
      error instanceof Error ? error.message : 'Error interno del servidor';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ingestions: [],
        project: null,
        stats: {
          total_items: 0,
          time_range_start: null,
          time_range_end: null,
          hours_included: 0,
          platforms: {},
        },
      },
      { status: 500 }
    );
  }
}
