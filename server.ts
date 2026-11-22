import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function createGeminiClient(customKey?: string) {
  const apiKey = (customKey && customKey.trim()) || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
  });
}

interface AttachmentPayload {
  mimeType: string;
  data: string;
  name?: string;
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message:
        'La clave de API de Gemini no es válida o no tiene permisos. Verifica la configuración en el panel de secretos.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Se alcanzó el límite temporal de solicitudes de la API de Gemini. Espera unos segundos e intenta nuevamente.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'El modelo de IA solicitado no se encuentra disponible temporalmente.',
    };
  }
  if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('network')) {
    return {
      status: 503,
      message: 'No fue posible conectar con el servicio de IA. Revisa tu conexión a internet.',
    };
  }
  return {
    status: 500,
    message: 'Ocurrió un error al procesar el documento con IA. Intenta de nuevo o reduce el tamaño de los archivos adjuntos.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '45mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: process.env.GEMINI_MODEL || DEFAULT_MODEL });
  });

  app.get('/api/config/key-status', (_req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    res.json({
      hasKey,
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    });
  });

  app.post('/api/config/save-key', async (req, res) => {
    try {
      const { apiKey, model } = req.body as { apiKey?: string; model?: string };
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        res.status(400).json({ error: 'La clave de API no puede estar vacía.' });
        return;
      }
      const cleanKey = apiKey.trim();
      process.env.GEMINI_API_KEY = cleanKey;
      if (model && typeof model === 'string' && model.trim()) {
        process.env.GEMINI_MODEL = model.trim();
      }

      const envPath = path.resolve(__dirname, '.env');
      const content = `GEMINI_API_KEY="${cleanKey}"\nGEMINI_MODEL="${process.env.GEMINI_MODEL || DEFAULT_MODEL}"\nPORT=${PORT}\n`;
      await fs.promises.writeFile(envPath, content, 'utf-8');

      res.json({ ok: true, message: 'Clave de Gemini API guardada y activada con éxito.' });
    } catch (err) {
      res.status(500).json({ error: 'Error al guardar la clave en el archivo .env' });
    }
  });

  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { systemPrompt, userPrompt, attachments, expectJson, apiKey: reqApiKey } = req.body as {
        systemPrompt?: unknown;
        userPrompt?: unknown;
        attachments?: unknown;
        expectJson?: unknown;
        apiKey?: string;
      };

      const customKey = (reqApiKey || req.headers['x-gemini-api-key'] || '') as string;
      const ai = createGeminiClient(customKey);
      if (!ai) {
        res.status(503).json({
          error:
            'El servicio de IA no tiene configurada la clave GEMINI_API_KEY en el servidor. Puedes obtenerla gratis en https://aistudio.google.com/app/apikey e ingresarla en el botón "Clave IA" en el encabezado.',
        });
        return;
      }

      if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
        res.status(400).json({ error: 'Debes proporcionar instrucciones o contenido para generar el documento.' });
        return;
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (Array.isArray(attachments)) {
        for (const item of attachments.slice(0, 12)) {
          const att = item as Partial<AttachmentPayload>;
          if (
            typeof att?.mimeType === 'string' &&
            typeof att?.data === 'string' &&
            ALLOWED_MIME_TYPES.has(att.mimeType.toLowerCase()) &&
            att.data.length > 0 &&
            att.data.length < 25 * 1024 * 1024
          ) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : att.mimeType.toLowerCase(),
                data: att.data,
              },
            });
          }
        }
      }

      parts.push({ text: userPrompt });

      const config: {
        systemInstruction?: string;
        responseMimeType?: string;
      } = {};

      if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
        config.systemInstruction = systemPrompt;
      }
      if (expectJson === true) {
        config.responseMimeType = 'application/json';
      }

      const targetModels = Array.from(
        new Set([
          process.env.GEMINI_MODEL,
          DEFAULT_MODEL,
          'gemini-3.1-flash-lite',
          'gemini-3.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-3.8-flash',
        ].filter(Boolean) as string[])
      );

      let response: any = null;
      let lastError: unknown = null;

      for (const modelToTry of targetModels) {
        try {
          console.log(`[AI] Intentando generar con modelo ${modelToTry}...`);
          response = await ai.models.generateContent({
            model: modelToTry,
            contents: { parts },
            config,
          });
          if (response?.text) {
            console.log(`[AI] Éxito con ${modelToTry}`);
            break;
          }
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
          console.warn(`[AI] Error temporal con ${modelToTry}:`, msg.slice(0, 120));
          if (
            msg.includes('not_found') ||
            msg.includes('404') ||
            msg.includes('unsupported') ||
            msg.includes('not found') ||
            msg.includes('503') ||
            msg.includes('high demand')
          ) {
            continue;
          }
          throw err;
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      const text = response?.text ?? '';
      if (!text.trim()) {
        res.status(502).json({
          error: 'La IA no devolvió contenido utilizable. Intenta proporcionar más detalle o una imagen más nítida.',
        });
        return;
      }

      res.json({ text });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Serve static assets and singlefile bundle directly
  app.get(['/CASM_Docente_Prueba.html', '/Asistente_Docente.html'], (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'CASM_Docente_Prueba.html'));
  });
  app.use('/assets', express.static(path.resolve(__dirname, 'dist/assets')));
  app.use('/assets', express.static(path.resolve(__dirname, 'public/assets')));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Asistente Docente server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
