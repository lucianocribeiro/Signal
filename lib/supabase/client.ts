import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client
 * Use this client in Client Components ('use client')
 *
 * @example
 * import { createClient } from '@/lib/supabase/client';
 *
 * const supabase = createClient();
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password'
 * });
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
