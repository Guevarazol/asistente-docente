import React, { useEffect, useRef, useState } from 'react';
import { BookMarked, Calendar, Plus, Trash2 } from 'lucide-react';
import type {
  ExtractedTemplate,
  PacingGuideData,
  PacingRow,
  SavedDocument,
  SchoolConfig,
  UploadedAttachment,
} from '../types/casm';
import { getDocumentsByModule, saveDocumentToHistory } from '../db/indexedDb';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildPacingGuidePrompt } from '../prompts/modulePrompts';
import { formatTodayIso } from '../utils/spanishDateToWords';
import { downloadStructuredDocx } from '../utils/exportEngine';
import { ContentInputPanel } from '../components/ContentInputPanel';
import { DocumentActionBar } from '../components/DocumentActionBar';
import { ModuleTemplatePicker } from '../components/ModuleTemplatePicker';
import { HighlightedText, SchoolDocHeader } from '../components/HighlightedText';
import {
  getDefaultSubject,
  getDefaultTeacherName,
  getSubjectOptions,
  resolveTeacherSignature,
} from '../utils/userProfileDefaults';

interface PacingGuideModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<PacingGuideData> | null;
}

function createEmptyPacing(config: SchoolConfig): PacingGuideData {
  return {
    docente: getDefaultTeacherName(config, 1),
    grado: config.grades[6] || '4.º Grado',
    seccion: config.sections[0] || 'A',
    asignatura: getDefaultSubject(config, 0),
    periodo: 'Periodo I',
    anioLectivo: config.academicYear,
    filas: [
      {
        semana: 'Semana 1',
        fechas: '[COMPLETAR]',
        unidad: 'Unidad 1',
        contenido: '[COMPLETAR]',
        indicadoresLogro: '[COMPLETAR]',
        actividadesEvaluacion: '[COMPLETAR]',
        observaciones: '[COMPLETAR]',
      },
    ],
  };
}

