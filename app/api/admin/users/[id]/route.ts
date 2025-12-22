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
async function verifyOwnerRole() {
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
  targetUserId: string,
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

// PATCH /api/admin/users/[id] - Update user (activate/deactivate, change role)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify owner role
    const { authorized, response, user } = await verifyOwnerRole();
    if (!authorized || !user) {
      return response;
    }

    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuario requerido.' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { role, full_name, phone_number } = body;

    // Validate role if provided
    if (role !== undefined && !['user', 'owner'].includes(role)) {
      return NextResponse.json(
        { error: 'El rol debe ser "user" o "owner".' },
        { status: 400 }
      );
    }

    // Prevent user from demoting themselves from owner
    if (role === 'user' && userId === user.id) {
      return NextResponse.json(
        { error: 'No puedes cambiar tu propio rol de propietario.' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado.' },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {};

    if (role !== undefined) {
      updateData.role = role;
    }

    if (full_name !== undefined) {
      updateData.full_name = full_name;
    }

    if (phone_number !== undefined) {
      updateData.phone_number = phone_number;
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar el usuario.' },
        { status: 500 }
      );
    }

    // Determine what changed for audit log
    const changes: string[] = [];
    if (role !== undefined && role !== existingUser.role) {
      changes.push(`rol: ${existingUser.role} → ${role}`);
    }
    if (full_name !== undefined && full_name !== existingUser.full_name) {
      changes.push('nombre actualizado');
    }
    if (phone_number !== undefined && phone_number !== existingUser.phone_number) {
      changes.push('teléfono actualizado');
    }

    // Log audit action
    await logAuditAction(user.id, 'USER_UPDATED', userId, {
      changes,
      previous: {
        role: existingUser.role,
      },
      new: updateData,
    });

    // Get email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

    return NextResponse.json(
      {
        success: true,
        message: 'Usuario actualizado exitosamente.',
        user: {
          id: updatedUser.id,
          email: authUser.user?.email,
          full_name: updatedUser.full_name,
          phone_number: updatedUser.phone_number,
          role: updatedUser.role,
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in PATCH /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user (optional - can be dangerous)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify owner role
    const { authorized, response, user } = await verifyOwnerRole();
    if (!authorized || !user) {
      return response;
    }

    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuario requerido.' },
        { status: 400 }
      );
    }

    // Prevent user from deleting themselves
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta.' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado.' },
        { status: 404 }
      );
    }

    // Get email from auth.users for audit log
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

    // Delete from user_profiles (cascading should handle related records)
    const { error: deleteProfileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      console.error('Error deleting user profile:', deleteProfileError);
      return NextResponse.json(
        { error: 'Error al eliminar el perfil de usuario.' },
        { status: 500 }
      );
    }

    // Delete from Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Profile already deleted, log but don't fail
    }

    // Log audit action
    await logAuditAction(user.id, 'USER_DELETED', userId, {
      email: authUser.user?.email,
      role: existingUser.role,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Usuario eliminado exitosamente.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
