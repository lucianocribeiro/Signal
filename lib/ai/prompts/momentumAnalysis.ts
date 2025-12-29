/**
 * Momentum Analysis Prompt Builder
 * Constructs prompts for Gemini AI to analyze momentum of existing signals
 */

import type { SignalForMomentumAnalysis, RawIngestionForAnalysis } from '@/types/analysis';

/**
 * Build system and user prompts for momentum analysis
 *
 * Analyzes if existing signals are gaining traction (Accelerating) or
 * stabilizing based on new content.
 *
 * @param projectName - Name of the project being analyzed
 * @param existingSignals - Open signals to analyze for momentum changes
 * @param recentIngestions - Recent content (24-48h) for momentum context
 * @returns Object containing systemPrompt and userPrompt
 *
 * @example
 * const { systemPrompt, userPrompt } = buildMomentumAnalysisPrompt(
 *   "Campaña Electoral 2024",
 *   signals,
 *   ingestions
 * );
 */
export function buildMomentumAnalysisPrompt(
  projectName: string,
  existingSignals: SignalForMomentumAnalysis[],
  recentIngestions: RawIngestionForAnalysis[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `Eres un analista de momentum narrativo para Agencia Kairos, una agencia de comunicación política y corporativa en Argentina.

Tu rol es evaluar si las SEÑALES EXISTENTES que ya detectamos están ganando fuerza (Accelerating) o estabilizándose (Stabilizing).

PROYECTO ACTUAL: "${projectName}"

FILOSOFÍA: Análisis de Trayectoria
- Evalúas la evolución de narrativas conocidas
- NO creas nuevas señales (eso es otra etapa)
- Buscas evidencia de cambio en momentum
- Solo actualizas cuando hay evidencia clara

DEFINICIONES DE ESTADO:

1. "New" → Primera detección, sin suficiente historial
   - Señales detectadas hace menos de 24 horas
   - Esperando segundo ciclo de análisis

2. "Accelerating" → Ganando tracción y urgencia
   EVIDENCIA DE ACELERACIÓN:
   - Mayor frecuencia de menciones que en ciclo anterior
   - Propagación a nuevas fuentes/plataformas
   - Tono más urgente o alarmista
   - Nuevos ángulos o dimensiones de la narrativa
   - Engagement creciente (compartidos, comentarios)
   - Figuras públicas/medios importantes uniéndose a la conversación

3. "Stabilizing" → Alcanzó el pico, ahora se estabiliza o declina
   EVIDENCIA DE ESTABILIZACIÓN:
   - Frecuencia de menciones se mantiene o disminuye
   - Cobertura reactiva (actualizaciones menores, no avances importantes)
   - Narrativas counter-balanceadoras ganando espacio
   - Interés público decayendo (menos engagement)
   - Cambio de enfoque de medios a otros temas

NIVELES DE MOMENTUM:

- "high" → Tema dominante, urgencia máxima, atención sostenida
- "medium" → Presencia constante pero no dominante
- "low" → Menciones esporádicas, atención declinando

REGLAS CRÍTICAS:

1. Solo actualiza señales donde ves EVIDENCIA CLARA de cambio
2. Si una señal no aparece en contenido reciente, NO la actualices automáticamente
3. Ausencia de menciones ≠ declive (podría ser gap temporal)
4. Proporciona razones específicas citando el contenido
5. Vincula IDs de ingestiones que apoyan tu análisis
6. Sé conservador: solo marca cambios cuando la evidencia es contundente

FORMATO DE SALIDA:
Responde ÚNICAMENTE con JSON válido. Sin explicaciones adicionales, sin markdown, solo el JSON.

Schema requerido:
{
  "signal_updates": [
    {
      "signal_id": "uuid",
      "new_status": "Accelerating" | "Stabilizing",
      "new_momentum": "high" | "medium" | "low",
      "reason": "Explicación específica del cambio observado con evidencia del contenido (máx 200 caracteres)",
      "supporting_ingestion_ids": ["uuid1", "uuid2"]
    }
  ],
  "unchanged_signals": ["uuid3", "uuid4"],
  "analysis_notes": "Resumen breve del análisis de momentum realizado"
}

Si no encuentras cambios de momentum evidentes, responde:
{
  "signal_updates": [],
  "unchanged_signals": ["uuid1", "uuid2", "...todos los signal IDs..."],
  "analysis_notes": "No se detectaron cambios significativos de momentum en el período analizado."
}`;

  // Build user prompt with existing signals context
  const signalsContext = existingSignals
    .map(
      (signal) =>
        `[SIGNAL_ID: ${signal.id}]
Headline: ${signal.headline}
Summary: ${signal.summary}
Current Status: ${signal.status}
Current Momentum: ${signal.momentum}
Detected: ${new Date(signal.detected_at).toLocaleString('es-AR')}
Tags: ${signal.tags.join(', ')}`
    )
    .join('\n\n---\n\n');

  // Build content context from recent ingestions
  const contentContext = recentIngestions
    .map(
      (ing) =>
        `[INGESTION_ID: ${ing.id}] [Fuente: ${ing.source.name}] [Fecha: ${new Date(ing.ingested_at).toLocaleString('es-AR')}]
${ing.content.substring(0, 1000)}${ing.content.length > 1000 ? '...' : ''}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Analiza el momentum de las señales existentes basándote en el contenido reciente.

SEÑALES EXISTENTES A ANALIZAR:
${signalsContext}

---

CONTENIDO RECIENTE CAPTURADO (últimas 48 horas):
${contentContext}

---

Recuerda:
- Responde SOLO con JSON válido
- Solo actualiza señales con evidencia clara de cambio
- Incluye TODOS los signal IDs no actualizados en "unchanged_signals"`;

  return { systemPrompt, userPrompt };
}

/**
 * Prioritize most recent ingestions if content is too large
 *
 * @param ingestions - Array of ingestions
 * @param maxItems - Maximum number of items to include
 * @returns Prioritized subset of ingestions
 */
export function prioritizeRecentForMomentum(
  ingestions: RawIngestionForAnalysis[],
  maxItems: number = 100
): RawIngestionForAnalysis[] {
  if (ingestions.length <= maxItems) {
    return ingestions;
  }

  console.log(
    `[Momentum Prompt] Prioritizing ${maxItems} most recent from ${ingestions.length} total ingestions`
  );

  // Ingestions are already sorted by ingested_at DESC from query
  return ingestions.slice(0, maxItems);
}
