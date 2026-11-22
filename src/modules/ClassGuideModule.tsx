import React, { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import type {
  ClassGuideData,
  ExtractedTemplate,
  SavedDocument,
  SchoolConfig,
  UploadedAttachment,
} from '../types/casm';
import { saveDocumentToHistory } from '../db/indexedDb';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildClassGuidePrompt } from '../prompts/modulePrompts';
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
} from '../utils/userProfileDefaults';

interface ClassGuideModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<ClassGuideData> | null;
}

const TERCER_CICLO_GRADES = ['7.º Grado', '8.º Grado', '9.º Grado'];
const BACHILLERATO_GRADES = [
  '1.º Año Bachillerato General',
  '2.º Año Bachillerato General',
  '1.º Año Bachillerato Técnico',
  '2.º Año Bachillerato Técnico',
  '3.º Año Bachillerato Técnico',
];

function createEmptyGuide(config: SchoolConfig, tab: 'tercer_ciclo' | 'bachillerato'): ClassGuideData {
  return {
    nivelTab: tab,
    asignatura: getDefaultSubject(config, 2),
    grado: tab === 'tercer_ciclo' ? '7.º Grado' : '1.º Año Bachillerato General',
    seccion: config.sections[0] || 'A',
    docente: getDefaultTeacherName(config, tab === 'tercer_ciclo' ? 2 : 3),
    unidad: 'Unidad 1',
    tema: '[COMPLETAR]',
    fecha: formatTodayIso(),
    duracionMinutos: 45,
    objetivoIndicador: '[COMPLETAR]',
    saberesPrevios: '[COMPLETAR]',
    desarrolloContenido: '[COMPLETAR]',
    ejemplosResueltos: '[COMPLETAR]',
    actividades: '[COMPLETAR]',
    evaluacion: '[COMPLETAR]',
    rubrica:
      tab === 'bachillerato'
        ? [
            {
              criterio: 'Dominio conceptual y rigor técnico',
              excelente: 'Aplica conceptos con precisión y fundamento.',
              satisfactorio: 'Aplica correctamente la mayoría de conceptos.',
              enProceso: 'Presenta vacíos conceptuales importantes.',
              ponderacion: '40%',
            },
            {
              criterio: 'Análisis de casos y resolución de problemas',
              excelente: 'Resuelve con metodología completa y argumentada.',
              satisfactorio: 'Resuelve parcialmente con pasos claros.',
              enProceso: 'Requiere guía constante para plantear soluciones.',
              ponderacion: '60%',
            },
          ]
        : [],
    tarea: '[COMPLETAR]',
    referencias: '[VERIFICAR]',
  };
}

