import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// Initialize Supabase Admin client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper function to verify owner role
async function verifyOwnerRole(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión.' },
        { status: 401 }
      ),
      user: null,
    };
  }

  // Check if user is owner
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || profile?.role !== 'owner') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Acceso denegado. Solo los propietarios pueden realizar esta acción.' },
        { status: 403 }
      ),
      user: null,
    };
  }

  return {
    authorized: true,
    response: null,
    user,
  };
}

// Helper function to log audit actions
async function logAuditAction(
  userId: string,
  action: string,
  targetUserId: string | null,
  details: any
) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      target_user_id: targetUserId,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging audit action:', error);
    // Don't fail the main operation if audit logging fails
  }
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    // Verify owner role
    const { authorized, response, user } = await verifyOwnerRole(request);
    if (!authorized || !user) {
      return response;
    }

    // Parse request body
    const body = await request.json();
    const { email, password, full_name, phone_number, role } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'El correo electrónico es requerido.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'El formato del correo electrónico no es válido.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'La contraseña es requerida.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      );
    }

    if (!role || !['user', 'owner'].includes(role)) {
      return NextResponse.json(
        { error: 'El rol debe ser "user" o "owner".' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con este correo electrónico.' },
        { status: 409 }
      );
    }

    // Create user in Supabase Auth using Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification for admin-created users
      user_metadata: {
        full_name: full_name || null,
        created_by_admin: true,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        {
          error: authError.message === 'User already registered'
            ? 'El usuario ya está registrado.'
            : 'Error al crear usuario en el sistema de autenticación.',
        },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'No se pudo crear el usuario.' },
        { status: 500 }
      );
    }

    // Create user profile in database
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: full_name || null,
        phone: phone_number || null,
        role: role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);

      // Rollback: Delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: 'Error al crear el perfil de usuario.' },
        { status: 500 }
      );
    }

    // Log audit action
    await logAuditAction(user.id, 'USER_CREATED', authData.user.id, {
      email,
      role,
      full_name,
    });

    // Return success response (exclude password)
    return NextResponse.json(
      {
        success: true,
        message: 'Usuario creado exitosamente.',
        user: {
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          phone: profileData.phone,
          role: profileData.role,
          is_active: profileData.is_active,
          created_at: profileData.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
  try {
    // Verify owner role
    const { authorized, response } = await verifyOwnerRole(request);
    if (!authorized) {
      return response;
    }

    // Fetch all users from user_profiles
    const { data: users, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, phone, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Error al obtener la lista de usuarios.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        users: users || [],
        count: users?.length || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
