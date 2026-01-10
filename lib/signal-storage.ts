import { createServiceClient } from '@/lib/supabase/service';
import { linkEvidenceToSignal } from '@/lib/analysis/linkEvidence';
import type { AnalysisSignal } from '@/lib/gemini-client';

interface StoreSignalsParams {
  projectId: string;
  ingestionId: string;
  sourceUrl: string;
  sourceId?: string;
  signals: AnalysisSignal[];
}

function mapMomentum(value: AnalysisSignal['momentum']): 'high' | 'medium' | 'low' {
  if (value === 'acelerando') {
    return 'high';
  }
  if (value === 'desacelerando') {
    return 'low';
  }
  return 'medium';
}

function mapRiskLevel(value: AnalysisSignal['risk_level']): 'watch_closely' | 'monitor' {
  if (value === 'critico' || value === 'alto') {
    return 'watch_closely';
  }
  return 'monitor';
}

export async function storeSignals(params: StoreSignalsParams) {
  console.log(`[Signal Storage] Storing ${params.signals.length} signals`);

  if (params.signals.length === 0) {
    console.log('[Signal Storage] No signals to store');
    return { stored: 0, signals: [] };
  }

  const supabase = createServiceClient();
  const storedSignals: any[] = [];

  for (const signalData of params.signals) {
    try {
      const { data: signal, error: signalError } = await supabase
        .from('signals')
        .insert({
          project_id: params.projectId,
          source_id: params.sourceId ?? null,
          headline: signalData.title.substring(0, 100),
          summary: signalData.summary,
          key_points: signalData.key_points,
          status: 'New',
          momentum: mapMomentum(signalData.momentum),
          risk_level: mapRiskLevel(signalData.risk_level),
          tags: signalData.category ? [signalData.category] : [],
          source_url: params.sourceUrl,
          metadata: {
            category: signalData.category,
            recommended_actions: signalData.recommended_actions,
            confidence_score: signalData.confidence_score,
            original_risk_level: signalData.risk_level,
            original_momentum: signalData.momentum,
          },
          detected_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (signalError) {
        console.error('[Signal Storage] Error storing signal:', signalError);
        continue;
      }

      console.log(`[Signal Storage] Stored signal: ${signal.id} - ${signal.headline}`);

      const { errors } = await linkEvidenceToSignal(
        signal.id,
        [params.ingestionId],
        'detected',
        {
          confidence_score: signalData.confidence_score,
          source_url: params.sourceUrl,
        }
      );

      if (errors.length > 0) {
        console.error('[Signal Storage] Error linking evidence:', errors);
      } else {
        console.log(`[Signal Storage] Linked evidence for signal: ${signal.id}`);
      }

      storedSignals.push(signal);
    } catch (error) {
      console.error('[Signal Storage] Unexpected error:', error);
    }
  }

  console.log(
    `[Signal Storage] Successfully stored ${storedSignals.length}/${params.signals.length} signals`
  );

  return {
    stored: storedSignals.length,
    signals: storedSignals,
  };
}
