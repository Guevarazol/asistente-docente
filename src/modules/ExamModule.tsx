import React, { useEffect, useRef, useState } from 'react';
import { BookMarked, CheckSquare, Sparkles } from 'lucide-react';
import type {
  ExamData,
  ExamItemType,
  ExtractedTemplate,
  SavedDocument,
  SchoolConfig,
  UploadedAttachment,
} from '../types/casm';
import { getDocumentsByModule, saveDocumentToHistory } from '../db/indexedDb';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildExamPrompt } from '../prompts/modulePrompts';
import { formatTodayIso } from '../utils/spanishDateToWords';
import { downloadStructuredDocx } from '../utils/exportEngine';
import { ContentInputPanel } from '../components/ContentInputPanel';
import { DocumentActionBar } from '../components/DocumentActionBar';
import { ModuleTemplatePicker } from '../components/ModuleTemplatePicker';
import { HighlightedText } from '../components/HighlightedText';
import {
  getDefaultSubject,
  getDefaultTeacherName,
  getSubjectOptions,
} from '../utils/userProfileDefaults';

interface ExamModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<ExamData> | null;
}

const ITEM_TYPE_OPTIONS: Array<{ id: ExamItemType; label: string; earlyChildhood?: boolean }> = [
  { id: 'seleccion_multiple', label: 'Selección múltiple' },
  { id: 'relacionar_columnas', label: 'Relacionar columnas ( )' },
  { id: 'completar', label: 'Completar' },
  { id: 'verdadero_falso', label: 'Verdadero / Falso' },
  { id: 'analisis', label: 'Análisis (con líneas)' },
  { id: 'tabla_clasificacion', label: 'Tabla de clasificación' },
  { id: 'problemas', label: 'Resolución de problemas' },
  { id: 'visual_colorear', label: 'Colorear (Kinder/1.º Ciclo)', earlyChildhood: true },
  { id: 'visual_cheque', label: 'Marcar con ✓ (Kinder/1.º Ciclo)', earlyChildhood: true },
  { id: 'visual_unir', label: 'Unir con líneas (Kinder/1.º Ciclo)', earlyChildhood: true },
];

function createDefaultExam(config: SchoolConfig): ExamData {
  return {
    tipoExamen: 'Examen de Periodo',
    periodo: 'Periodo I',
    grado: config.grades[6] || '4.º Grado',
    seccion: config.sections[0] || 'A',
    asignatura: getDefaultSubject(config, 1),
    docente: getDefaultTeacherName(config, 1),
    fecha: formatTodayIso(),
    totalValor: config.gradingScale === 'percentage' ? '100%' : '10.0 puntos',
    sistemaCalificacion: config.gradingScale,
    esKinderOPrimerCiclo: false,
    dificultad: 'Intermedio',
    versiculo: config.verse,
    indicacionesGenerales:
      'Lee cuidadosamente cada parte antes de responder. Trabaja con orden, aseo y honestidad. Utiliza bolígrafo azul o negro (lápiz en ejercicios matemáticos).',
    partes: [
      {
        numeroRomano: 'I PARTE',
        titulo: 'SELECCIÓN MÚLTIPLE',
        tipo: 'seleccion_multiple',
        indicacion: 'Subraya o encierra en un círculo la letra de la respuesta correcta.',
        valor: config.gradingScale === 'percentage' ? '50%' : '5.0 pts',
        items: [
          {
            numero: 1,
            enunciado: '[COMPLETAR — Genera con IA a partir de tu temario o planificación]',
            opciones: ['a) Opción A', 'b) Opción B', 'c) Opción C', 'd) Opción D'],
            respuestaCorrecta: 'a) [COMPLETAR]',
          },
        ],
      },
    ],
  };
}

