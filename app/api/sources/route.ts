import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

// Helper function to detect source type from URL (matches database enum)
function detectSourceType(url: string): 'twitter' | 'reddit' | 'news' {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter';
  }
  if (urlLower.includes('reddit.com')) {
    return 'reddit';
  }
  return 'news';
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
    const { project_id, url, name } = body;

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

    // Step 3: Detect source type from URL
    const sourceType = detectSourceType(url);

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
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Get optional project_id filter from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    // Build query
    let query = supabase
      .from('sources')
      .select(`
        id,
        project_id,
        url,
        name,
        source_type,
        platform,
        is_active,
        last_scraped_at,
        created_at,
        updated_at,
        projects!inner (
          id,
          name,
          owner_id
        )
      `)
      .eq('projects.owner_id', user.id)
      .order('created_at', { ascending: false });

    // Add project filter if provided
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: sources, error: sourcesError } = await query;

    if (sourcesError) {
      console.error('Error fetching sources:', sourcesError);
      return NextResponse.json(
        { error: 'Error al obtener fuentes' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sources }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error fetching sources:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
