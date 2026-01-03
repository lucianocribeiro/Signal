import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Get scrape results count and status
  const { data: scrapeResults, error } = await supabase
    .from('scrape_results')
    .select('id, url, platform, scraped_at, content')
    .order('scraped_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    total_results: scrapeResults?.length || 0,
    recent_scrapes: scrapeResults?.map(r => ({
      id: r.id,
      url: r.url,
      platform: r.platform,
      scraped_at: r.scraped_at,
      has_content: !!r.content,
      content_length: r.content?.length || 0
    }))
  });
}