export const ClassGuideModule: React.FC<ClassGuideModuleProps> = ({
  config,
  initialDocument,
}) => {
  const [docId, setDocId] = useState(initialDocument?.id || `doc-guia-${Date.now()}`);
  const [data, setData] = useState<ClassGuideData>(
    initialDocument?.data || createEmptyGuide(config, 'tercer_ciclo')
  );
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractedTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editar' | 'vista_previa'>('vista_previa');

  const previewRef = useRef<HTMLDivElement>(null);

  const handleSwitchLevelTab = (tab: 'tercer_ciclo' | 'bachillerato') => {
    setData((prev) => ({
      ...prev,
      nivelTab: tab,
      grado: tab === 'tercer_ciclo' ? TERCER_CICLO_GRADES[0] : BACHILLERATO_GRADES[0],
      rubrica:
        tab === 'bachillerato' && (!prev.rubrica || prev.rubrica.length === 0)
          ? createEmptyGuide(config, 'bachillerato').rubrica
          : prev.rubrica,
    }));
  };

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildClassGuidePrompt({
        config,
        userNotes: notes || 'Utiliza el contenido de los archivos o fotografías adjuntas.',
        levelTab: data.nivelTab,
        grade: data.grado,
        section: data.seccion,
        subject: data.asignatura,
        teacher: data.docente,
        duration: data.duracionMinutos,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<ClassGuideData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        nivelTab: prev.nivelTab,
        duracionMinutos: prev.duracionMinutos,
      }));
      setViewMode('vista_previa');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al generar la guía por clase.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<ClassGuideData>({
      id: docId,
      module: 'guias',
      title: `Guía (${data.nivelTab === 'tercer_ciclo' ? 'Tercer Ciclo' : 'Bachillerato'}) — ${data.asignatura}: ${data.tema}`,
      grade: data.grado,
      section: data.seccion,
      subject: data.asignatura,
      period: `${data.duracionMinutos} min`,
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
        schoolSubtitle: `Guía de Clase · ${data.nivelTab === 'tercer_ciclo' ? 'Tercer Ciclo' : 'Bachillerato'} · Duración: ${data.duracionMinutos} minutos`,
        title: `GUÍA DE CLASE — ${data.tema.toUpperCase()}`,
        subtitle: `${data.asignatura} · ${data.grado} "${data.seccion}" · ${data.unidad}`,
        orientation: 'portrait',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'Datos Generales',
            keyValues: [
              { label: 'Asignatura', value: data.asignatura },
              { label: 'Grado y Sección', value: `${data.grado} "${data.seccion}"` },
              { label: 'Docente', value: data.docente },
              { label: 'Unidad / Tema', value: `${data.unidad} — ${data.tema}` },
              { label: 'Fecha y Duración', value: `${data.fecha} · ${data.duracionMinutos} minutos` },
              { label: 'Objetivo / Indicador de logro', value: data.objetivoIndicador },
            ],
          },
          { heading: '1. Saberes Previos', paragraphs: [data.saberesPrevios] },
          { heading: '2. Desarrollo del Contenido', paragraphs: [data.desarrolloContenido] },
          {
            heading:
              data.nivelTab === 'tercer_ciclo'
                ? '3. Ejemplos Resueltos Paso a Paso'
                : '3. Estudio de Caso / Modelo Resuelto',
            paragraphs: [data.ejemplosResueltos],
          },
          { heading: '4. Actividades de Clase', paragraphs: [data.actividades] },
          {
            heading: '5. Evaluación',
            paragraphs: [data.evaluacion],
            table:
              data.nivelTab === 'bachillerato' && data.rubrica?.length
                ? {
                    headers: ['Criterio', 'Excelente', 'Satisfactorio', 'En Proceso', 'Valor'],
                    rows: data.rubrica.map((r) => [
                      r.criterio,
                      r.excelente,
                      r.satisfactorio,
                      r.enProceso,
                      r.ponderacion,
                    ]),
                  }
                : undefined,
          },
          { heading: '6. Tarea y Referencias', paragraphs: [`Tarea: ${data.tarea}`, `Referencias: ${data.referencias}`] },
        ],
      },
      `Guia_Clase_${data.asignatura}_${data.grado}`
    );
  };

  const gradeOptions = data.nivelTab === 'tercer_ciclo' ? TERCER_CICLO_GRADES : BACHILLERATO_GRADES;

  return (
    <div className="space-y-5">
      {/* Dedicated Separate Tabs: TERCER CICLO vs BACHILLERATO */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSwitchLevelTab('tercer_ciclo')}
            className={`min-h-[52px] px-4 py-2.5 rounded-xl text-left transition cursor-pointer ${
              data.nivelTab === 'tercer_ciclo'
                ? 'bg-[#003366] text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs sm:text-sm font-extrabold">TERCER CICLO</div>
            <div className={`text-[11px] ${data.nivelTab === 'tercer_ciclo' ? 'text-sky-100' : 'text-slate-500'}`}>
              7.º, 8.º y 9.º · Paso a paso y ejemplos resueltos
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchLevelTab('bachillerato')}
            className={`min-h-[52px] px-4 py-2.5 rounded-xl text-left transition cursor-pointer ${
              data.nivelTab === 'bachillerato'
                ? 'bg-[#003366] text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs sm:text-sm font-extrabold">BACHILLERATO</div>
            <div className={`text-[11px] ${data.nivelTab === 'bachillerato' ? 'text-sky-100' : 'text-slate-500'}`}>
              General y Técnico (1.º–3.º) · Casos y rúbricas
            </div>
          </button>
        </div>
      </div>

      <ModuleTemplatePicker
        moduleId="guias"
        moduleLabel="Guías por Clase"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* Guide Parameters & 45 / 90 min Duration Selector */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
          <select
            value={data.grado}
            onChange={(e) => setData((p) => ({ ...p, grado: e.target.value }))}
            className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Sección</label>
          <select
            value={data.seccion}
            onChange={(e) => setData((p) => ({ ...p, seccion: e.target.value }))}
            className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
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
            className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs bg-white"
          >
            {getSubjectOptions(config, data.asignatura).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Docente</label>
          <input
            type="text"
            value={data.docente}
            onChange={(e) => setData((p) => ({ ...p, docente: e.target.value }))}
            className="w-full min-h-[42px] px-2.5 rounded-xl border border-slate-300 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Duración de la clase</label>
          <div className="grid grid-cols-2 gap-2">
            {([45, 90] as const).map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setData((p) => ({ ...p, duracionMinutos: min }))}
                className={`min-h-[42px] rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  data.duracionMinutos === min
                    ? 'bg-[#FFA92D] text-[#002244] border-[#FFA92D]'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{min} minutos</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="no-print">
        <ContentInputPanel
          label={`Tema y material base para ${data.nivelTab === 'tercer_ciclo' ? 'Tercer Ciclo' : 'Bachillerato'} (${data.duracionMinutos} min)`}
          placeholder={
            data.nivelTab === 'tercer_ciclo'
              ? 'Ej: Ecuaciones lineales de primer grado con una incógnita. Incluir 2 ejemplos resueltos paso a paso y 5 ejercicios guiados...'
              : 'Ej: Leyes de Newton aplicadas a planos inclinados. Incluir análisis de caso técnico, investigación breve y rúbrica de evaluación...'
          }
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel={`Generar Guía de ${data.nivelTab === 'tercer_ciclo' ? 'Tercer Ciclo' : 'Bachillerato'}`}
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
          Editar guía
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
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unidad</label>
              <input
                type="text"
                value={data.unidad}
                onChange={(e) => setData((p) => ({ ...p, unidad: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tema</label>
              <input
                type="text"
                value={data.tema}
                onChange={(e) => setData((p) => ({ ...p, tema: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={/^\d{4}-\d{2}-\d{2}$/.test(data.fecha) ? data.fecha : ''}
                onChange={(e) => setData((p) => ({ ...p, fecha: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          {(
            [
              ['objetivoIndicador', 'Objetivo / Indicador de logro', 2],
              ['saberesPrevios', 'Saberes previos', 2],
              ['desarrolloContenido', 'Desarrollo del contenido', 5],
              ['ejemplosResueltos', data.nivelTab === 'tercer_ciclo' ? 'Ejemplos resueltos paso a paso' : 'Análisis de caso / ejemplo técnico', 4],
              ['actividades', 'Actividades', 4],
              ['evaluacion', 'Evaluación', 3],
              ['tarea', 'Tarea', 2],
              ['referencias', 'Referencias', 2],
            ] as const
          ).map(([field, label, rows]) => (
            <div key={field}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
              <textarea
                rows={rows}
                value={String(data[field])}
                onChange={(e) => setData((p) => ({ ...p, [field]: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      <DocumentActionBar
        previewRef={previewRef}
        fileBaseName={`Guia_${data.nivelTab}_${data.asignatura}_${data.grado}`}
        whatsappMessage={`Guía por Clase (${data.duracionMinutos} min) — ${data.asignatura}, ${data.grado}: ${data.tema} · ${config.schoolName}`}
        orientation="portrait"
        pageSize="letter"
        onDownloadWord={handleDownloadWord}
        onSaveHistory={handleSaveHistory}
        onDuplicate={() => setDocId(`doc-guia-${Date.now()}`)}
      />

      <div className="print-only-container overflow-x-auto pb-4">
        <div ref={previewRef} className="doc-paper doc-paper-letter-portrait print-page text-[11px] leading-relaxed">
          <SchoolDocHeader
            config={config}
            documentTitle={`Guía por Clase — ${data.nivelTab === 'tercer_ciclo' ? 'Tercer Ciclo' : 'Bachillerato'}`}
            subtitle={`Duración: ${data.duracionMinutos} minutos`}
          />

          <table className="w-full border-collapse border border-slate-300 mb-3 text-[11px]">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Asignatura:</td>
                <td className="border border-slate-300 p-1.5">{data.asignatura}</td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Grado / Sec.:</td>
                <td className="border border-slate-300 p-1.5">{data.grado} "{data.seccion}"</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Unidad:</td>
                <td className="border border-slate-300 p-1.5"><HighlightedText text={data.unidad} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Fecha / Tiempo:</td>
                <td className="border border-slate-300 p-1.5">{data.fecha} · {data.duracionMinutos} min</td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Tema:</td>
                <td className="border border-slate-300 p-1.5 font-bold text-[#003366]"><HighlightedText text={data.tema} /></td>
                <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Docente:</td>
                <td className="border border-slate-300 p-1.5"><HighlightedText text={data.docente} /></td>
              </tr>
            </tbody>
          </table>

          {[
            { title: 'Objetivo / Indicador de Logro', body: data.objetivoIndicador },
            { title: '1. Saberes Previos', body: data.saberesPrevios },
            { title: '2. Desarrollo del Contenido', body: data.desarrolloContenido },
            {
              title:
                data.nivelTab === 'tercer_ciclo'
                  ? '3. Ejemplos Resueltos Paso a Paso'
                  : '3. Análisis de Caso / Resolución Modelo',
              body: data.ejemplosResueltos,
            },
            { title: '4. Actividades de Clase', body: data.actividades },
            { title: '5. Evaluación', body: data.evaluacion },
          ].map((sec) => (
            <div key={sec.title} className="mb-3">
              <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1" style={{ backgroundColor: config.primaryColor }}>
                {sec.title}
              </div>
              <div className="border border-slate-200 p-2.5 whitespace-pre-wrap">
                <HighlightedText text={sec.body} />
              </div>
            </div>
          ))}

          {data.nivelTab === 'bachillerato' && data.rubrica && data.rubrica.length > 0 && (
            <div className="mb-3 avoid-break">
              <div className="text-xs font-bold uppercase px-2.5 py-1 mb-1 text-[#003366]" style={{ backgroundColor: '#fff7ed', border: `1px solid ${config.accentColor}` }}>
                Rúbrica de Evaluación (Bachillerato)
              </div>
              <table className="w-full border-collapse border border-slate-300 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-[#003366]">
                    <th className="border border-slate-300 p-1.5 text-left">Criterio</th>
                    <th className="border border-slate-300 p-1.5 text-left">Excelente</th>
                    <th className="border border-slate-300 p-1.5 text-left">Satisfactorio</th>
                    <th className="border border-slate-300 p-1.5 text-left">En Proceso</th>
                    <th className="border border-slate-300 p-1.5 text-center w-14">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rubrica.map((r, i) => (
                    <tr key={i}>
                      <td className="border border-slate-300 p-1.5 font-semibold"><HighlightedText text={r.criterio} /></td>
                      <td className="border border-slate-300 p-1.5"><HighlightedText text={r.excelente} /></td>
                      <td className="border border-slate-300 p-1.5"><HighlightedText text={r.satisfactorio} /></td>
                      <td className="border border-slate-300 p-1.5"><HighlightedText text={r.enProceso} /></td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono font-bold">{r.ponderacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="border border-slate-200 p-2.5">
              <div className="font-bold text-xs mb-1" style={{ color: config.primaryColor }}>6. Tarea</div>
              <div className="whitespace-pre-wrap"><HighlightedText text={data.tarea} /></div>
            </div>
            <div className="border border-slate-200 p-2.5">
              <div className="font-bold text-xs mb-1" style={{ color: config.primaryColor }}>7. Referencias</div>
              <div className="whitespace-pre-wrap"><HighlightedText text={data.referencias} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
