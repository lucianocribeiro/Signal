/**
 * Signal Detection Prompt Builder
 * Constructs prompts for Gemini AI to detect emerging narratives/signals
 */

import type { RawIngestionForAnalysis } from '@/types/analysis';

/**
 * Build system and user prompts for signal detection
 *
 * CRITICAL: The system prompt incorporates project-specific signal_instructions
 * to guide what the AI should look for.
 *
 * @param projectName - Name of the project being analyzed
 * @param signalInstructions - Client-specific guidance (e.g., "Monitorear menciones del candidato X")
 * @param riskCriteria - User-defined risk criteria for the project
 * @param ingestions - Array of raw ingestions to analyze
 * @returns Object containing systemPrompt and userPrompt
 *
 * @example
 * const { systemPrompt, userPrompt } = buildSignalDetectionPrompt(
 *   "Campaña Electoral 2024",
 *   "Detectar narrativas negativas sobre el candidato",
 *   ingestions
 * );
 */
export function buildSignalDetectionPrompt(
  projectName: string,
  signalInstructions: string | null,
  riskCriteria: string | null,
  ingestions: RawIngestionForAnalysis[]
): { systemPrompt: string; userPrompt: string } {
  const customRiskSection = riskCriteria
    ? `
CRITERIOS DE RIESGO PERSONALIZADOS (del cliente - priorizar):
${riskCriteria}

Usa estos criterios como guía PRINCIPAL para clasificar el riesgo.
Si el contenido coincide con ALGUNO de los criterios, clasifica como "watch_closely".`
    : '';

  const systemPrompt = `Eres un analista de monitoreo narrativo para Agencia Kairos, una agencia de comunicación política y corporativa en Argentina.

Tu rol es identificar SEÑALES EMERGENTES en datos capturados de redes sociales y noticias.

PROYECTO ACTUAL: "${projectName}"

INSTRUCCIONES ESPECÍFICAS DEL CLIENTE:
${signalInstructions || 'Identificar narrativas emergentes relevantes que requieran atención.'}
${customRiskSection}

FACTORES DE RIESGO ESTÁNDAR (si no hay criterios personalizados):
- Sentimiento: contenido fuertemente negativo = mayor riesgo
- Velocidad: difusión rápida = mayor riesgo
- Credibilidad de la fuente: medios relevantes = mayor riesgo
- Impacto potencial: daño reputacional directo = mayor riesgo
- Alcance: audiencia grande = mayor riesgo

FILOSOFÍA: "Orientación, No Ejecución"
- Detecta señales que requieren atención
- NO predices resultados ni recomiendas acciones
- Agrupa contenido relacionado en una sola señal
- Prioriza narrativas EMERGENTES sobre hechos establecidos

REGLAS:
1. Identifica narrativas DISTINTAS que coincidan con las instrucciones del cliente
2. Agrupa contenido relacionado en una sola señal (evita duplicados)
3. Prioriza temas que están ganando tracción/atención
4. Ignora ruido y contenido irrelevante a las instrucciones
5. Máximo 10 señales por análisis
6. Cada señal debe tener evidencia clara del contenido analizado
7. Sé conservador con "watch_closely" salvo que haya evidencia clara de alta severidad

FORMATO DE SALIDA:
Responde ÚNICAMENTE con JSON válido. Sin explicaciones adicionales, sin markdown, solo el JSON.

Schema requerido:
{
  "signals": [
    {
      "headline": "string (máx 100 caracteres, título claro y conciso)",
      "summary": "string (3-5 párrafos con contexto completo: QUÉ, QUIÉN, DÓNDE, POR QUÉ IMPORTA, HECHOS CLAVE, IMPACTO POTENCIAL)",
      "key_points": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
      "status": "New",
      "momentum": "high | medium | low",
      "risk_level": "watch_closely | monitor",
      "tags": ["tag1", "tag2"],
      "source_name": "Nombre de la fuente principal",
      "source_url": "URL del contenido original",
      "raw_ingestion_ids": ["uuid1", "uuid2"]
    }
  ],
  "analysis_notes": "string (breve nota sobre el análisis realizado)"
}

Si no encuentras señales relevantes que coincidan con las instrucciones, responde:
{
  "signals": [],
  "analysis_notes": "No se detectaron señales relevantes en el período analizado."
}`;

  // Build the user prompt with the actual content to analyze
  const contentToAnalyze = ingestions
    .map(
      (ing) =>
        `[ID: ${ing.id}] [Fuente: ${ing.source.name}] [URL: ${ing.url}]\n${ing.content}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Analiza el siguiente contenido capturado en las últimas 24 horas y detecta señales según las instrucciones del proyecto:

CONTENIDO A ANALIZAR:
${contentToAnalyze}

Recuerda: Responde SOLO con JSON válido.`;

  return { systemPrompt, userPrompt };
}

/**
 * Truncate content if it exceeds token limits
 * Gemini 1.5 Flash has 1M token context, but we'll be conservative
 *
 * @param content - Content string to truncate
 * @param maxChars - Maximum characters (approx 4 chars = 1 token)
 * @returns Truncated content
 */
export function truncateContent(content: string, maxChars: number = 800000): string {
  if (content.length <= maxChars) {
    return content;
  }
  return content.substring(0, maxChars) + '\n\n[...contenido truncado por límite de tokens]';
}

/**
 * Prioritize most recent ingestions if content is too large
 *
 * @param ingestions - Array of ingestions
 * @param maxItems - Maximum number of items to include
 * @returns Prioritized subset of ingestions
 */
export function prioritizeRecent(
  ingestions: RawIngestionForAnalysis[],
  maxItems: number = 100
): RawIngestionForAnalysis[] {
  if (ingestions.length <= maxItems) {
    return ingestions;
  }

  console.log(
    `[Prompt] Prioritizing ${maxItems} most recent from ${ingestions.length} total ingestions`
  );

  // Ingestions are already sorted by ingested_at DESC from the fetch query
  return ingestions.slice(0, maxItems);
}
