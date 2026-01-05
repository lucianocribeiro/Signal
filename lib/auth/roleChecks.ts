import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function verifyAdminRole() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Acceso denegado. Solo administradores.' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}

export async function verifyUserOrAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'user') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Acceso denegado. Solo usuarios o administradores.' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}
