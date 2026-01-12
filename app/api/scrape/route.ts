import { NextRequest, NextResponse } from 'next/server';
import { executeScrape } from '@/lib/scraper-executor';

export const dynamic = 'force-dynamic';
const maxDuration = 300;
const runtime = 'nodejs';

function getAuthError(request: NextRequest) {
  const secret = process.env.SCRAPER_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret) {
    return 'SCRAPER_SECRET is not configured';
  }

  if (authHeader !== `Bearer ${secret}`) {
    return 'Unauthorized';
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authError = getAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  let sourceId: string | undefined;

  try {
    const body = await request.json();
    sourceId = body?.source_id;
  } catch (error) {
    console.warn('[Scrape] No JSON body provided, defaulting to all sources');
  }

  const summary = await executeScrape(sourceId);
  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  const authError = getAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('source_id') ?? undefined;
  const summary = await executeScrape(sourceId);

  return NextResponse.json(summary);
}