export const PacingGuideModule: React.FC<PacingGuideModuleProps> = ({
  config,
  initialDocument,
}) => {
  const [docId, setDocId] = useState(initialDocument?.id || `doc-jor-${Date.now()}`);
  const [data, setData] = useState<PacingGuideData>(
    initialDocument?.data || createEmptyPacing(config)
  );
  const [weeksCount, setWeeksCount] = useState(9);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractedTemplate | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedDocument[]>([]);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editar' | 'vista_previa'>('vista_previa');

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getDocumentsByModule('planificacion').then(setSavedPlans);
  }, []);

  const handleLoadFromPlan = (planId: string) => {
    const plan = savedPlans.find((p) => p.id === planId);
    if (!plan) return;
    setData((prev) => ({
      ...prev,
      grado: plan.grade || prev.grado,
      seccion: plan.section || prev.seccion,
      asignatura: plan.subject || prev.asignatura,
    }));
    setNotes(
      `Distribuir en jornalización semanal a partir de la planificación guardada "${plan.title}":\n${JSON.stringify(plan.data, null, 2).slice(0, 6000)}`
    );
  };

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildPacingGuidePrompt({
        config,
        userNotes: notes || 'Usa el programa de estudio o planificación adjunta.',
        grade: data.grado,
        section: data.seccion,
        subject: data.asignatura,
        teacher: data.docente,
        period: data.periodo,
        weeksCount,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<PacingGuideData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        filas: Array.isArray(parsed.filas) && parsed.filas.length > 0 ? parsed.filas : prev.filas,
      }));
      setViewMode('vista_previa');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al generar la jornalización.');
    } finally {
      setGenerating(false);
    }
  };

  const updateRow = (idx: number, field: keyof PacingRow, value: string) => {
    setData((prev) => ({
      ...prev,
      filas: prev.filas.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    }));
  };

  const addRow = () => {
    setData((prev) => ({
      ...prev,
      filas: [
        ...prev.filas,
        {
          semana: `Semana ${prev.filas.length + 1}`,
          fechas: '[COMPLETAR]',
          unidad: prev.filas[prev.filas.length - 1]?.unidad || 'Unidad 1',
          contenido: '[COMPLETAR]',
          indicadoresLogro: '[COMPLETAR]',
          actividadesEvaluacion: '[COMPLETAR]',
          observaciones: '',
        },
      ],
    }));
  };

  const removeRow = (idx: number) => {
    setData((prev) => ({
      ...prev,
      filas: prev.filas.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<PacingGuideData>({
      id: docId,
      module: 'jornalizacion',
      title: `Jornalización ${data.periodo} — ${data.asignatura} ${data.grado}`,
      grade: data.grado,
      section: data.seccion,
      subject: data.asignatura,
      period: data.periodo,
      date: formatTodayIso(),
      orientation: 'landscape',
      pageSize: 'letter',
      data,
      createdAt: initialDocument?.createdAt || now,
      updatedAt: now,
    });
  };

  const handleDownloadWord = async () => {
    await downloadStructuredDocx(
      {
        schoolName: config.schoolName,
        schoolSubtitle: `${config.schoolCity} · Jornalización Docente · Año ${data.anioLectivo}`,
        title: `JORNALIZACIÓN DOCENTE — ${data.asignatura.toUpperCase()}`,
        subtitle: `${data.grado} "${data.seccion}" · ${data.periodo} · Docente: ${data.docente}`,
        orientation: 'landscape',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'Distribución Semanal de Contenidos',
            table: {
              headers: [
                'Semana',
                'Fechas',
                'Unidad',
                'Contenido',
                'Indicadores de Logro',
                'Actividades de Evaluación',
                'Observaciones',
              ],
              rows: data.filas.map((f) => [
                f.semana,
                f.fechas,
                f.unidad,
                f.contenido,
                f.indicadoresLogro,
                f.actividadesEvaluacion,
                f.observaciones,
              ]),
            },
          },
        ],
      },
      `Jornalizacion_${data.asignatura}_${data.grado}_${data.periodo}`
    );
  };

  return (
    <div className="space-y-5">
      <ModuleTemplatePicker
        moduleId="jornalizacion"
        moduleLabel="Jornalización Docente"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* Calendar events summary */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#003366]">
            <Calendar className="w-4 h-4" />
            <span>Calendario escolar integrado ({config.calendarEvents.length} fechas configuradas)</span>
          </div>
          {savedPlans.length > 0 && (
            <div className="flex items-center gap-1.5">
              <BookMarked className="w-4 h-4 text-[#003366]" />
              <select
                defaultValue=""
                onChange={(e) => handleLoadFromPlan(e.target.value)}
                className="min-h-[38px] px-2.5 rounded-lg border border-slate-300 text-xs bg-slate-50"
              >
                <option value="">Generar desde Planificación guardada...</option>
                {savedPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          {config.calendarEvents.map((ev) => (
            <span key={ev.id} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
              <strong>{ev.name}</strong> ({ev.startDate})
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Docente</label>
            <input
              type="text"
              value={data.docente}
              onChange={(e) => setData((p) => ({ ...p, docente: e.target.value }))}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
            <select
              value={data.grado}
              onChange={(e) => setData((p) => ({ ...p, grado: e.target.value }))}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {config.grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Asignatura</label>
            <select
              value={data.asignatura}
              onChange={(e) => setData((p) => ({ ...p, asignatura: e.target.value }))}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {getSubjectOptions(config, data.asignatura).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Periodo</label>
            <input
              type="text"
              value={data.periodo}
              onChange={(e) => setData((p) => ({ ...p, periodo: e.target.value }))}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Semanas</label>
            <input
              type="number"
              min={2}
              max={20}
              value={weeksCount}
              onChange={(e) => setWeeksCount(Math.max(2, Math.min(20, Number(e.target.value) || 8)))}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      <div className="no-print">
        <ContentInputPanel
          label="Unidades, temario del programa o archivo de planificación"
          placeholder="Describe las unidades y contenidos del periodo (o sube el PDF/Excel del programa MINEDUCYT)..."
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel="Generar Jornalización Semanal"
          errorMessage={aiError}
        />
      </div>

      <div className="no-print flex p-1 bg-slate-200/80 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setViewMode('editar')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'editar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Editar tabla ({data.filas.length} sem.)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('vista_previa')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'vista_previa' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Vista previa horizontal
        </button>
      </div>

      {viewMode === 'editar' && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#003366]">Filas de la Jornalización</span>
            <button
              type="button"
              onClick={addRow}
              className="min-h-[38px] px-3 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar semana</span>
            </button>
          </div>
          {data.filas.map((row, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <input
                    type="text"
                    value={row.semana}
                    onChange={(e) => updateRow(idx, 'semana', e.target.value)}
                    placeholder="Semana"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={row.fechas}
                    onChange={(e) => updateRow(idx, 'fechas', e.target.value)}
                    placeholder="Fechas"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={row.unidad}
                    onChange={(e) => updateRow(idx, 'unidad', e.target.value)}
                    placeholder="Unidad"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <textarea
                  rows={2}
                  value={row.contenido}
                  onChange={(e) => updateRow(idx, 'contenido', e.target.value)}
                  placeholder="Contenido"
                  className="p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <textarea
                  rows={2}
                  value={row.indicadoresLogro}
                  onChange={(e) => updateRow(idx, 'indicadoresLogro', e.target.value)}
                  placeholder="Indicadores de logro"
                  className="p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <textarea
                  rows={2}
                  value={row.actividadesEvaluacion}
                  onChange={(e) => updateRow(idx, 'actividadesEvaluacion', e.target.value)}
                  placeholder="Actividades de evaluación"
                  className="p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <textarea
                  rows={2}
                  value={row.observaciones}
                  onChange={(e) => updateRow(idx, 'observaciones', e.target.value)}
                  placeholder="Observaciones / Feriados"
                  className="p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentActionBar
        previewRef={previewRef}
        fileBaseName={`Jornalizacion_${data.asignatura}_${data.grado}_${data.periodo}`}
        whatsappMessage={`Jornalización Docente (${data.periodo}) — ${data.asignatura}, ${data.grado} "${data.seccion}" · ${config.schoolName}`}
        orientation="landscape"
        pageSize="letter"
        onDownloadWord={handleDownloadWord}
        onSaveHistory={handleSaveHistory}
        onDuplicate={() => setDocId(`doc-jor-${Date.now()}`)}
      />

      <div className="print-only-container overflow-x-auto pb-4">
        <div ref={previewRef} className="doc-paper doc-paper-letter-landscape print-page text-[10px]">
          <SchoolDocHeader
            config={config}
            documentTitle="Jornalización Docente"
            subtitle={`${data.periodo} · Año Lectivo ${data.anioLectivo}`}
            compact
          />

          <div className="grid grid-cols-4 gap-2 mb-3 text-[11px] bg-slate-50 border border-slate-300 p-2">
            <div><strong>Docente:</strong> <HighlightedText text={data.docente} /></div>
            <div><strong>Grado y Sección:</strong> {data.grado} "{data.seccion}"</div>
            <div><strong>Asignatura:</strong> {data.asignatura}</div>
            <div><strong>Periodo:</strong> {data.periodo}</div>
          </div>

          <table className="w-full border-collapse border border-slate-300">
            <thead>
              <tr className="text-white" style={{ backgroundColor: config.primaryColor }}>
                <th className="border border-slate-300 p-1.5 text-left w-[8%]">Semana</th>
                <th className="border border-slate-300 p-1.5 text-left w-[12%]">Fechas</th>
                <th className="border border-slate-300 p-1.5 text-left w-[12%]">Unidad</th>
                <th className="border border-slate-300 p-1.5 text-left w-[20%]">Contenido</th>
                <th className="border border-slate-300 p-1.5 text-left w-[20%]">Indicadores de Logro</th>
                <th className="border border-slate-300 p-1.5 text-left w-[16%]">Actividades de Evaluación</th>
                <th className="border border-slate-300 p-1.5 text-left w-[12%]">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {data.filas.map((f, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : ''}>
                  <td className="border border-slate-300 p-1.5 font-bold align-top"><HighlightedText text={f.semana} /></td>
                  <td className="border border-slate-300 p-1.5 align-top"><HighlightedText text={f.fechas} /></td>
                  <td className="border border-slate-300 p-1.5 align-top"><HighlightedText text={f.unidad} /></td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={f.contenido} /></td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={f.indicadoresLogro} /></td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={f.actividadesEvaluacion} /></td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={f.observaciones} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-12 pt-8 text-center text-[10px] avoid-break">
            <div>
              <div className="h-10 flex items-end justify-center">
                {resolveTeacherSignature(config, data.docente) && (
                  <img
                    src={resolveTeacherSignature(config, data.docente)}
                    alt="Firma docente"
                    className="max-h-10 object-contain"
                  />
                )}
              </div>
              <div className="border-t border-slate-700 pt-1 font-bold">{data.docente}</div>
              <div className="text-slate-500">Docente responsable</div>
            </div>
            <div>
              <div className="h-10 flex items-end justify-center">
                {config.directorSignature && (
                  <img
                    src={config.directorSignature}
                    alt="Firma Dirección"
                    className="max-h-10 object-contain"
                  />
                )}
              </div>
              <div className="border-t border-slate-700 pt-1 font-bold">{config.directorName}</div>
              <div className="text-slate-500">V.° B.° Dirección</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
