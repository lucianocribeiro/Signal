/**
 * Cron Job API Endpoint
 * Triggered by Vercel Cron to execute scheduled scraping
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeCronScrape } from '@/lib/scraper/cron';

// Environment variable validation at module load time
if (!process.env.CRON_SECRET) {
  console.error('[Cron] FATAL: CRON_SECRET environment variable is not set');
}

// Force dynamic rendering and set max duration
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Verify cron authentication
 * Uses defense-in-depth approach with CRON_SECRET and optional Vercel headers
 */
function verifyCronAuth(request: NextRequest): { authorized: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  // Check 1: CRON_SECRET (required)
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return { authorized: false, error: 'Server misconfigured' };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron] Invalid authorization header');
    return { authorized: false, error: 'Unauthorized' };
  }

  // Check 2: Vercel cron header (optional, for additional security in production)
  const vercelCronId = request.headers.get('x-vercel-cron-id');
  if (process.env.VERCEL && !vercelCronId) {
    console.warn('[Cron] Missing Vercel cron header in production');
    // Don't fail - allows manual testing with CRON_SECRET
  }

  return { authorized: true };
}

/**
 * Handle cron request (shared by GET and POST)
 */
async function handleCronRequest(request: NextRequest) {
  const startTime = Date.now();

  // Verify authentication
  const authResult = verifyCronAuth(request);
  if (!authResult.authorized) {
    console.warn('[Cron] Unauthorized request attempt');
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[Cron] Authorized request received, starting execution...');

    // Execute cron scrape
    const result = await executeCronScrape();

    const duration = Date.now() - startTime;

    console.log('[Cron] Execution complete:', {
      success: result.success,
      projectsRefreshed: result.projectsRefreshed,
      sourcesScraped: result.sourcesScraped,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: result.errors.length,
      durationMs: duration,
    });

    // Log to audit_logs table
    // Note: This requires the audit_logs table to exist
    // If it doesn't exist yet, this will silently fail
    try {
      const { createServiceClient } = await import('@/lib/supabase/service');
      const supabase = createServiceClient();

      await supabase.from('audit_logs').insert({
        user_id: null, // System action
        action: 'cron_scrape_executed',
        resource_type: 'cron',
        resource_id: null,
        changes: {
          projectsRefreshed: result.projectsRefreshed,
          sourcesScraped: result.sourcesScraped,
          duplicatesSkipped: result.duplicatesSkipped,
          errors: result.errors.length,
          durationMs: duration,
          timestamp: result.timestamp,
        },
      });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.warn('[Cron] Failed to log to audit_logs (table may not exist):', auditError);
    }

    // Return success with execution results
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    console.error('[Cron] Fatal error during execution:', error);

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

/**
 * GET handler - Primary endpoint for Vercel Cron
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

/**
 * POST handler - Semantic correctness for manual triggers
 */
export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
