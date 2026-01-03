import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Get recent raw ingestions
  const { data: ingestions, error: ingestError } = await supabase
    .from('raw_ingestions')
    .select(`
      id,
      source_id,
      raw_data,
      ingested_at,
      processed,
      processed_at,
      error_message,
      metadata,
      sources (
        id,
        url,
        name,
        source_type
      )
    `)
    .order('ingested_at', { ascending: false })
    .limit(20);

  if (ingestError) {
    return NextResponse.json(
      {
        error: ingestError.message,
        total_results: 0,
      },
      { status: 500 }
    );
  }

  // Get counts
  const { count: totalCount } = await supabase
    .from('raw_ingestions')
    .select('*', { count: 'exact', head: true });

  const { count: unprocessedCount } = await supabase
    .from('raw_ingestions')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);

  const { count: signalsCount } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true });

  const { count: sourcesCount } = await supabase
    .from('sources')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    database_status: {
      total_ingestions: totalCount || 0,
      unprocessed_ingestions: unprocessedCount || 0,
      total_signals: signalsCount || 0,
      total_sources: sourcesCount || 0,
    },
    recent_ingestions:
      ingestions?.map((r) => {
        const source = r.sources as any;
        const rawData = r.raw_data as any;

        return {
          id: r.id,
          source_id: r.source_id,
          url: source?.url || 'N/A',
          platform: source?.source_type || 'unknown',
          source_name: source?.name || 'Unknown',
          ingested_at: r.ingested_at,
          processed: r.processed,
          processed_at: r.processed_at,
          has_error: !!r.error_message,
          error_message: r.error_message || null,
          raw_data_keys: rawData ? Object.keys(rawData) : [],
          raw_data_preview: rawData
            ? JSON.stringify(rawData).substring(0, 200)
            : 'No data',
        };
      }) || [],
  });
}