export const ExamModule: React.FC<ExamModuleProps> = ({ config, initialDocument }) => {
  const [docId, setDocId] = useState(initialDocument?.id || `doc-exam-${Date.now()}`);
  const [data, setData] = useState<ExamData>(initialDocument?.data || createDefaultExam(config));
  const [totalItems, setTotalItems] = useState(12);
  const [selectedTypes, setSelectedTypes] = useState<ExamItemType[]>([
    'seleccion_multiple',
    'relacionar_columnas',
    'completar',
    'analisis',
  ]);
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
      getDocumentsByModule('temarios'),
      getDocumentsByModule('planificacion'),
    ]).then(([temarios, planes]) => {
      setSavedSources([...temarios, ...planes]);
    });
  }, []);

  const isEarlyGrade = (grade: string) =>
    /kinder|preparatoria|1\.º grado|2\.º grado|3\.º grado/i.test(grade);

  const handleGradeChange = (grade: string) => {
    const early = isEarlyGrade(grade);
    setData((prev) => ({ ...prev, grado: grade, esKinderOPrimerCiclo: early }));
    if (early) {
      setSelectedTypes(['visual_colorear', 'visual_cheque', 'visual_unir']);
    }
  };

  const toggleItemType = (id: ExamItemType) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((t) => t !== id) : prev) : [...prev, id]
    );
  };

  const handleImportSavedDoc = (sourceId: string) => {
    const found = savedSources.find((s) => s.id === sourceId);
    if (!found) return;
    setData((p) => ({
      ...p,
      grado: found.grade || p.grado,
      seccion: found.section || p.seccion,
      asignatura: found.subject || p.asignatura,
      esKinderOPrimerCiclo: isEarlyGrade(found.grade || p.grado),
    }));
    setNotes(
      `Generar examen alineado al documento guardado "${found.title}":\n${JSON.stringify(found.data, null, 2).slice(0, 6000)}`
    );
  };

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildExamPrompt({
        config,
        userNotes: notes || 'Genera el examen a partir de los archivos o fotografías adjuntas.',
        grade: data.grado,
        section: data.seccion,
        subject: data.asignatura,
        teacher: data.docente,
        examType: data.tipoExamen,
        period: data.periodo,
        difficulty: data.dificultad,
        totalItems,
        isEarlyChildhood: data.esKinderOPrimerCiclo,
        selectedItemTypes: selectedTypes,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<ExamData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        versiculo: parsed.versiculo || config.verse,
        sistemaCalificacion: config.gradingScale,
        totalValor: config.gradingScale === 'percentage' ? '100%' : '10.0 puntos',
        partes: Array.isArray(parsed.partes) && parsed.partes.length > 0 ? parsed.partes : prev.partes,
      }));
      setViewMode('vista_previa');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al generar el examen.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<ExamData>({
      id: docId,
      module: 'examenes',
      title: `${data.tipoExamen} (${data.periodo}) — ${data.asignatura} ${data.grado}`,
      grade: data.grado,
      section: data.seccion,
      subject: data.asignatura,
      period: data.periodo,
      date: data.fecha || formatTodayIso(),
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
        schoolSubtitle: `${data.tipoExamen} · ${data.periodo} · ${data.grado} "${data.seccion}" · ${data.asignatura}`,
        title: `${data.tipoExamen.toUpperCase()} — ${data.asignatura.toUpperCase()}`,
        subtitle: `"${data.versiculo}"`,
        orientation: 'portrait',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'Datos del Estudiante',
            keyValues: [
              { label: 'Estudiante', value: '_________________________________________' },
              { label: 'Docente', value: data.docente },
              { label: 'Grado y Sección', value: `${data.grado} "${data.seccion}"` },
              { label: 'Valor Total / Nota', value: `${data.totalValor}   |   Nota obtenida: ________` },
            ],
            paragraphs: [`Indicaciones generales: ${data.indicacionesGenerales}`],
          },
          ...data.partes.map((part) => ({
            heading: `${part.numeroRomano}: ${part.titulo} (${part.valor})`,
            paragraphs: [
              `Indicación: ${part.indicacion}`,
              ...part.items.flatMap((it) => {
                const lines = [`${it.numero}. ${it.enunciado}`];
                if (it.opciones?.length) lines.push(`   ${it.opciones.join('    ')}`);
                if (part.tipo === 'analisis' || part.tipo === 'problemas') {
                  lines.push('   __________________________________________________________________');
                  lines.push('   __________________________________________________________________');
                }
                return lines;
              }),
            ],
          })),
          {
            heading: 'CLAVE DE RESPUESTAS (USO EXCLUSIVO DEL DOCENTE)',
            pageBreakBefore: true,
            table: {
              headers: ['Parte', 'Ítem', 'Respuesta Correcta'],
              rows: data.partes.flatMap((p) =>
                p.items.map((it) => [p.numeroRomano, String(it.numero), it.respuestaCorrecta])
              ),
            },
          },
        ],
      },
      `Examen_${data.asignatura}_${data.grado}_${data.periodo}`
    );
  };

  return (
    <div className="space-y-5">
      <ModuleTemplatePicker
        moduleId="examenes"
        moduleLabel="Exámenes"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* Exam Settings Panel */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-[#003366]">Configuración de la evaluación</span>
          <span className="text-xs font-medium text-slate-600">
            Sistema activo:{' '}
            <strong className="text-[#003366]">
              {config.gradingScale === 'percentage' ? 'Porcentaje (100%)' : 'Puntos (Escala 10)'}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de examen</label>
            <select
              value={data.tipoExamen}
              onChange={(e) => setData((p) => ({ ...p, tipoExamen: e.target.value as ExamData['tipoExamen'] }))}
              className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="Examen Mensual">Examen Mensual</option>
              <option value="Examen de Periodo">Examen de Periodo</option>
              <option value="Examen Final">Examen Final</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Periodo</label>
            <input
              type="text"
              value={data.periodo}
              onChange={(e) => setData((p) => ({ ...p, periodo: e.target.value }))}
              className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
            <select
              value={data.grado}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
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
              className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              {getSubjectOptions(config, data.asignatura).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Dificultad</label>
            <select
              value={data.dificultad}
              onChange={(e) => setData((p) => ({ ...p, dificultad: e.target.value as ExamData['dificultad'] }))}
              className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="Básico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">N.º de ítems</label>
            <input
              type="number"
              min={4}
              max={40}
              value={totalItems}
              onChange={(e) => setTotalItems(Math.max(4, Math.min(40, Number(e.target.value) || 10)))}
              className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>
        </div>

        {/* Kinder/Primer Ciclo Toggle + Import from Saved Temario/Plan */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#003366] cursor-pointer">
            <input
              type="checkbox"
              checked={data.esKinderOPrimerCiclo}
              onChange={(e) => setData((p) => ({ ...p, esKinderOPrimerCiclo: e.target.checked }))}
              className="w-4 h-4 accent-[#003366]"
            />
            <span>Modo Kinder / Primer Ciclo (letra grande, ítems visuales y espacio para dibujos)</span>
          </label>

          {savedSources.length > 0 && (
            <div className="flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-[#003366]" />
              <select
                defaultValue=""
                onChange={(e) => handleImportSavedDoc(e.target.value)}
                className="min-h-[38px] px-2.5 rounded-lg border border-slate-300 text-xs bg-slate-50"
              >
                <option value="">Importar desde Temario o Planificación guardada...</option>
                {savedSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.module === 'temarios' ? 'Temario' : 'Planificación'}] {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Item Types Selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600">Tipos de ítem a incluir:</span>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TYPE_OPTIONS.map((opt) => {
              const active = selectedTypes.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleItemType(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    active
                      ? 'bg-[#003366] text-white border-[#003366]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="no-print">
        <ContentInputPanel
          label="Temario, planificación, apuntes o fotos del contenido a evaluar"
          placeholder="Pega aquí el temario del examen o sube la foto/PDF de las páginas del cuaderno o libro..."
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel="Generar Examen + Clave de Respuestas"
          errorMessage={aiError}
        />
      </div>

      {/* Edit vs Preview Toggle */}
      <div className="no-print flex p-1 bg-slate-200/80 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setViewMode('editar')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'editar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Editar ítems y clave
        </button>
        <button
          type="button"
          onClick={() => setViewMode('vista_previa')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'vista_previa' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Vista previa (Examen + Clave)
        </button>
      </div>

      {viewMode === 'editar' && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">Versículo institucional</label>
              <input
                type="text"
                value={data.versiculo}
                onChange={(e) => setData((p) => ({ ...p, versiculo: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Indicaciones generales</label>
            <textarea
              rows={2}
              value={data.indicacionesGenerales}
              onChange={(e) => setData((p) => ({ ...p, indicacionesGenerales: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          {data.partes.map((part, pIdx) => (
            <div key={pIdx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={`${part.numeroRomano}: ${part.titulo}`}
                  onChange={(e) => {
                    const [rom, ...rest] = e.target.value.split(':');
                    setData((prev) => ({
                      ...prev,
                      partes: prev.partes.map((pt, i) =>
                        i === pIdx
                          ? { ...pt, numeroRomano: rom.trim(), titulo: rest.join(':').trim() }
                          : pt
                      ),
                    }));
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                />
                <input
                  type="text"
                  value={part.valor}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      partes: prev.partes.map((pt, i) =>
                        i === pIdx ? { ...pt, valor: e.target.value } : pt
                      ),
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                />
                <input
                  type="text"
                  value={part.indicacion}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      partes: prev.partes.map((pt, i) =>
                        i === pIdx ? { ...pt, indicacion: e.target.value } : pt
                      ),
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>

              {part.items.map((it, iIdx) => (
                <div key={iIdx} className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500">Ítem {it.numero}</label>
                    <textarea
                      rows={2}
                      value={it.enunciado}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          partes: prev.partes.map((pt, pi) =>
                            pi === pIdx
                              ? {
                                  ...pt,
                                  items: pt.items.map((item, ii) =>
                                    ii === iIdx ? { ...item, enunciado: e.target.value } : item
                                  ),
                                }
                              : pt
                          ),
                        }))
                      }
                      className="w-full p-2 rounded border border-slate-200 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-emerald-700">Respuesta clave</label>
                    <textarea
                      rows={2}
                      value={it.respuestaCorrecta}
                      onChange={(e) =>
                        setData((prev) => ({
                          ...prev,
                          partes: prev.partes.map((pt, pi) =>
                            pi === pIdx
                              ? {
                                  ...pt,
                                  items: pt.items.map((item, ii) =>
                                    ii === iIdx ? { ...item, respuestaCorrecta: e.target.value } : item
                                  ),
                                }
                              : pt
                          ),
                        }))
                      }
                      className="w-full p-2 rounded border border-emerald-200 bg-emerald-50/40 text-xs mt-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <DocumentActionBar
        previewRef={previewRef}
        fileBaseName={`Examen_${data.asignatura}_${data.grado}_${data.periodo}`}
        whatsappMessage={`${data.tipoExamen} (${data.periodo}) de ${data.asignatura} — ${data.grado} "${data.seccion}" · ${config.schoolName}`}
        orientation="portrait"
        pageSize="letter"
        onDownloadWord={handleDownloadWord}
        onSaveHistory={handleSaveHistory}
        onDuplicate={() => setDocId(`doc-exam-${Date.now()}`)}
      />

      {/* WYSIWYG Preview: Page 1+ Exam, Separate Final Page Answer Key */}
      <div className="print-only-container overflow-x-auto pb-4">
        <div ref={previewRef} className="space-y-6">
          {/* PAGE 1: EXAM */}
          <div
            className={`doc-paper doc-paper-letter-portrait print-page ${
              data.esKinderOPrimerCiclo ? 'text-[14px] leading-relaxed' : 'text-[11px] leading-snug'
            }`}
          >
            {/* Official Exam Header Table */}
            <table className="w-full border-collapse border-2 mb-3 text-[11px]" style={{ borderColor: config.primaryColor }}>
              <tbody>
                <tr>
                  <td
                    rowSpan={4}
                    className="border p-2 w-24 text-center align-middle"
                    style={{ borderColor: config.primaryColor }}
                  >
                    <img
                      src={config.casmLogo || '/assets/casm-logo.png'}
                      alt="Logo Institucional"
                      className="w-16 h-16 object-contain mx-auto"
                      referrerPolicy="no-referrer"
                    />
                  </td>
                  <td
                    colSpan={3}
                    className="border p-1.5 text-center font-extrabold uppercase text-white text-sm"
                    style={{ backgroundColor: config.primaryColor, borderColor: config.primaryColor }}
                  >
                    {config.schoolName}
                  </td>
                  <td
                    rowSpan={2}
                    className="border p-1.5 text-center w-24 align-middle"
                    style={{ borderColor: config.primaryColor }}
                  >
                    <div className="text-[9px] font-bold uppercase text-slate-500">NOTA</div>
                    <div className="h-8" />
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="border p-1 text-center font-bold text-xs" style={{ borderColor: config.primaryColor, color: config.primaryColor }}>
                    {data.tipoExamen.toUpperCase()} — {data.periodo.toUpperCase()} · AÑO {config.academicYear}
                  </td>
                </tr>
                <tr>
                  <td className="border p-1" style={{ borderColor: config.primaryColor }}>
                    <strong>Grado:</strong> {data.grado} "{data.seccion}"
                  </td>
                  <td className="border p-1" style={{ borderColor: config.primaryColor }}>
                    <strong>Asignatura:</strong> {data.asignatura}
                  </td>
                  <td className="border p-1" style={{ borderColor: config.primaryColor }}>
                    <strong>Docente:</strong> <HighlightedText text={data.docente} />
                  </td>
                  <td className="border p-1 text-center font-mono font-bold" style={{ borderColor: config.primaryColor }}>
                    Total: {data.totalValor}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="border p-1.5" style={{ borderColor: config.primaryColor }}>
                    <strong>Nombre del estudiante:</strong> ____________________________________________________
                  </td>
                  <td className="border p-1" style={{ borderColor: config.primaryColor }}>
                    <strong>Fecha:</strong> {data.fecha}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Institutional Verse */}
            <div
              className="text-center italic font-semibold py-1.5 px-3 mb-2.5 rounded border text-xs"
              style={{
                borderColor: config.accentColor,
                backgroundColor: '#fffbeb',
                color: config.primaryColor,
              }}
            >
              “{data.versiculo}”
            </div>

            {/* General Instructions */}
            <div className="mb-4 text-[11px] bg-slate-50 border border-slate-200 p-2 rounded">
              <strong style={{ color: config.primaryColor }}>Indicaciones generales: </strong>
              <HighlightedText text={data.indicacionesGenerales} />
            </div>

            {/* Exam Parts */}
            <div className="space-y-5">
              {data.partes.map((part, pIdx) => (
                <div key={pIdx} className="space-y-2.5">
                  <div
                    className="flex items-center justify-between border-b-2 pb-1 font-bold"
                    style={{ borderColor: config.primaryColor, color: config.primaryColor }}
                  >
                    <span>
                      {part.numeroRomano}. {part.titulo}
                    </span>
                    <span className="font-mono text-xs">Valor: {part.valor}</span>
                  </div>
                  <p className="italic text-slate-700 text-[11px]">
                    <strong>Indicación:</strong> <HighlightedText text={part.indicacion} />
                  </p>

                  <div className="space-y-3 pl-1">
                    {part.items.map((item) => (
                      <div key={item.numero} className="avoid-break space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="font-bold shrink-0">{item.numero}.</span>
                          <div className="flex-1">
                            {part.tipo === 'verdadero_falso' && (
                              <span className="font-mono mr-2">( ___ )</span>
                            )}
                            {part.tipo === 'visual_cheque' && (
                              <span className="inline-block w-5 h-5 border-2 border-slate-700 rounded mr-2 align-middle" />
                            )}
                            <HighlightedText text={item.enunciado} />

                            {/* Relacionar columnas */}
                            {part.tipo === 'relacionar_columnas' && item.columnaDerecha && (
                              <div className="grid grid-cols-2 gap-4 mt-1 pl-2">
                                <span>{item.enunciado}</span>
                                <span>( ___ ) {item.columnaDerecha}</span>
                              </div>
                            )}

                            {/* Multiple choice options */}
                            {item.opciones && item.opciones.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5 pl-3">
                                {item.opciones.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-1.5">
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Visual drawing / coloring box for Kinder / Primer Ciclo */}
                            {(item.espacioImagen ||
                              part.tipo === 'visual_colorear' ||
                              part.tipo === 'visual_unir') && (
                              <div className="mt-2 h-24 border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center text-xs text-slate-400">
                                Espacio para imagen / dibujo / actividad visual
                              </div>
                            )}

                            {/* Classification Table */}
                            {part.tipo === 'tabla_clasificacion' && (
                              <table className="w-full border-collapse border border-slate-400 mt-2">
                                <thead>
                                  <tr className="bg-slate-100">
                                    {(item.tablaColumnas?.length ? item.tablaColumnas : ['Categoría A', 'Categoría B']).map(
                                      (col, cIdx) => (
                                        <th key={cIdx} className="border border-slate-400 p-1.5 text-left text-xs">
                                          {col}
                                        </th>
                                      )
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {[0, 1, 2].map((r) => (
                                    <tr key={r}>
                                      {(item.tablaColumnas?.length ? item.tablaColumnas : ['A', 'B']).map((_, cIdx) => (
                                        <td key={cIdx} className="border border-slate-400 h-7" />
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {/* Answer Lines for analysis / problems */}
                            {(part.tipo === 'analisis' || part.tipo === 'problemas') && (
                              <div className="space-y-4 mt-3">
                                {Array.from({ length: item.lineasRespuesta || 3 }).map((_, lIdx) => (
                                  <div key={lIdx} className="border-b border-slate-400 h-3" />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEPARATE PAGE: ANSWER KEY */}
          <div className="doc-paper doc-paper-letter-portrait print-page page-break-before text-[11px]">
            <div
              className="border-b-2 pb-2 mb-4 flex items-center justify-between"
              style={{ borderColor: config.primaryColor }}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" style={{ color: config.primaryColor }} />
                <div>
                  <div className="text-sm font-extrabold uppercase" style={{ color: config.primaryColor }}>
                    Clave de Respuestas — Uso Exclusivo del Docente
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {config.schoolName} · {data.tipoExamen} ({data.periodo}) · {data.asignatura} · {data.grado} "{data.seccion}"
                  </div>
                </div>
              </div>
              <div className="text-right font-mono font-bold text-xs" style={{ color: config.primaryColor }}>
                Total: {data.totalValor}
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="text-white" style={{ backgroundColor: config.primaryColor }}>
                  <th className="border border-slate-300 p-2 text-left w-28">Parte</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Ítem</th>
                  <th className="border border-slate-300 p-2 text-left">Respuesta Correcta / Criterio de Calificación</th>
                </tr>
              </thead>
              <tbody>
                {data.partes.flatMap((part, pIdx) =>
                  part.items.map((item, iIdx) => (
                    <tr key={`${pIdx}-${iIdx}`} className={iIdx % 2 === 1 ? 'bg-slate-50' : ''}>
                      <td className="border border-slate-300 p-2 font-semibold">{part.numeroRomano}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold">{item.numero}</td>
                      <td className="border border-slate-300 p-2">
                        <HighlightedText text={item.respuestaCorrecta} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-500">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verifica cada respuesta antes de reproducir la evaluación.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
