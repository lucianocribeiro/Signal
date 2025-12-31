/**
 * User Profile API Endpoint
 * Epic 5 Story 5.5: Settings Page
 *
 * GET /api/user/profile - Get current user profile
 * PATCH /api/user/profile - Update user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET - Get current user profile
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[User Profile API GET] === Request started ===');

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[User Profile API GET] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[User Profile API GET] User authenticated:', user.id);

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[User Profile API GET] Profile error:', profileError);
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    console.log('[User Profile API GET] === Request completed successfully ===');

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[User Profile API GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * PATCH - Update user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    console.log('[User Profile API PATCH] === Request started ===');

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[User Profile API PATCH] Auth error:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('[User Profile API PATCH] User authenticated:', user.id);

    const body = await request.json();
    const { full_name } = body;

    console.log('[User Profile API PATCH] Updating profile with full_name:', full_name);

    const { data: profile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        full_name,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[User Profile API PATCH] Error updating profile:', updateError);
      return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
    }

    console.log('[User Profile API PATCH] Profile updated successfully');

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'profile_updated',
      resource_type: 'user_profile',
      resource_id: user.id,
      changes: { full_name },
    });

    console.log('[User Profile API PATCH] === Request completed successfully ===');

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[User Profile API PATCH] Unexpected error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
