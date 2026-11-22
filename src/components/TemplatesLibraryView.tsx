import React, { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Loader2, Trash2, Upload } from 'lucide-react';
import type { ExtractedTemplate, ModuleId } from '../types/casm';
import { deleteTemplate, getAllTemplates, saveTemplate } from '../db/indexedDb';
import { parseUploadedFile } from '../utils/fileReader';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildTemplateExtractionPrompt } from '../prompts/modulePrompts';
import { MODULE_LABELS } from './HistoryView';

export const TemplatesLibraryView: React.FC = () => {
  const [templates, setTemplates] = useState<ExtractedTemplate[]>([]);
  const [targetModule, setTargetModule] = useState<ModuleId>('planificacion');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    const list = await getAllTemplates();
    setTemplates(list);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const parsed = await parseUploadedFile(file);
      const { systemPrompt, userPrompt } = buildTemplateExtractionPrompt(
        targetModule,
        MODULE_LABELS[targetModule]
      );
      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments: [parsed],
        expectJson: true,
      });
      const extracted = parseAiJsonResponse<Omit<ExtractedTemplate, 'id' | 'module' | 'createdAt'>>(raw);
      await saveTemplate({
        id: `tpl-${Date.now()}`,
        module: targetModule,
        name: extracted.name || file.name.replace(/\.[^.]+$/, ''),
        gradeLevel: extracted.gradeLevel || 'General',
        orientation: extracted.orientation === 'landscape' ? 'landscape' : 'portrait',
        pageSize: extracted.pageSize === 'oficio' ? 'oficio' : 'letter',
        sections: Array.isArray(extracted.sections) ? extracted.sections : [],
        styleNotes: extracted.styleNotes || '',
        rawInstructions: extracted.rawInstructions || '',
        createdAt: new Date().toISOString(),
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo extraer la plantilla del archivo.');
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#003366] tracking-tight">
          Biblioteca Global de Formatos y Plantillas
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Sube tus formatos modelo en DOCX, PDF o fotografía. Gemini extrae su estructura exacta (secciones, tablas y campos) y la guarda para reutilizarla por grado o nivel.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end gap-3 shadow-xs">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Módulo al que pertenece el formato modelo
          </label>
          <select
            value={targetModule}
            onChange={(e) => setTargetModule(e.target.value as ModuleId)}
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {(Object.keys(MODULE_LABELS) as ModuleId[]).map((m) => (
              <option key={m} value={m}>
                {MODULE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.pdf,image/*"
            onChange={(e) => void handleUpload(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            disabled={extracting}
            onClick={() => fileRef.current?.click()}
            className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-[#003366] hover:bg-[#00254a] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{extracting ? 'Extrayendo estructura con IA...' : 'Subir formato modelo'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <LayoutTemplate className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Aún no has subido formatos personalizados</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Todos los módulos ya incluyen el formato oficial de CASM. Sube un archivo modelo arriba cuando desees guardar variaciones por grado, nivel o coordinación.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">
                    {MODULE_LABELS[tpl.module]} · {tpl.gradeLevel} ·{' '}
                    {tpl.orientation === 'landscape' ? 'Horizontal' : 'Vertical'} ({tpl.pageSize})
                  </div>
                  <h3 className="text-sm font-bold text-[#003366] mt-0.5">{tpl.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteTemplate(tpl.id).then(loadAll)}
                  className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                  aria-label="Eliminar plantilla"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {tpl.sections.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">Secciones detectadas:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {tpl.sections.slice(0, 6).map((s, idx) => (
                      <li key={idx}>
                        <strong>{s.title}</strong> ({s.type})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tpl.styleNotes && (
                <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                  {tpl.styleNotes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
