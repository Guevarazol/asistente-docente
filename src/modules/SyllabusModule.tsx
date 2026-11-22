import React, { useEffect, useRef, useState } from 'react';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import type {
  ExtractedTemplate,
  SavedDocument,
  SchoolConfig,
  SyllabusData,
  UploadedAttachment,
} from '../types/casm';
import { getDocumentsByModule, saveDocumentToHistory } from '../db/indexedDb';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildSyllabusPrompt } from '../prompts/modulePrompts';
import { formatReadableDateEs, formatTodayIso } from '../utils/spanishDateToWords';
import { downloadStructuredDocx } from '../utils/exportEngine';
import { ContentInputPanel } from '../components/ContentInputPanel';
import { DocumentActionBar } from '../components/DocumentActionBar';
import { ModuleTemplatePicker } from '../components/ModuleTemplatePicker';
import { HighlightedText, SchoolDocHeader } from '../components/HighlightedText';
import {
  getDefaultSubject,
  getDefaultTeacherName,
  getSubjectOptions,
} from '../utils/userProfileDefaults';

interface SyllabusModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<SyllabusData> | null;
}

function createEmptySyllabus(config: SchoolConfig): SyllabusData {
  return {
    asignatura: getDefaultSubject(config, 0),
    grado: config.grades[6] || '4.º Grado',
    seccion: config.sections[0] || 'A',
    docente: getDefaultTeacherName(config, 1),
    periodo: 'Periodo I',
    tipoPrueba: 'Examen de Periodo',
    fechaPrueba: formatTodayIso(),
    ponderacion: config.gradingScale === 'percentage' ? '30%' : '3.0 puntos (30%)',
    contenidos: [
      {
        unidad: 'Unidad 1',
        tema: '[COMPLETAR]',
        subtemas: '[COMPLETAR]',
        paginaORecurso: 'Cuaderno de clase / Libro pág. [COMPLETAR]',
      },
    ],
    recomendacionesEstudio: [
      'Repasar diariamente los apuntes del cuaderno y los ejercicios resueltos en clase.',
      'Dormir temprano la noche anterior y presentar lápiz, borrador y lapicero azul.',
    ],
    observacionesPadres:
      'Estimados padres de familia: agradecemos su acompañamiento en casa durante la preparación para esta evaluación.',
  };
}

