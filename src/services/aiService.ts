import type { UploadedAttachment } from '../types/casm';

export interface AiGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  attachments?: UploadedAttachment[];
  expectJson?: boolean;
}

export async function callGeminiAi(options: AiGenerateOptions): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'Sin conexión a internet. Puedes seguir editando, guardando y exportando documentos locales, pero la generación con IA requiere conexión.'
    );
  }

  const multimodalParts: Array<{ mimeType: string; data: string; name?: string }> = [];
  const extractedTexts: string[] = [];

  for (const att of options.attachments || []) {
    if ((att.kind === 'image' || att.kind === 'pdf') && att.base64) {
      multimodalParts.push({
        mimeType: att.mimeType,
        data: att.base64,
        name: att.name,
      });
    } else if (att.extractedText) {
      extractedTexts.push(`=== Archivo adjunto: ${att.name} ===\n${att.extractedText}`);
    }
  }

  const combinedPrompt =
    extractedTexts.length > 0
      ? `${options.userPrompt}\n\n--- CONTENIDO EXTRAÍDO DE ARCHIVOS ADJUNTOS ---\n${extractedTexts.join('\n\n')}`
      : options.userPrompt;

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: options.systemPrompt,
      userPrompt: combinedPrompt,
      attachments: multimodalParts,
      expectJson: options.expectJson ?? false,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };

  if (!response.ok) {
    if (
      response.status === 503 ||
      (payload.error && payload.error.includes('GEMINI_API_KEY'))
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('casm-missing-api-key'));
      }
    }
    throw new Error(
      payload.error ||
        `Error del servidor de IA (código ${response.status}). Intenta de nuevo en unos momentos.`
    );
  }

  if (!payload.text) {
    throw new Error('La IA devolvió una respuesta vacía. Intenta añadir más información.');
  }

  return payload.text;
}

export async function checkGeminiKeyStatus(): Promise<{ hasKey: boolean; model: string }> {
  try {
    const res = await fetch('/api/config/key-status');
    if (res.ok) {
      return (await res.json()) as { hasKey: boolean; model: string };
    }
  } catch {}
  return { hasKey: false, model: 'gemini-2.5-flash' };
}

export async function saveGeminiApiKey(
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch('/api/config/save-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, model }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo guardar la clave de API.');
  }
  return { ok: true, message: data.message };
}

export function parseAiJsonResponse<T>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fallback: extract first JSON object or array block
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1)) as T;
    }
    throw new Error(
      'La respuesta de la IA no tuvo el formato estructurado esperado. Intenta generar nuevamente.'
    );
  }
}
