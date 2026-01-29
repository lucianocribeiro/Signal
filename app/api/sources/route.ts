import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

// Helper function to detect source type from URL (matches database enum)
function detectSourceType(url: string): 'twitter' | 'reddit' | 'news' | 'marketplace' {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter';
  }
  if (urlLower.includes('reddit.com')) {
    return 'reddit';
  }

  // Marketplace detection
  if (urlLower.includes('mercadolibre.com') || urlLower.includes('zonaprop.com') ||
      urlLower.includes('properati.com') || urlLower.includes('olx.com')) {
    return 'marketplace';
  }

  // RSS/News detection
  if (url.includes('/rss') || url.includes('/feed') || url.includes('.xml')) {
    return 'news';
  }

  // Default to news for common news domains
  const newsDomains = ['lanacion.com.ar', 'clarin.com', 'infobae.com', 'pagina12.com.ar'];
  if (newsDomains.some(domain => urlLower.includes(domain))) {
    return 'news';
  }

  return 'news'; // Default to news instead of 'other'
}

// Helper function to validate URL format
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST - Add new source to a project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { project_id, url, name, source_type } = body;

    // Validate required fields
    if (!project_id || typeof project_id !== 'string') {
      return NextResponse.json(
        { error: 'El ID del proyecto es requerido' },
        { status: 400 }
      );
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { error: 'La URL es requerida' },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: 'URL inválida. Debe comenzar con http:// o https://' },
        { status: 400 }
      );
    }

    // Validate name length if provided
    if (name && name.length > 200) {
      return NextResponse.json(
        { error: 'El nombre no puede exceder 200 caracteres' },
        { status: 400 }
      );
    }

    // Step 1: Verify the project exists and belongs to the user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', project_id)
      .eq('owner_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o no tienes permisos' },
        { status: 404 }
      );
    }

    // Step 2: Check if URL already exists in this project
    const { data: existingSource, error: checkError } = await supabase
      .from('sources')
      .select('id')
      .eq('project_id', project_id)
      .eq('url', url)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking duplicate source:', checkError);
    }

    if (existingSource) {
      return NextResponse.json(
        { error: 'Esta URL ya existe en este proyecto' },
        { status: 409 }
      );
    }

    // Step 3: Use provided source_type or detect from URL
    const sourceType = source_type || detectSourceType(url);

    // Extract hostname for default name if not provided
    let displayName = name?.trim() || null;
    if (!displayName) {
      try {
        const urlObj = new URL(url);
        displayName = urlObj.hostname;
      } catch {
        displayName = url;
      }
    }

    // Step 4: Create the source
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .insert({
        project_id: project_id,
        url: url.trim(),
        name: displayName,
        source_type: sourceType,
        platform: sourceType,
        is_active: true,
      })
      .select()
      .single();

    if (sourceError) {
      console.error('Error creating source:', sourceError);
      return NextResponse.json(
        { error: `Error al crear fuente: ${sourceError.message}` },
        { status: 500 }
      );
    }

    // Step 5: Log to audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'source_added',
        resource_type: 'source',
        resource_id: source.id,
        changes: {
          project_id: project_id,
          url: source.url,
          name: source.name,
          source_type: sourceType,
        },
      });

    // Step 6: Return created source
    return NextResponse.json(
      {
        success: true,
        source: source,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error creating source:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - List all sources for user's projects (optional filter by project_id)
export async function GET(request: NextRequest) {
  try {
    console.log('[Sources API GET] === Request started ===');

    const supabase = await createClient();
    console.log('[Sources API GET] Supabase client created');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Sources API GET] Auth error:', {
        error: authError,
        message: authError.message,
      });
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    if (!user) {
      console.error('[Sources API GET] No user found in session');
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    console.log('[Sources API GET] User authenticated:', {
      id: user.id,
      email: user.email,
    });

    // Get optional project_id filter from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    console.log('[Sources API GET] Query params:', { projectId });

    // Step 1: Get user's projects to filter sources
    console.log('[Sources API GET] Fetching user projects...');

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('is_active', true);

    if (projectsError) {
      console.error('[Sources API GET] Projects query failed:', {
        error: projectsError,
        code: projectsError.code,
        message: projectsError.message,
      });
      return NextResponse.json(
        { error: `Error al obtener proyectos: ${projectsError.message}` },
        { status: 500 }
      );
    }

    console.log('[Sources API GET] User projects found:', projects?.length || 0);

    if (!projects || projects.length === 0) {
      console.log('[Sources API GET] No projects found, returning empty sources');
      return NextResponse.json({ sources: [] }, { status: 200 });
    }

    // Step 2: Get sources for these projects
    const projectIds = projects.map(p => p.id);
    console.log('[Sources API GET] Fetching sources for projects:', projectIds.length);

    let sourcesQuery = supabase
      .from('sources')
      .select('id, project_id, url, name, source_type, platform, is_active, last_scraped_at, created_at, updated_at')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    // Add project filter if provided
    if (projectId) {
      console.log('[Sources API GET] Filtering by project_id:', projectId);
      sourcesQuery = sourcesQuery.eq('project_id', projectId);
    }

    const { data: sources, error: sourcesError } = await sourcesQuery;

    if (sourcesError) {
      console.error('[Sources API GET] Sources query failed:', {
        error: sourcesError,
        code: sourcesError.code,
        message: sourcesError.message,
        details: sourcesError.details,
        hint: sourcesError.hint,
      });
      return NextResponse.json(
        { error: `Error al obtener fuentes: ${sourcesError.message}` },
        { status: 500 }
      );
    }

    console.log('[Sources API GET] Sources fetched:', sources?.length || 0);

    // Step 3: Attach project info to each source
    const sourcesWithProjects = sources?.map(source => {
      const project = projects.find(p => p.id === source.project_id);
      return {
        ...source,
        projects: project ? { id: project.id, name: project.name, owner_id: user.id } : null,
      };
    }) || [];

    console.log('[Sources API GET] === Request completed successfully ===');

    return NextResponse.json({ sources: sourcesWithProjects }, { status: 200 });

  } catch (error) {
    console.error('[Sources API GET] Unexpected error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
