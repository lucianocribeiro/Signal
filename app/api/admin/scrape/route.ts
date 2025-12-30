/**
 * Admin Global Scrape Trigger
 * Allows admins to manually trigger the cron scrape logic
 * Respects project refresh intervals (same as automated cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { executeCronScrape } from '@/lib/scraper/cron';

// Force dynamic rendering for routes using cookies/auth
export const dynamic = 'force-dynamic';

// Verify user is owner
async function verifyOwnerAccess(request: NextRequest) {
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

  if (profileError || profile?.role !== 'owner') {
    return { authorized: false, error: 'Acceso denegado' };
  }

  return { authorized: true, userId: user.id };
}

/**
 * POST handler - Manually trigger cron scrape
 * Requires owner role
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify owner access
    const { authorized, error: authError } = await verifyOwnerAccess(request);
    if (!authorized) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    console.log('[Admin] Manual scrape triggered by admin');

    // Execute cron scrape (respects intervals, same as automated cron)
    const result = await executeCronScrape();

    const duration = Date.now() - startTime;

    console.log('[Admin] Manual scrape complete:', {
      success: result.success,
      projectsRefreshed: result.projectsRefreshed,
      sourcesScraped: result.sourcesScraped,
      durationMs: duration,
    });

    return NextResponse.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    console.error('[Admin] Manual scrape failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
