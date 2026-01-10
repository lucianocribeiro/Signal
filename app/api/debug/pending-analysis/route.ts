import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data: stuck, error } = await supabase
      .from('raw_ingestions')
      .select('id, source_id, scraped_at, status, sources(url)')
      .eq('status', 'pending_analysis')
      .lt('scraped_at', twoMinutesAgo)
      .order('scraped_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      stuck_analyses: stuck?.length || 0,
      details: stuck,
      message: stuck?.length ? 'Found stuck analyses' : 'All analyses completed',
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check pending analyses' },
      { status: 500 }
    );
  }
}
