/**
 * Cron Job Health Check Endpoint
 * Provides status information about scheduled scraping
 * No authentication required - public health check
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/**
 * Health status type
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * GET handler - Returns cron job health information
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Get recent scraper logs (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const { data: recentLogs, error: logsError } = await supabase
      .from('scraper_logs')
      .select('started_at, completed_at, status, items_processed, execution_time_ms')
      .gte('started_at', oneDayAgo.toISOString())
      .order('started_at', { ascending: false })
      .limit(10);

    if (logsError) {
      console.error('[Status] Error fetching scraper logs:', logsError);
    }

    // Get project statistics
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, settings, is_active')
      .eq('is_active', true);

    if (projectsError) {
      console.error('[Status] Error fetching projects:', projectsError);
    }

    // Count projects by interval
    const projectsByInterval = {
      '2h': 0,
      '4h': 0,
      '8h': 0,
      '12h': 0,
    };

    (projects || []).forEach((project: any) => {
      const interval = project.settings?.refresh_interval_hours || 4;
      const key = `${interval}h` as keyof typeof projectsByInterval;
      if (key in projectsByInterval) {
        projectsByInterval[key]++;
      }
    });

    // Get last execution from logs
    const lastLog = recentLogs?.[0];
    const lastExecution = lastLog ? {
      timestamp: lastLog.started_at,
      projectsScraped: 1, // We don't have project count in logs, estimate
      success: lastLog.status === 'completed',
      itemsProcessed: lastLog.items_processed || 0,
      executionTimeMs: lastLog.execution_time_ms || 0,
    } : null;

    // Calculate next execution (hourly cron at :00)
    const now = new Date();
    const nextExecution = new Date(now);
    nextExecution.setHours(nextExecution.getHours() + 1);
    nextExecution.setMinutes(0);
    nextExecution.setSeconds(0);
    nextExecution.setMilliseconds(0);

    // Determine health status
    let status: HealthStatus = 'healthy';
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    if (!lastExecution) {
      status = 'unhealthy'; // No executions found
    } else if (new Date(lastExecution.timestamp) < twoHoursAgo) {
      status = 'degraded'; // Last execution more than 2 hours ago
    } else if (!lastExecution.success) {
      status = 'degraded'; // Last execution failed
    }

    // Format recent executions
    const recentExecutions = (recentLogs || []).slice(0, 5).map((log: any) => ({
      timestamp: log.started_at,
      duration: log.execution_time_ms || 0,
      projectsScraped: 1, // Estimate
      sourcesScraped: log.items_processed || 0,
      success: log.status === 'completed',
    }));

    // Build response
    const response = {
      status,
      lastExecution,
      nextExecution: nextExecution.toISOString(),
      recentExecutions,
      configuration: {
        cronSecretConfigured: !!process.env.CRON_SECRET,
        activeProjects: (projects || []).length,
        projectsByInterval,
      },
      system: {
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL ? 'production' : 'development',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Status] Error generating health check:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
