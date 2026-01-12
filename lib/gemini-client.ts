import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AnalysisSignal {
  title: string;
  category: string;
  risk_level: 'critico' | 'alto' | 'medio' | 'bajo';
  momentum: 'acelerando' | 'estable' | 'desacelerando';
  summary: string;
  key_points: string[];
  recommended_actions: string[];
  confidence_score: number;
}

export interface AnalysisResult {
  signals: AnalysisSignal[];
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
}

export async function analyzeContentWithGemini(params: {
  projectId: string;
  ingestionId: string;
  content: string;
  sourceType: 'news' | 'twitter' | 'reddit';
  sourceUrl: string;
}): Promise<AnalysisResult> {
  console.log(`[Gemini Analysis] Starting analysis for ingestion: ${params.ingestionId}`);
  console.log(`[Gemini Analysis] Source URL: ${params.sourceUrl}`);
  console.log(`[Gemini Analysis] Content length: ${params.content.length} chars`);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash-latest',
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildAnalysisPrompt(params.content, params.sourceType);

  try {
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const duration = Date.now() - startTime;
    console.log(`[Gemini Analysis] Completed in ${duration}ms`);

    const parsed = parseGeminiResponse(text);
    const estimated = estimateTokenCounts(params.content, text);
    const promptTokens = response.usageMetadata?.promptTokenCount ?? estimated.inputTokens;
    const completionTokens =
      response.usageMetadata?.candidatesTokenCount ?? estimated.outputTokens;
    const tokensUsed = promptTokens + completionTokens;

    console.log(`[Gemini Analysis] Found ${parsed.signals.length} signals`);
    console.log(`[Gemini Analysis] Tokens: ${tokensUsed} (prompt ${promptTokens}, completion ${completionTokens})`);

    return {
      signals: parsed.signals,
      tokensUsed,
      promptTokens,
      completionTokens,
    };
  } catch (error) {
    console.error('[Gemini Analysis] Error:', error);
    throw error;
  }
}

function buildAnalysisPrompt(content: string, sourceType: string): string {
  return `
Eres un analista político argentino experto en detectar narrativas emergentes.

Analiza el siguiente contenido de ${sourceType} y detecta SEÑALES NARRATIVAS (narrativas políticas emergentes o importantes).

CONTENIDO A ANALIZAR:
${content.slice(0, 8000)}

INSTRUCCIONES:
1. Identifica narrativas políticas relevantes (no eventos menores)
2. Para cada narrativa detectada, genera un objeto JSON con:
   - title: Título descriptivo de la narrativa (máx 100 caracteres)
   - category: Una de estas categorías (económica, política, social, internacional, seguridad, corrupción, electoral)
   - risk_level: Nivel de riesgo (critico, alto, medio, bajo)
   - momentum: Tendencia (acelerando, estable, desacelerando)
   - summary: Resumen ejecutivo de 2-3 oraciones
   - key_points: Array de 3-5 puntos clave
   - recommended_actions: Array de 2-3 acciones recomendadas
   - confidence_score: Confianza en la detección (0.0 a 1.0)

3. Si NO hay narrativas relevantes, devuelve un array vacío

FORMATO DE RESPUESTA (JSON estricto, sin markdown):
{
  "signals": [
    {
      "title": "...",
      "category": "...",
      "risk_level": "...",
      "momentum": "...",
      "summary": "...",
      "key_points": ["...", "..."],
      "recommended_actions": ["...", "..."],
      "confidence_score": 0.85
    }
  ]
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional antes o después.
`;
}

function parseGeminiResponse(text: string): { signals: AnalysisSignal[] } {
  try {
    let cleanText = text.trim();
    cleanText = cleanText.replace(/^```json\n?/, '');
    cleanText = cleanText.replace(/\n?```$/, '');
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);

    if (!parsed.signals || !Array.isArray(parsed.signals)) {
      console.warn('[Gemini Analysis] Invalid response structure, returning empty signals');
      return { signals: [] };
    }

    return parsed;
  } catch (error) {
    console.error('[Gemini Analysis] Failed to parse JSON response:', error);
    console.error('[Gemini Analysis] Raw response:', text);
    return { signals: [] };
  }
}

function estimateTokenCounts(inputContent: string, outputContent: string): {
  inputTokens: number;
  outputTokens: number;
} {
  const inputTokens = Math.ceil(inputContent.length / 4);
  const outputTokens = Math.ceil(outputContent.length / 4);

  return { inputTokens, outputTokens };
}
