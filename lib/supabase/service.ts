import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using SERVICE_ROLE_KEY
 *
 * ⚠️ WARNING: This client bypasses Row Level Security (RLS) policies
 * - NEVER expose this to the browser/client-side
 * - Only use in server-side code, API routes, or background jobs
 * - Has full admin access to all tables
 *
 * Use cases:
 * - Background scraper operations
 * - Scheduled tasks
 * - Admin operations
 * - Server-side API routes
 *
 * @example
 * // In API route or server component
 * const supabase = createServiceClient();
 * const { data, error } = await supabase.from('sources').select('*');
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
