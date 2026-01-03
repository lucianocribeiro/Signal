import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Get recent ingestion results with source info
  const { data: ingestions, error: ingestError } = await supabase
    .from('ingestion_results')
    .select(`
      id,
      ingested_at,
      content,
      sources (
        id,
        url,
        name,
        source_type
      )
    `)
    .order('ingested_at', { ascending: false })
    .limit(10);

  if (ingestError) {
    return NextResponse.json({
      error: ingestError.message,
      total_results: 0,
      recent_scrapes: []
    }, { status: 500 });
  }

  // Get signals count
  const { count: signalsCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    total_ingestions: ingestions?.length || 0,
    total_signals: signalsCount || 0,
    recent_scrapes: ingestions?.map(r => {
      // Handle sources - it might be an array or object depending on query
      const source = Array.isArray(r.sources) ? r.sources[0] : r.sources;

      return {
        id: r.id,
        url: source?.url || 'N/A',
        platform: source?.source_type || 'unknown',
        source_name: source?.name || 'Unknown Source',
        scraped_at: r.ingested_at,
        has_content: !!r.content,
        content_length: r.content?.length || 0,
        content_preview: r.content?.substring(0, 100) || 'No content'
      };
    }) || []
  });
}
