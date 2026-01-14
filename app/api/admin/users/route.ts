import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

// Admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Verify user is admin
async function verifyAdminAccess(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'No autenticado' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { authorized: false, error: 'Acceso denegado' };
  }

  return { authorized: true, userId: user.id };
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, error: authError, userId } = await verifyAdminAccess(request);
    if (!authorized) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, full_name, phone_number, role, project_ids } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, contraseña y rol son requeridos' },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== 'user' && role !== 'admin' && role !== 'viewer') {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser "admin", "user" o "viewer"' },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    if (project_ids !== undefined && !Array.isArray(project_ids)) {
      return NextResponse.json(
        { error: 'Los proyectos deben ser una lista válida.' },
        { status: 400 }
      );
    }

    // Step 1: Create user in auth.users using admin API
    // This will trigger automatic user_profiles creation with default role='user'
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || null,
      }
    });

    if (authCreateError) {
      console.error('Error creating auth user:', authCreateError);
      return NextResponse.json(
        { error: `Error al crear usuario: ${authCreateError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Error al crear usuario: no se recibió ID de usuario' },
        { status: 500 }
      );
    }

    // Step 2: Update user profile with desired role and details
    // (trigger already created profile with default values)
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        role: role,
        full_name: full_name || null,
        phone_number: phone_number || null,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating user profile:', profileError);

      // Rollback: Delete auth user if profile update fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: `Error al actualizar el perfil de usuario: ${profileError.message}` },
        { status: 500 }
      );
    }

    // Step 3: Assign viewer projects when applicable
    if (role === 'viewer' && Array.isArray(project_ids) && project_ids.length > 0) {
      const assignments = project_ids.map((projectId: string) => ({
        project_id: projectId,
        viewer_id: authData.user!.id,
        assigned_by: userId,
      }));

      const { error: assignmentError } = await supabaseAdmin
        .from('project_viewer_assignments')
        .insert(assignments);

      if (assignmentError) {
        console.error('Error assigning viewer projects:', assignmentError);
        await supabaseAdmin.from('user_profiles').delete().eq('id', authData.user!.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user!.id);
        return NextResponse.json(
          { error: 'Error al asignar proyectos al usuario.' },
          { status: 500 }
        );
      }
    }

    // Step 4: Log audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'created_user',
        resource_type: 'user',
        resource_id: authData.user.id,
        changes: {
          email,
          role,
          created_by: userId,
          project_ids: Array.isArray(project_ids) ? project_ids : []
        }
      });

    // Step 5: Return created user data
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role,
        full_name: full_name || null,
        phone_number: phone_number || null,
        created_at: authData.user.created_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error creating user:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, error: authError } = await verifyAdminAccess(request);
    if (!authorized) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    // Get all user profiles (service role to bypass RLS)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      return NextResponse.json(
        { error: 'Error al obtener usuarios' },
        { status: 500 }
      );
    }

    const profileList = profiles || [];
    const profilesById = new Map(profileList.map((profile) => [profile.id, profile]));

    const authUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.listUsers({ page, perPage });

      if (authError) {
        console.error('Error listing auth users:', authError);
        break;
      }

      const usersPage = authData?.users || [];
      authUsers.push(...usersPage);

      if (usersPage.length < perPage) {
        break;
      }
      page += 1;
    }

    const combinedUsers = authUsers.map((authUser) => {
      const profile = profilesById.get(authUser.id);
      const bannedUntil = (authUser as any)?.banned_until;
      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? '',
        full_name:
          profile?.full_name ??
          authUser.user_metadata?.full_name ??
          null,
        role: profile?.role ?? 'unassigned',
        created_at: profile?.created_at ?? authUser.created_at,
        updated_at: profile?.updated_at ?? authUser.updated_at ?? null,
        is_banned: bannedUntil ? new Date(bannedUntil) > new Date() : false,
        has_profile: Boolean(profile),
        has_auth: true,
      };
    });

    const authUserIds = new Set(authUsers.map((authUser) => authUser.id));
    const orphanProfiles = profileList
      .filter((profile) => !authUserIds.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        email: profile.email ?? '',
        full_name: profile.full_name ?? null,
        role: profile.role ?? 'unassigned',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        is_banned: false,
        has_profile: true,
        has_auth: false,
      }));

    const users = [...combinedUsers, ...orphanProfiles].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    const stats = {
      total: users.length,
      admins: users.filter((user) => user.role === 'admin').length,
      users: users.filter((user) => user.role === 'user').length,
      viewers: users.filter((user) => user.role === 'viewer').length,
    };

    return NextResponse.json({ users, stats }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error listing users:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH - Update user (activate/deactivate, change role)
export async function PATCH(request: NextRequest) {
  try {
    // Verify admin access
    const { authorized, error: authError, userId } = await verifyAdminAccess(request);
    if (!authorized) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, updates } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    // Prepare update object for user_profiles
    const profileUpdates: any = {};

    if (updates.role !== undefined) {
      if (updates.role !== 'user' && updates.role !== 'admin' && updates.role !== 'viewer') {
        return NextResponse.json(
          { error: 'Rol inválido. Debe ser "admin", "user" o "viewer".' },
          { status: 400 }
        );
      }
      profileUpdates.role = updates.role;
    }

    if (updates.full_name !== undefined) {
      profileUpdates.full_name = updates.full_name;
    }

    if (updates.phone_number !== undefined) {
      profileUpdates.phone_number = updates.phone_number;
    }

    // Update user_profiles if there are profile updates
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', user_id);

      if (profileError) {
        console.error('Error updating user profile:', profileError);
        return NextResponse.json(
          { error: `Error al actualizar perfil: ${profileError.message}` },
          { status: 500 }
        );
      }
    }

    // Handle activation/deactivation in auth.users if needed
    if (updates.is_active !== undefined) {
      // Note: Supabase doesn't have a direct "active" flag
      // You can ban/unban users instead
      if (updates.is_active === false) {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { ban_duration: '876000h' } // Ban for 100 years (effectively permanent)
        );

        if (banError) {
          console.error('Error banning user:', banError);
          return NextResponse.json(
            { error: `Error al desactivar usuario: ${banError.message}` },
            { status: 500 }
          );
        }
      } else {
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { ban_duration: 'none' }
        );

        if (unbanError) {
          console.error('Error unbanning user:', unbanError);
          return NextResponse.json(
            { error: `Error al activar usuario: ${unbanError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // Log audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'updated_user',
        resource_type: 'user',
        resource_id: user_id,
        changes: updates
      });

    // Get updated user data
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role, full_name, phone_number, created_at')
      .eq('id', user_id)
      .single();

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);

    return NextResponse.json({
      success: true,
      user: {
        ...profile,
        email: authUser.user?.email,
        is_banned: (authUser.user as any)?.banned_until ? new Date((authUser.user as any).banned_until) > new Date() : false
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error updating user:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