export const SyllabusModule: React.FC<SyllabusModuleProps> = ({ config, initialDocument }) => {
  const [docId, setDocId] = useState(initialDocument?.id || `doc-tem-${Date.now()}`);
  const [data, setData] = useState<SyllabusData>(
    initialDocument?.data || createEmptySyllabus(config)
  );
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractedTemplate | null>(null);
  const [savedSources, setSavedSources] = useState<SavedDocument[]>([]);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editar' | 'vista_previa'>('vista_previa');

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void Promise.all([
      getDocumentsByModule('planificacion'),
      getDocumentsByModule('jornalizacion'),
    ]).then(([planes, jornalizaciones]) => {
      setSavedSources([...planes, ...jornalizaciones]);
    });
  }, []);

  const handleImportSource = (id: string) => {
    const found = savedSources.find((s) => s.id === id);
    if (!found) return;
    setData((prev) => ({
      ...prev,
      grado: found.grade || prev.grado,
      seccion: found.section || prev.seccion,
      asignatura: found.subject || prev.asignatura,
      periodo: found.period || prev.periodo,
    }));
    setNotes(
      `Generar Temario de Examen completamente coherente con "${found.title}":\n${JSON.stringify(found.data, null, 2).slice(0, 6000)}`
    );
  };

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildSyllabusPrompt({
        config,
        userNotes: notes || 'Usa el contenido de los archivos o fotografías adjuntas.',
        grade: data.grado,
        section: data.seccion,
        subject: data.asignatura,
        teacher: data.docente,
        period: data.periodo,
        examType: data.tipoPrueba,
        examDate: data.fechaPrueba,
        weight: data.ponderacion,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<SyllabusData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        contenidos:
          Array.isArray(parsed.contenidos) && parsed.contenidos.length > 0
            ? parsed.contenidos
            : prev.contenidos,
        recomendacionesEstudio:
          Array.isArray(parsed.recomendacionesEstudio) && parsed.recomendacionesEstudio.length > 0
            ? parsed.recomendacionesEstudio
            : prev.recomendacionesEstudio,
      }));
      setViewMode('vista_previa');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al generar el temario.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<SyllabusData>({
      id: docId,
      module: 'temarios',
      title: `Temario ${data.periodo} — ${data.asignatura} ${data.grado}`,
      grade: data.grado,
      section: data.seccion,
      subject: data.asignatura,
      period: data.periodo,
      date: data.fechaPrueba || formatTodayIso(),
      orientation: 'portrait',
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
        schoolSubtitle: `${config.schoolCity} · Temario Oficial de Evaluación · ${data.periodo}`,
        title: `TEMARIO DE EXAMEN — ${data.asignatura.toUpperCase()}`,
        subtitle: `${data.grado} "${data.seccion}" · ${data.tipoPrueba} · Fecha: ${formatReadableDateEs(data.fechaPrueba)}`,
        orientation: 'portrait',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'Información de la Prueba',
            keyValues: [
              { label: 'Asignatura', value: data.asignatura },
              { label: 'Grado y Sección', value: `${data.grado} "${data.seccion}"` },
              { label: 'Docente', value: data.docente },
              { label: 'Periodo / Tipo de prueba', value: `${data.periodo} · ${data.tipoPrueba}` },
              { label: 'Fecha y Ponderación', value: `${formatReadableDateEs(data.fechaPrueba)} · ${data.ponderacion}` },
            ],
          },
          {
            heading: 'Contenidos a Evaluar',
            table: {
              headers: ['Unidad', 'Tema', 'Subtemas / Destrezas', 'Recurso / Páginas'],
              rows: data.contenidos.map((c) => [c.unidad, c.tema, c.subtemas, c.paginaORecurso]),
            },
          },
          {
            heading: 'Recomendaciones de Estudio',
            paragraphs: [
              ...data.recomendacionesEstudio.map((r, i) => `${i + 1}. ${r}`),
              '',
              data.observacionesPadres,
            ],
          },
        ],
      },
      `Temario_${data.asignatura}_${data.grado}_${data.periodo}`
    );
  };

  return (
    <div className="space-y-5">
      <ModuleTemplatePicker
        moduleId="temarios"
        moduleLabel="Temarios de Examen"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        {savedSources.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-[#003366] flex items-center gap-1.5">
              <BookMarked className="w-4 h-4" />
              Coherencia curricular: importar desde Planificación o Jornalización
            </span>
            <select
              defaultValue=""
              onChange={(e) => handleImportSource(e.target.value)}
              className="min-h-[38px] px-2.5 rounded-lg border border-slate-300 text-xs bg-slate-50"
            >
              <option value="">Seleccionar documento guardado...</option>
              {savedSources.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.module === 'planificacion' ? 'Planificación' : 'Jornalización'}] {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Asignatura</label>
            <select
              value={data.asignatura}
              onChange={(e) => setData((p) => ({ ...p, asignatura: e.target.value }))}
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {getSubjectOptions(config, data.asignatura).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
            <select
              value={data.grado}
              onChange={(e) => setData((p) => ({ ...p, grado: e.target.value }))}
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {config.grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Periodo</label>
            <input
              type="text"
              value={data.periodo}
              onChange={(e) => setData((p) => ({ ...p, periodo: e.target.value }))}
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de prueba</label>
            <input
              type="text"
              value={data.tipoPrueba}
              onChange={(e) => setData((p) => ({ ...p, tipoPrueba: e.target.value }))}
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de prueba</label>
            <input
              type="date"
              value={/^\d{4}-\d{2}-\d{2}$/.test(data.fechaPrueba) ? data.fechaPrueba : ''}
              onChange={(e) => setData((p) => ({ ...p, fechaPrueba: e.target.value }))}
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ponderación</label>
            <input
              type="text"
              value={data.ponderacion}
              onChange={(e) => setData((p) => ({ ...p, ponderacion: e.target.value }))}
              className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="no-print">
        <ContentInputPanel
          label="Temas vistos en clase, planificación o fotos del índice del cuaderno"
          placeholder="Describe los temas vistos durante el periodo o impórtalos arriba desde tu Planificación / Jornalización guardada..."
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel="Generar Temario de Examen"
          errorMessage={aiError}
        />
      </div>

      <div className="no-print flex p-1 bg-slate-200/80 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setViewMode('editar')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold cursor-pointer ${
            viewMode === 'editar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Editar contenidos
        </button>
        <button
          type="button"
          onClick={() => setViewMode('vista_previa')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold cursor-pointer ${
            viewMode === 'vista_previa' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Vista previa / Exportar
        </button>
      </div>

      {viewMode === 'editar' && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#003366]">Contenidos evaluados</span>
            <button
              type="button"
              onClick={() =>
                setData((p) => ({
                  ...p,
                  contenidos: [
                    ...p.contenidos,
                    { unidad: 'Unidad', tema: '[COMPLETAR]', subtemas: '', paginaORecurso: '' },
                  ],
                }))
              }
              className="px-3 py-1.5 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tema
            </button>
          </div>
          {data.contenidos.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <input
                type="text"
                value={c.unidad}
                onChange={(e) =>
                  setData((p) => ({
                    ...p,
                    contenidos: p.contenidos.map((item, i) => (i === idx ? { ...item, unidad: e.target.value } : item)),
                  }))
                }
                placeholder="Unidad"
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <input
                type="text"
                value={c.tema}
                onChange={(e) =>
                  setData((p) => ({
                    ...p,
                    contenidos: p.contenidos.map((item, i) => (i === idx ? { ...item, tema: e.target.value } : item)),
                  }))
                }
                placeholder="Tema"
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              />
              <input
                type="text"
                value={c.subtemas}
                onChange={(e) =>
                  setData((p) => ({
                    ...p,
                    contenidos: p.contenidos.map((item, i) => (i === idx ? { ...item, subtemas: e.target.value } : item)),
                  }))
                }
                placeholder="Subtemas"
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={c.paginaORecurso}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      contenidos: p.contenidos.map((item, i) =>
                        i === idx ? { ...item, paginaORecurso: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="Páginas / recurso"
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    setData((p) => ({
                      ...p,
                      contenidos: p.contenidos.filter((_, i) => i !== idx),
                    }))
                  }
                  className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Recomendaciones de estudio (una por línea)
            </label>
            <textarea
              rows={3}
              value={data.recomendacionesEstudio.join('\n')}
              onChange={(e) =>
                setData((p) => ({ ...p, recomendacionesEstudio: e.target.value.split('\n') }))
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
        </div>
      )}

      <DocumentActionBar
        previewRef={previewRef}
        fileBaseName={`Temario_${data.asignatura}_${data.grado}_${data.periodo}`}
        whatsappMessage={`Temario de ${data.tipoPrueba} (${data.periodo}) — ${data.asignatura}, ${data.grado} "${data.seccion}" · Fecha: ${formatReadableDateEs(data.fechaPrueba)} · ${config.schoolName}`}
        orientation="portrait"
        pageSize="letter"
        onDownloadWord={handleDownloadWord}
        onSaveHistory={handleSaveHistory}
        onDuplicate={() => setDocId(`doc-tem-${Date.now()}`)}
      />

      <div className="print-only-container overflow-x-auto pb-4">
        <div ref={previewRef} className="doc-paper doc-paper-letter-portrait print-page text-[11px] leading-relaxed">
          <SchoolDocHeader
            config={config}
            documentTitle="Temario de Examen"
            subtitle={`${data.periodo} · ${data.tipoPrueba}`}
          />

          <table className="w-full border-collapse border border-slate-300 mb-4">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/5">Asignatura:</td>
                <td className="border border-slate-300 p-1.5 font-bold text-[#003366]">{data.asignatura}</td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/5">Grado / Sec.:</td>
                <td className="border border-slate-300 p-1.5">{data.grado} "{data.seccion}"</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Docente:</td>
                <td className="border border-slate-300 p-1.5"><HighlightedText text={data.docente} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Fecha prueba:</td>
                <td className="border border-slate-300 p-1.5 font-semibold">{formatReadableDateEs(data.fechaPrueba)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Tipo de prueba:</td>
                <td className="border border-slate-300 p-1.5">{data.tipoPrueba}</td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Ponderación:</td>
                <td className="border border-slate-300 p-1.5 font-mono font-bold">{data.ponderacion}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
            Contenidos a Evaluar
          </div>
          <table className="w-full border-collapse border border-slate-300 mb-4">
            <thead>
              <tr className="bg-slate-100 text-[#003366]">
                <th className="border border-slate-300 p-2 text-left w-24">Unidad</th>
                <th className="border border-slate-300 p-2 text-left w-44">Tema</th>
                <th className="border border-slate-300 p-2 text-left">Subtemas y Destrezas</th>
                <th className="border border-slate-300 p-2 text-left w-36">Fuente / Páginas</th>
              </tr>
            </thead>
            <tbody>
              {data.contenidos.map((c, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : ''}>
                  <td className="border border-slate-300 p-2 font-semibold"><HighlightedText text={c.unidad} /></td>
                  <td className="border border-slate-300 p-2 font-bold"><HighlightedText text={c.tema} /></td>
                  <td className="border border-slate-300 p-2"><HighlightedText text={c.subtemas} /></td>
                  <td className="border border-slate-300 p-2 text-slate-600"><HighlightedText text={c.paginaORecurso} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
            Recomendaciones de Estudio
          </div>
          <ul className="list-disc list-inside border border-slate-300 p-3 space-y-1 mb-4">
            {data.recomendacionesEstudio.filter(Boolean).map((rec, i) => (
              <li key={i}><HighlightedText text={rec} /></li>
            ))}
          </ul>

          <div
            className="p-3 rounded border text-xs italic text-slate-700"
            style={{ borderColor: config.accentColor, backgroundColor: '#fffbeb' }}
          >
            <HighlightedText text={data.observacionesPadres} />
          </div>
        </div>
      </div>
    </div>
  );
};
