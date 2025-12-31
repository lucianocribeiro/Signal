/**
 * CRON Analysis Endpoint
 * Runs AI analysis for all active projects every hour at :30
 *
 * Schedule: "30 * * * *" (30 minutes after scraper runs)
 * This gives scraper time to collect data before analysis runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Use service role for CRON jobs (no user session)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    console.log('[CRON Analyze] === Starting analysis for all projects ===');

    // Verify CRON secret (Vercel sends this automatically for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow both Vercel CRON (no auth) and manual calls (with auth)
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const isAuthorized = authHeader === `Bearer ${cronSecret}`;

    if (!isVercelCron && !isAuthorized) {
      console.error('[CRON Analyze] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON Analyze] Authorization verified');

    const supabase = getServiceClient();

    // Get all active projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, owner_id')
      .eq('is_active', true);

    if (projectsError) {
      console.error('[CRON Analyze] Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      console.log('[CRON Analyze] No active projects found');
      return NextResponse.json({
        message: 'No active projects',
        analyzed: 0,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[CRON Analyze] Found ${projects.length} active projects`);

    const results = [];

    // Process each project
    for (const project of projects) {
      try {
        console.log(`[CRON Analyze] Processing project: ${project.name} (${project.id})`);

        // Call the analysis API internally
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        const response = await fetch(`${baseUrl}/api/analysis/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ projectId: project.id }),
        });

        const data = await response.json();

        results.push({
          projectId: project.id,
          projectName: project.name,
          success: response.ok,
          newSignals: data.new_signals?.count || 0,
          updatedSignals: data.momentum_updates?.count || 0,
          data: response.ok ? data : null,
          error: response.ok ? null : data.error,
        });

        if (response.ok) {
          console.log(`[CRON Analyze] ✓ Project ${project.name}: ${data.new_signals?.count || 0} new signals, ${data.momentum_updates?.count || 0} updated`);
        } else {
          console.error(`[CRON Analyze] ✗ Project ${project.name} failed:`, data.error);
        }

      } catch (error) {
        console.error(`[CRON Analyze] Error processing project ${project.id}:`, error);
        results.push({
          projectId: project.id,
          projectName: project.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalNewSignals = results.reduce((sum, r) => sum + (r.newSignals || 0), 0);
    const totalUpdated = results.reduce((sum, r) => sum + (r.updatedSignals || 0), 0);

    console.log(`[CRON Analyze] === Completed ===`);
    console.log(`[CRON Analyze] Success: ${successCount}, Failed: ${failCount}`);
    console.log(`[CRON Analyze] Total new signals: ${totalNewSignals}, Updated: ${totalUpdated}`);

    return NextResponse.json({
      message: 'Analysis complete',
      timestamp: new Date().toISOString(),
      totalProjects: projects.length,
      successful: successCount,
      failed: failCount,
      totalNewSignals,
      totalUpdated,
      results,
    });

  } catch (error) {
    console.error('[CRON Analyze] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
