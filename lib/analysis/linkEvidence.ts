/**
 * Evidence Linking Utilities
 * Epic 4 Story 4.4: Link Evidence (Raw Data) to Signals
 *
 * Manages the many-to-many relationship between signals and raw_ingestions.
 * Each signal can be supported by multiple raw ingestions (evidence), and
 * each raw ingestion can support multiple signals.
 */

import { createClient } from '@/lib/supabase/server';

export type EvidenceLinkType = 'detected' | 'momentum' | 'manual';

export interface SignalEvidenceRecord {
  id: string;
  signal_id: string;
  raw_ingestion_id: string;
  reference_type: EvidenceLinkType;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface SignalEvidenceWithDetails {
  reference_id: string;
  reference_type: EvidenceLinkType;
  linked_at: string;
  ingestion: {
    id: string;
    content: string;
    url: string;
    ingested_at: string;
    source: {
      id: string;
      name: string;
      platform: string;
    };
  };
}

export interface IngestionSignal {
  signal_id: string;
  headline: string;
  reference_type: EvidenceLinkType;
}

/**
 * Links raw ingestion evidence to a signal
 * Handles duplicates by ignoring conflicts (upsert behavior)
 *
 * @param signalId - UUID of the signal
 * @param ingestionIds - Array of raw_ingestion UUIDs to link as evidence
 * @param linkType - Type of evidence link: 'detected', 'momentum', or 'manual'
 * @param metadata - Optional metadata about why/when evidence was linked
 * @returns Object with count of linked items and any errors
 */
export async function linkEvidenceToSignal(
  signalId: string,
  ingestionIds: string[],
  linkType: EvidenceLinkType,
  metadata?: Record<string, unknown>
): Promise<{ linked: number; errors: string[] }> {
  const supabase = await createClient();
  const errors: string[] = [];
  let linked = 0;

  console.log(`[Link Evidence] Linking ${ingestionIds.length} ingestions to signal ${signalId} as '${linkType}'`);

  // Filter out empty or invalid IDs
  const validIds = ingestionIds.filter(id => id && id.trim().length > 0);

  if (validIds.length === 0) {
    console.log('[Link Evidence] No valid ingestion IDs to link');
    return { linked: 0, errors: [] };
  }

  // Batch insert with conflict handling
  const references = validIds.map(ingestionId => ({
    signal_id: signalId,
    raw_ingestion_id: ingestionId,
    reference_type: linkType,
    metadata: metadata || {},
  }));

  const { data, error } = await supabase
    .from('signal_evidence')
    .upsert(references, {
      onConflict: 'signal_id,raw_ingestion_id',
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    const errorMsg = `Failed to link evidence: ${error.message}`;
    console.error('[Link Evidence] Error:', errorMsg);
    errors.push(errorMsg);
  } else {
    linked = data?.length || 0;
    console.log(`[Link Evidence] Successfully linked ${linked} evidence items`);
  }

  return { linked, errors };
}

/**
 * Gets all evidence (raw ingestions) linked to a signal
 * Includes full ingestion content and source information
 *
 * @param signalId - UUID of the signal
 * @returns Array of evidence with full details
 */
export async function getSignalEvidence(signalId: string): Promise<SignalEvidenceWithDetails[]> {
  const supabase = await createClient();

  console.log(`[Get Signal Evidence] Fetching evidence for signal ${signalId}`);

  const { data, error } = await supabase
    .from('signal_evidence')
    .select(`
      id,
      reference_type,
      created_at,
      raw_ingestions (
        id,
        content,
        url,
        ingested_at,
        sources (
          id,
          name,
          platform
        )
      )
    `)
    .eq('signal_id', signalId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Get Signal Evidence] Error fetching evidence:', error);
    return [];
  }

  console.log(`[Get Signal Evidence] Found ${data?.length || 0} evidence items`);

  return (data || []).map(ref => ({
    reference_id: ref.id,
    reference_type: ref.reference_type as EvidenceLinkType,
    linked_at: ref.created_at,
    ingestion: {
      id: (ref.raw_ingestions as any).id,
      content: (ref.raw_ingestions as any).content,
      url: (ref.raw_ingestions as any).url,
      ingested_at: (ref.raw_ingestions as any).ingested_at,
      source: {
        id: (ref.raw_ingestions as any).sources.id,
        name: (ref.raw_ingestions as any).sources.name,
        platform: (ref.raw_ingestions as any).sources.platform,
      },
    },
  }));
}

/**
 * Gets all signals that reference a specific ingestion
 * Useful for understanding the impact of a single piece of content
 *
 * @param ingestionId - UUID of the raw ingestion
 * @returns Array of signals that reference this ingestion
 */
export async function getIngestionSignals(ingestionId: string): Promise<IngestionSignal[]> {
  const supabase = await createClient();

  console.log(`[Get Ingestion Signals] Fetching signals for ingestion ${ingestionId}`);

  const { data, error } = await supabase
    .from('signal_evidence')
    .select(`
      reference_type,
      signals (
        id,
        headline
      )
    `)
    .eq('raw_ingestion_id', ingestionId);

  if (error) {
    console.error('[Get Ingestion Signals] Error fetching signals:', error);
    return [];
  }

  console.log(`[Get Ingestion Signals] Found ${data?.length || 0} signals`);

  return (data || []).map(ref => ({
    signal_id: (ref.signals as any).id,
    headline: (ref.signals as any).headline,
    reference_type: ref.reference_type as EvidenceLinkType,
  }));
}
