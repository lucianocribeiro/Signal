import { NextRequest, NextResponse } from 'next/server';
import { executeScrape } from '@/app/api/scrape/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

function getAuthError(request: NextRequest) {
  //TEMPORARY disable for local test
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

export async function GET(request: NextRequest) {
  const authError = getAuthError(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get('source_id') ?? undefined;

  const summary = await executeScrape(sourceId);

  return NextResponse.json({
    status: 'ok',
    ...summary,
  });
}
