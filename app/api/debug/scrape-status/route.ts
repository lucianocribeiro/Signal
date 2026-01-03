import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get raw ingestions with their source information
    const { data: ingestions, error } = await supabase
      .from('raw_ingestions')
      .select(`
        id,
        ingested_at,
        processed,
        raw_data,
        error_message,
        sources (
          id,
          name,
          url,
          source_type
        )
      `)
      .order('ingested_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[Debug API] Error fetching ingestions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      total_results: ingestions?.length || 0,
      recent_scrapes: ingestions?.map(r => ({
        id: r.id,
        url: r.sources?.url || 'N/A',
        platform: r.sources?.source_type || 'unknown',
        source_name: r.sources?.name || 'Unknown Source',
        scraped_at: r.ingested_at,
        has_content: !!r.raw_data && Object.keys(r.raw_data).length > 0,
        content_length: r.raw_data ? JSON.stringify(r.raw_data).length : 0,
        processed: r.processed,
        has_error: !!r.error_message,
        error_message: r.error_message
      }))
    });
  } catch (err) {
    console.error('[Debug API] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
