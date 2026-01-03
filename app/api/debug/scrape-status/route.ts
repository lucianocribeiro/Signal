import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Get recent raw ingestions (scraped content)
  const { data: ingestions, error: ingestError } = await supabase
    .from('raw_ingestions')
    .select(`
      id,
      source_id,
      content,
      ingested_at,
      metadata,
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

  // Get counts from all relevant tables
  const { count: ingestionsCount } = await supabase
    .from('raw_ingestions')
    .select('*', { count: 'exact', head: true });

  const { count: signalsCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true });

  const { count: sourcesCount } = await supabase
    .from('sources')
    .select('*', { count: 'exact', head: true });

  const { count: evidenceCount } = await supabase
    .from('signal_evidence')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    database_status: {
      total_raw_ingestions: ingestionsCount || 0,
      total_signals: signalsCount || 0,
      total_sources: sourcesCount || 0,
      total_evidence_links: evidenceCount || 0
    },
    recent_scrapes: ingestions?.map(r => {
      const source = r.sources as any;
      return {
        id: r.id,
        source_id: r.source_id,
        url: source?.url || 'N/A',
        platform: source?.source_type || 'unknown',
        source_name: source?.name || 'Unknown',
        ingested_at: r.ingested_at,
        has_content: !!r.content,
        content_length: r.content?.length || 0,
        content_preview: r.content?.substring(0, 200) || 'No content',
        metadata: r.metadata || null
      };
    }) || []
  });
}
