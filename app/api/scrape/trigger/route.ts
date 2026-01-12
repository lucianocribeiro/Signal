import { NextRequest, NextResponse } from 'next/server';
import { executeScrape } from '@/lib/scraper-executor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

function verifyCronAuth(request: NextRequest): { authorized: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret) {
    console.error('[CRON Trigger] CRON_SECRET not configured');
    return { authorized: false, error: 'Server configuration error' };
  }

  if (!authHeader) {
    console.error('[CRON Trigger] Missing authorization header');
    return { authorized: false, error: 'Unauthorized: No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== cronSecret) {
    console.error('[CRON Trigger] Invalid CRON secret');
    return { authorized: false, error: 'Unauthorized: Invalid token' };
  }

  return { authorized: true };
}

async function handleCronRequest(request: NextRequest) {
  console.log('[CRON Trigger] Automated scrape initiated...');

  const authResult = verifyCronAuth(request);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('source_id') ?? undefined;

  const summary = await executeScrape(sourceId);

  return NextResponse.json({
    status: 'ok',
    ...summary,
  });
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
