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

// GET - List all projects for the authenticated user
export async function GET(request: NextRequest) {
  try {
    console.log('[Projects API GET] === Request started ===');

    const supabase = await createClient();
    console.log('[Projects API GET] Supabase client created');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Projects API GET] Auth error:', {
        error: authError,
        message: authError.message,
      });
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    if (!user) {
      console.error('[Projects API GET] No user found in session');
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    console.log('[Projects API GET] User authenticated:', {
      id: user.id,
      email: user.email,
    });

    // Get projects for this user (simplified query without joins)
    console.log('[Projects API GET] Querying projects table...');

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, description, signal_instructions, risk_criteria, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('[Projects API GET] Projects query failed:', {
        error: projectsError,
        code: projectsError.code,
        message: projectsError.message,
        details: projectsError.details,
        hint: projectsError.hint,
        user_id: user.id,
      });
      return NextResponse.json(
        { error: `Error al obtener proyectos: ${projectsError.message}` },
        { status: 500 }
      );
    }

    console.log('[Projects API GET] Query successful. Projects found:', projects?.length || 0);

    // If projects exist, fetch sources separately to avoid join issues
    if (projects && projects.length > 0) {
      console.log('[Projects API GET] Fetching sources for projects...');

      const projectIds = projects.map(p => p.id);
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('id, project_id, url, name, source_type, platform, is_active, last_scraped_at')
        .in('project_id', projectIds);

      if (sourcesError) {
        console.error('[Projects API GET] Sources query failed:', sourcesError);
        // Don't fail the whole request, just return projects without sources
      } else {
        console.log('[Projects API GET] Sources fetched:', sources?.length || 0);

        // Attach sources to their projects
        projects.forEach(project => {
          (project as any).sources = sources?.filter(s => s.project_id === project.id) || [];
        });
      }
    }

    console.log('[Projects API GET] === Request completed successfully ===');

    return NextResponse.json({ projects: projects || [] }, { status: 200 });

  } catch (error) {
    console.error('[Projects API GET] Unexpected error:', {
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

// POST - Create new project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Projects API] Auth error:', authError);
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    console.log('[Projects API] Authenticated user:', user.id, user.email);

    // Ensure user profile exists (fix for foreign key constraint)
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingProfile) {
      console.log('[Projects API] User profile missing, creating for:', user.id);

      // Create user profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          role: 'user',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        });

      if (profileError) {
        console.error('[Projects API] Error creating user profile:', profileError);
        return NextResponse.json(
          { error: 'Error al crear perfil de usuario' },
          { status: 500 }
        );
      }

      console.log('[Projects API] User profile created successfully');
    }

    // Parse request body
    const body = await request.json();
    const { name, description, signal_instructions, risk_criteria, sources } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'El nombre del proyecto es requerido' },
        { status: 400 }
      );
    }

    // Validate name length (1-200 characters)
    if (name.length > 200) {
      return NextResponse.json(
        { error: 'El nombre del proyecto no puede exceder 200 caracteres' },
        { status: 400 }
      );
    }

    // Validate description length (max 1000 characters)
    if (description && description.length > 1000) {
      return NextResponse.json(
        { error: 'La descripción no puede exceder 1000 caracteres' },
        { status: 400 }
      );
    }

    // Validate signal_instructions length (max 2000 characters)
    if (signal_instructions && signal_instructions.length > 2000) {
      return NextResponse.json(
        { error: 'Las instrucciones de señales no pueden exceder 2000 caracteres' },
        { status: 400 }
      );
    }

    if (risk_criteria && risk_criteria.length > 2000) {
      return NextResponse.json(
        { error: 'Los criterios de riesgo no pueden exceder 2000 caracteres' },
        { status: 400 }
      );
    }

    // Validate sources array if provided
    if (sources && !Array.isArray(sources)) {
      return NextResponse.json(
        { error: 'Las fuentes deben ser un array' },
        { status: 400 }
      );
    }

    // Validate each source URL
    if (sources && sources.length > 0) {
      for (const source of sources) {
        if (!source.url || typeof source.url !== 'string') {
          return NextResponse.json(
            { error: 'Cada fuente debe tener una URL válida' },
            { status: 400 }
          );
        }

        // Basic URL validation
        try {
          new URL(source.url);
        } catch {
          return NextResponse.json(
            { error: `URL inválida: ${source.url}` },
            { status: 400 }
          );
        }
      }
    }

    // Step 1: Create the project
    console.log('[Projects API] Creating project with owner_id:', user.id);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        signal_instructions: signal_instructions?.trim() || null,
        risk_criteria: risk_criteria?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (projectError) {
      console.error('[Projects API] Error creating project:', {
        error: projectError,
        code: projectError.code,
        message: projectError.message,
        details: projectError.details,
        hint: projectError.hint,
        owner_id: user.id,
      });
      return NextResponse.json(
        { error: `Error al crear proyecto: ${projectError.message}` },
        { status: 500 }
      );
    }

    console.log('[Projects API] Project created successfully:', project.id);

    // Step 2: Create sources if provided
    let createdSources = [];
    if (sources && sources.length > 0) {
      const sourcesToInsert = sources.map((source: any) => {
        const sourceType = detectSourceType(source.url);
        return {
          project_id: project.id,
          url: source.url,
          name: source.name?.trim() || new URL(source.url).hostname,
          source_type: sourceType, // Enum: 'twitter', 'reddit', or 'news'
          platform: sourceType, // Store same value in platform field for flexibility
          is_active: true,
        };
      });

      const { data: sourcesData, error: sourcesError } = await supabase
        .from('sources')
        .insert(sourcesToInsert)
        .select();

      if (sourcesError) {
        console.error('Error creating sources:', sourcesError);
        // Don't fail the entire request if sources fail
        // The project was already created successfully
      } else {
        createdSources = sourcesData || [];
      }
    }

    // Step 3: Log to audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'project_created',
        resource_type: 'project',
        resource_id: project.id,
        changes: {
          name: project.name,
          description: project.description,
          signal_instructions: project.signal_instructions,
          risk_criteria: project.risk_criteria,
          sources_count: createdSources.length,
        },
      });

    // Step 4: Return created project with sources
    return NextResponse.json(
      {
        success: true,
        project: {
          ...project,
          sources: createdSources,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error creating project:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
