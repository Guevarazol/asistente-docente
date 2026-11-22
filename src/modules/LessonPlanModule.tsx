import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ExtractedTemplate,
  LessonClassSession,
  LessonPlanData,
  SavedDocument,
  SchoolConfig,
  UploadedAttachment,
} from '../types/casm';
import { saveDocumentToHistory } from '../db/indexedDb';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildLessonPlanPrompt } from '../prompts/modulePrompts';
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

interface LessonPlanModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<LessonPlanData> | null;
}

function createEmptyLessonPlan(config: SchoolConfig): LessonPlanData {
  return {
    docente: getDefaultTeacherName(config, 1),
    grado: config.grades[6] || '4.º Grado',
    seccion: config.sections[0] || 'A',
    asignatura: getDefaultSubject(config, 0),
    unidadNumero: 'Unidad 1',
    tituloUnidad: '[COMPLETAR]',
    contenido: '[COMPLETAR]',
    objetivos: '[COMPLETAR]',
    competencia: '[COMPLETAR]',
    tiempoProbable: '5 horas clase',
    fechaInicio: formatTodayIso(),
    fechaFin: '[COMPLETAR]',
    semana: 'Semana 1',
    estandarConocimientos: '[COMPLETAR]',
    procesoDidactico: [
      {
        conceptual: '[COMPLETAR]',
        procedimental: '[COMPLETAR]',
        actitudinal: '[COMPLETAR]',
        indicadoresLogro: '[COMPLETAR]',
        ifea: '[COMPLETAR]',
        actividades: '[COMPLETAR]',
      },
    ],
    clases: [
      {
        numero: 1,
        fecha: formatTodayIso(),
        introduccionMotivacion: '[COMPLETAR]',
        trabajoDocente: '[COMPLETAR]',
        trabajoGrupalIndividual: '[COMPLETAR]',
        evaluacionContextualizada: '[COMPLETAR]',
        vocabularioClave: '[COMPLETAR]',
        itemsCompetencias: '[COMPLETAR]',
        anotacionesPertinentes: '[COMPLETAR]',
      },
    ],
  };
}

