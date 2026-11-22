import React, { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Loader2, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import type { ExtractedTemplate, ModuleId } from '../types/casm';
import { deleteTemplate, getTemplatesByModule, saveTemplate } from '../db/indexedDb';
import { parseUploadedFile } from '../utils/fileReader';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildTemplateExtractionPrompt } from '../prompts/modulePrompts';

interface ModuleTemplatePickerProps {
  moduleId: ModuleId;
  moduleLabel: string;
  selectedTemplate: ExtractedTemplate | null;
  onSelectTemplate: (tpl: ExtractedTemplate | null) => void;
}

export const ModuleTemplatePicker: React.FC<ModuleTemplatePickerProps> = ({
  moduleId,
  moduleLabel,
  selectedTemplate,
  onSelectTemplate,
}) => {
  const [templates, setTemplates] = useState<ExtractedTemplate[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadList = async () => {
    const list = await getTemplatesByModule(moduleId);
    setTemplates(list);
  };

  useEffect(() => {
    void loadList();
  }, [moduleId]);

  const handleUploadTemplate = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const parsed = await parseUploadedFile(file);
      const { systemPrompt, userPrompt } = buildTemplateExtractionPrompt(moduleId, moduleLabel);
      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments: [parsed],
        expectJson: true,
      });

      const extracted = parseAiJsonResponse<Omit<ExtractedTemplate, 'id' | 'module' | 'createdAt'>>(raw);
      const newTemplate: ExtractedTemplate = {
        id: `tpl-${Date.now()}`,
        module: moduleId,
        name: extracted.name || file.name.replace(/\.[^.]+$/, ''),
        gradeLevel: extracted.gradeLevel || 'General',
        orientation: extracted.orientation === 'landscape' ? 'landscape' : 'portrait',
        pageSize: extracted.pageSize === 'oficio' ? 'oficio' : 'letter',
        sections: Array.isArray(extracted.sections) ? extracted.sections : [],
        styleNotes: extracted.styleNotes || '',
        rawInstructions: extracted.rawInstructions || '',
        createdAt: new Date().toISOString(),
      };

      await saveTemplate(newTemplate);
      await loadList();
      onSelectTemplate(newTemplate);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo analizar el formato modelo. Intenta con una foto más clara, PDF o DOCX.'
      );
    } finally {
      setExtracting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    if (selectedTemplate?.id === id) onSelectTemplate(null);
    await loadList();
  };

  return (
    <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-[#003366]" />
          <span className="text-xs font-bold text-[#003366]">
            Biblioteca de formatos de {moduleLabel}
          </span>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.pdf,image/*"
            onChange={(e) => void handleUploadTemplate(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            disabled={extracting}
            onClick={() => inputRef.current?.click()}
            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#003366]/25 bg-[#003366]/5 hover:bg-[#003366]/10 text-[#003366] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {extracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{extracting ? 'Extrayendo estructura...' : 'Subir formato modelo (DOCX/PDF/Foto)'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-xs text-slate-500">
          Usando el formato institucional oficial de CASM. Puedes subir tus propios formatos modelo (por grado o nivel) para que Gemini los reutilice.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectTemplate(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              selectedTemplate === null
                ? 'bg-[#003366] text-white border-[#003366]'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Formato oficial CASM
          </button>

          {templates.map((tpl) => {
            const active = selectedTemplate?.id === tpl.id;
            return (
              <div
                key={tpl.id}
                className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg border text-xs transition ${
                  active
                    ? 'bg-[#003366] text-white border-[#003366]'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectTemplate(tpl)}
                  className="flex items-center gap-1.5 font-medium cursor-pointer"
                >
                  {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#FFA92D]" />}
                  <span>
                    {tpl.name} · {tpl.gradeLevel}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(tpl.id)}
                  title="Eliminar plantilla"
                  className={`p-1 rounded hover:bg-black/10 cursor-pointer ${
                    active ? 'text-sky-100' : 'text-slate-400 hover:text-rose-600'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