export const LessonPlanModule: React.FC<LessonPlanModuleProps> = ({
  config,
  initialDocument,
}) => {
  const [docId, setDocId] = useState(initialDocument?.id || `doc-plan-${Date.now()}`);
  const [data, setData] = useState<LessonPlanData>(
    initialDocument?.data || createEmptyLessonPlan(config)
  );
  const [numClasses, setNumClasses] = useState(3);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractedTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editar' | 'vista_previa'>('editar');

  const previewRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildLessonPlanPrompt({
        config,
        userNotes: notes || 'Usa el contenido de los archivos o fotografías adjuntas.',
        grade: data.grado,
        section: data.seccion,
        subject: data.asignatura,
        teacher: data.docente,
        numClasses,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<LessonPlanData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        procesoDidactico:
          Array.isArray(parsed.procesoDidactico) && parsed.procesoDidactico.length > 0
            ? parsed.procesoDidactico
            : prev.procesoDidactico,
        clases:
          Array.isArray(parsed.clases) && parsed.clases.length > 0
            ? parsed.clases
            : prev.clases,
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al generar el Guion de Clases.');
    } finally {
      setGenerating(false);
    }
  };

  const updateClass = (idx: number, field: keyof LessonClassSession, value: string) => {
    setData((prev) => ({
      ...prev,
      clases: prev.clases.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const addClass = () => {
    setData((prev) => ({
      ...prev,
      clases: [
        ...prev.clases,
        {
          numero: prev.clases.length + 1,
          fecha: '[COMPLETAR]',
          introduccionMotivacion: '[COMPLETAR]',
          trabajoDocente: '[COMPLETAR]',
          trabajoGrupalIndividual: '[COMPLETAR]',
          evaluacionContextualizada: '[COMPLETAR]',
          vocabularioClave: '[COMPLETAR]',
          itemsCompetencias: '[COMPLETAR]',
          anotacionesPertinentes: '[COMPLETAR]',
        },
      ],
    }));
  };

  const removeClass = (idx: number) => {
    setData((prev) => ({
      ...prev,
      clases: prev.clases
        .filter((_, i) => i !== idx)
        .map((c, i) => ({ ...c, numero: i + 1 })),
    }));
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<LessonPlanData>({
      id: docId,
      module: 'planificacion',
      title: `Guion de Clases — ${data.asignatura} (${data.unidadNumero}: ${data.tituloUnidad})`,
      grade: data.grado,
      section: data.seccion,
      subject: data.asignatura,
      period: data.semana || config.academicYear,
      date: data.fechaInicio || formatTodayIso(),
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
        schoolSubtitle: 'Asociación Oriental Salvadoreña · Departamento de Educación · Guion de Clases',
        title: `GUION DE CLASES — ${data.asignatura.toUpperCase()}`,
        subtitle: `${data.grado} "${data.seccion}" · ${data.unidadNumero}: ${data.tituloUnidad}`,
        orientation: 'landscape',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'I. Generalidades',
            keyValues: [
              { label: 'Colegio', value: config.schoolName },
              { label: 'Docente', value: data.docente },
              { label: 'Grado y Sección', value: `${data.grado} "${data.seccion}"` },
              { label: 'Asignatura', value: data.asignatura },
              { label: 'Unidad y Título', value: `${data.unidadNumero} — ${data.tituloUnidad}` },
              { label: 'Contenido', value: data.contenido },
              { label: 'Objetivos', value: data.objetivos },
              { label: 'Competencia', value: data.competencia },
              { label: 'Tiempo probable / Semana', value: `${data.tiempoProbable} · ${data.semana}` },
              { label: 'Fechas', value: `Inicio: ${data.fechaInicio} · Finalización: ${data.fechaFin}` },
            ],
          },
          {
            heading: 'II. Estándar de Conocimientos',
            paragraphs: [data.estandarConocimientos],
          },
          {
            heading: 'III. Proceso Didáctico',
            table: {
              headers: [
                'Contenidos (Conceptual / Procedimental / Actitudinal)',
                'Indicadores de Logro',
                'IFEA',
                'Actividades',
              ],
              rows: data.procesoDidactico.map((p) => [
                `Conceptual: ${p.conceptual}\nProcedimental: ${p.procedimental}\nActitudinal: ${p.actitudinal}`,
                p.indicadoresLogro,
                p.ifea,
                p.actividades,
              ]),
            },
          },
          ...data.clases.map((c) => ({
            heading: `Clase ${c.numero} (${c.fecha})`,
            keyValues: [
              { label: 'Introducción y motivación', value: c.introduccionMotivacion },
              { label: 'Trabajo docente contextualizado', value: c.trabajoDocente },
              { label: 'Trabajo grupal o individual contextualizado', value: c.trabajoGrupalIndividual },
              { label: 'Evaluación contextualizada', value: c.evaluacionContextualizada },
              { label: 'Vocabulario clave', value: c.vocabularioClave },
              { label: 'Ítems de evaluación con enfoque de competencias', value: c.itemsCompetencias },
              { label: 'Anotaciones pertinentes', value: c.anotacionesPertinentes },
            ],
          })),
        ],
      },
      `Guion_Clases_${data.asignatura}_${data.grado}`
    );
  };

  return (
    <div className="space-y-5">
      <ModuleTemplatePicker
        moduleId="planificacion"
        moduleLabel="Planificación (Guion de clases)"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* Quick Metadata Config Bar */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Docente</label>
          <input
            type="text"
            value={data.docente}
            onChange={(e) => setData((p) => ({ ...p, docente: e.target.value }))}
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
          <select
            value={data.grado}
            onChange={(e) => setData((p) => ({ ...p, grado: e.target.value }))}
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {config.grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Sección</label>
          <select
            value={data.seccion}
            onChange={(e) => setData((p) => ({ ...p, seccion: e.target.value }))}
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {config.sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Asignatura</label>
          <select
            value={data.asignatura}
            onChange={(e) => setData((p) => ({ ...p, asignatura: e.target.value }))}
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {getSubjectOptions(config, data.asignatura).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">N.º de clases</label>
          <input
            type="number"
            min={1}
            max={10}
            value={numClasses}
            onChange={(e) => setNumClasses(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
          />
        </div>
      </div>

      <div className="no-print">
        <ContentInputPanel
          label="Tema, unidad, programa MINEDUCYT o fotos del libro de texto"
          placeholder="Ej: Unidad 2: La comunicación oral y escrita. Contenido: Tipos de textos narrativos y sus elementos. Incluir enfoque IFEA sobre la veracidad..."
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel="Generar Guion de Clases (Horizontal Carta)"
          errorMessage={aiError}
        />
      </div>

      {/* Mode Switcher */}
      <div className="no-print flex p-1 bg-slate-200/80 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setViewMode('editar')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'editar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Editar contenido
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
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5 shadow-xs">
          <h3 className="text-sm font-bold text-[#003366]">I. Generalidades y II. Estándar</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'unidadNumero' as const, label: 'N.º de Unidad' },
              { key: 'tituloUnidad' as const, label: 'Título de la Unidad' },
              { key: 'contenido' as const, label: 'Contenido' },
              { key: 'tiempoProbable' as const, label: 'Tiempo probable' },
              { key: 'fechaInicio' as const, label: 'Fecha inicio' },
              { key: 'fechaFin' as const, label: 'Fecha finalización' },
              { key: 'semana' as const, label: 'Semana' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                <input
                  type="text"
                  value={data[f.key]}
                  onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Objetivos</label>
              <textarea
                rows={3}
                value={data.objetivos}
                onChange={(e) => setData((p) => ({ ...p, objetivos: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Competencia</label>
              <textarea
                rows={3}
                value={data.competencia}
                onChange={(e) => setData((p) => ({ ...p, competencia: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">II. Estándar de conocimientos</label>
              <textarea
                rows={3}
                value={data.estandarConocimientos}
                onChange={(e) => setData((p) => ({ ...p, estandarConocimientos: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <h3 className="text-sm font-bold text-[#003366] pt-2">III. Proceso Didáctico (Tabla)</h3>
          {data.procesoDidactico.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Conceptual</label>
                <textarea
                  rows={2}
                  value={row.conceptual}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      procesoDidactico: p.procesoDidactico.map((r, i) =>
                        i === idx ? { ...r, conceptual: e.target.value } : r
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Procedimental</label>
                <textarea
                  rows={2}
                  value={row.procedimental}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      procesoDidactico: p.procesoDidactico.map((r, i) =>
                        i === idx ? { ...r, procedimental: e.target.value } : r
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Actitudinal</label>
                <textarea
                  rows={2}
                  value={row.actitudinal}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      procesoDidactico: p.procesoDidactico.map((r, i) =>
                        i === idx ? { ...r, actitudinal: e.target.value } : r
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Indicadores de logro</label>
                <textarea
                  rows={2}
                  value={row.indicadoresLogro}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      procesoDidactico: p.procesoDidactico.map((r, i) =>
                        i === idx ? { ...r, indicadoresLogro: e.target.value } : r
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">IFEA (Integración de la Fe)</label>
                <textarea
                  rows={2}
                  value={row.ifea}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      procesoDidactico: p.procesoDidactico.map((r, i) =>
                        i === idx ? { ...r, ifea: e.target.value } : r
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Actividades</label>
                <textarea
                  rows={2}
                  value={row.actividades}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      procesoDidactico: p.procesoDidactico.map((r, i) =>
                        i === idx ? { ...r, actividades: e.target.value } : r
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm font-bold text-[#003366]">Desarrollo por Clase ({data.clases.length})</h3>
            <button
              type="button"
              onClick={addClass}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar clase</span>
            </button>
          </div>

          <div className="space-y-4">
            {data.clases.map((c, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#003366]">Clase {c.numero}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={c.fecha}
                      onChange={(e) => updateClass(idx, 'fecha', e.target.value)}
                      placeholder="Fecha"
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs w-36"
                    />
                    {data.clases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeClass(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      ['introduccionMotivacion', 'Introducción y motivación'],
                      ['trabajoDocente', 'Trabajo docente contextualizado'],
                      ['trabajoGrupalIndividual', 'Trabajo grupal o individual contextualizado'],
                      ['evaluacionContextualizada', 'Evaluación contextualizada'],
                      ['vocabularioClave', 'Vocabulario clave'],
                      ['itemsCompetencias', 'Ítems de evaluación con enfoque de competencias'],
                      ['anotacionesPertinentes', 'Anotaciones pertinentes'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
                      <textarea
                        rows={2}
                        value={String(c[field])}
                        onChange={(e) => updateClass(idx, field, e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <DocumentActionBar
        previewRef={previewRef}
        fileBaseName={`Guion_Clases_${data.asignatura}_${data.grado}`}
        whatsappMessage={`Guion de clases — ${data.asignatura}, ${data.grado} "${data.seccion}" (${data.unidadNumero}) · ${config.schoolName}`}
        orientation="landscape"
        pageSize="letter"
        onDownloadWord={handleDownloadWord}
        onSaveHistory={handleSaveHistory}
        onDuplicate={() => setDocId(`doc-plan-${Date.now()}`)}
      />

      {/* Horizontal Letter Preview */}
      <div className={`print-only-container overflow-x-auto pb-4 ${viewMode === 'editar' ? 'hidden sm:block' : 'block'}`}>
        <div ref={previewRef} className="doc-paper doc-paper-letter-landscape print-page text-[10px] leading-snug">
          <SchoolDocHeader
            config={config}
            documentTitle="Guion de Clases"
            subtitle="Asociación Oriental Salvadoreña · Departamento de Educación"
            compact
          />

          <div className="text-[11px] font-bold uppercase text-white px-2 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
            I. Generalidades
          </div>
          <table className="w-full border-collapse border border-slate-300 mb-2.5">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Colegio:</td>
                <td className="border border-slate-300 p-1">{config.schoolName}</td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Docente:</td>
                <td className="border border-slate-300 p-1"><HighlightedText text={data.docente} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Grado / Sec.:</td>
                <td className="border border-slate-300 p-1">{data.grado} "{data.seccion}"</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Asignatura:</td>
                <td className="border border-slate-300 p-1">{data.asignatura}</td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Unidad:</td>
                <td className="border border-slate-300 p-1"><HighlightedText text={`${data.unidadNumero}: ${data.tituloUnidad}`} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Semana / Tiempo:</td>
                <td className="border border-slate-300 p-1"><HighlightedText text={`${data.semana} · ${data.tiempoProbable}`} /></td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Contenido:</td>
                <td className="border border-slate-300 p-1" colSpan={3}><HighlightedText text={data.contenido} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Fechas:</td>
                <td className="border border-slate-300 p-1"><HighlightedText text={`${data.fechaInicio} al ${data.fechaFin}`} /></td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Objetivos:</td>
                <td className="border border-slate-300 p-1" colSpan={2}><HighlightedText text={data.objetivos} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1">Competencia:</td>
                <td className="border border-slate-300 p-1" colSpan={2}><HighlightedText text={data.competencia} /></td>
              </tr>
            </tbody>
          </table>

          <div className="text-[11px] font-bold uppercase text-white px-2 py-1 mb-1" style={{ backgroundColor: config.primaryColor }}>
            II. Estándar de Conocimientos
          </div>
          <div className="border border-slate-300 p-1.5 mb-2.5">
            <HighlightedText text={data.estandarConocimientos} />
          </div>

          <div className="text-[11px] font-bold uppercase text-white px-2 py-1 mb-1" style={{ backgroundColor: config.primaryColor }}>
            III. Proceso Didáctico
          </div>
          <table className="w-full border-collapse border border-slate-300 mb-3">
            <thead>
              <tr className="bg-slate-100 text-[#003366]">
                <th className="border border-slate-300 p-1.5 text-left w-[28%]">Contenidos (Conceptual / Procedimental / Actitudinal)</th>
                <th className="border border-slate-300 p-1.5 text-left w-[24%]">Indicadores de Logro</th>
                <th className="border border-slate-300 p-1.5 text-left w-[22%]">IFEA</th>
                <th className="border border-slate-300 p-1.5 text-left w-[26%]">Actividades</th>
              </tr>
            </thead>
            <tbody>
              {data.procesoDidactico.map((p, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 p-1.5 align-top space-y-1">
                    <div><strong>Conceptual:</strong> <HighlightedText text={p.conceptual} /></div>
                    <div><strong>Procedimental:</strong> <HighlightedText text={p.procedimental} /></div>
                    <div><strong>Actitudinal:</strong> <HighlightedText text={p.actitudinal} /></div>
                  </td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={p.indicadoresLogro} /></td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={p.ifea} /></td>
                  <td className="border border-slate-300 p-1.5 align-top whitespace-pre-wrap"><HighlightedText text={p.actividades} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Class by Class Detail */}
          <div className="space-y-2.5">
            {data.clases.map((c) => (
              <div key={c.numero} className="avoid-break border border-slate-300">
                <div
                  className="px-2 py-1 text-[10px] font-bold text-white flex items-center justify-between"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <span>CLASE {c.numero}</span>
                  <span>Fecha: {c.fecha}</span>
                </div>
                <table className="w-full border-collapse text-[10px]">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1 w-1/4">Introducción y motivación</td>
                      <td className="border border-slate-300 p-1 w-1/4"><HighlightedText text={c.introduccionMotivacion} /></td>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1 w-1/4">Trabajo docente contextualizado</td>
                      <td className="border border-slate-300 p-1 w-1/4"><HighlightedText text={c.trabajoDocente} /></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1">Trabajo grupal o individual</td>
                      <td className="border border-slate-300 p-1"><HighlightedText text={c.trabajoGrupalIndividual} /></td>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1">Evaluación contextualizada</td>
                      <td className="border border-slate-300 p-1"><HighlightedText text={c.evaluacionContextualizada} /></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1">Vocabulario clave</td>
                      <td className="border border-slate-300 p-1"><HighlightedText text={c.vocabularioClave} /></td>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1">Ítems con enfoque de competencias</td>
                      <td className="border border-slate-300 p-1"><HighlightedText text={c.itemsCompetencias} /></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1">Anotaciones pertinentes</td>
                      <td className="border border-slate-300 p-1" colSpan={3}><HighlightedText text={c.anotacionesPertinentes} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

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
    </div>
  );
};
