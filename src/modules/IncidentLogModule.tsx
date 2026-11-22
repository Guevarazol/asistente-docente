import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckSquare, ShieldAlert, Trash2, Upload, UserCheck } from 'lucide-react';
import type {
  ExtractedTemplate,
  IncidentLogData,
  KnowledgeDoc,
  SavedDocument,
  SchoolConfig,
  UploadedAttachment,
} from '../types/casm';
import {
  deleteKnowledgeDoc,
  getKnowledgeDocsByModule,
  saveDocumentToHistory,
  saveKnowledgeDoc,
} from '../db/indexedDb';
import { parseUploadedFile } from '../utils/fileReader';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildIncidentLogPrompt } from '../prompts/modulePrompts';
import { formatTodayIso, namesToInitials } from '../utils/spanishDateToWords';
import { downloadStructuredDocx } from '../utils/exportEngine';
import { ContentInputPanel } from '../components/ContentInputPanel';
import { DocumentActionBar } from '../components/DocumentActionBar';
import { ModuleTemplatePicker } from '../components/ModuleTemplatePicker';
import { HighlightedText, SchoolDocHeader } from '../components/HighlightedText';
import { getDefaultTeacherName, resolveTeacherSignature } from '../utils/userProfileDefaults';

interface IncidentLogModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<IncidentLogData> | null;
}

function createEmptyIncident(config: SchoolConfig): IncidentLogData {
  return {
    correlativo: `BIT-${config.academicYear}-001`,
    fecha: formatTodayIso(),
    hora: new Date().toTimeString().slice(0, 5),
    lugar: '[COMPLETAR]',
    grado: config.grades[6] || '4.º Grado',
    seccion: config.sections[0] || 'A',
    usarSoloIniciales: true,
    estudiantesInvolucrados: '[COMPLETAR]',
    docenteReporta: getDefaultTeacherName(config, 1),
    testigos: '[COMPLETAR]',
    descripcionHechos: '[COMPLETAR]',
    clasificacionFalta: 'Por determinar [COMPLETAR]',
    articuloReglamento: '[VERIFICAR]',
    medidasFormativas: '[COMPLETAR]',
    comunicacionPadresFecha: '[COMPLETAR]',
    comunicacionPadresMedio: '[COMPLETAR]',
    comunicacionPadresDetalle: '[COMPLETAR]',
    acuerdosCompromisos: '[COMPLETAR]',
    requiereDerivacion: false,
    instanciaDerivacion: 'No aplica',
    detalleDerivacion: 'No aplica en esta etapa.',
    seguimiento: '[COMPLETAR]',
    observacionesLegales:
      'Registro elaborado conforme a la Ley Crecer Juntos (vigente desde el 1 de enero de 2023) y el principio del interés superior de la niñez y adolescencia.',
  };
}

export const IncidentLogModule: React.FC<IncidentLogModuleProps> = ({
  config,
  initialDocument,
}) => {
  const [docId, setDocId] = useState<string>(initialDocument?.id || `doc-bit-${Date.now()}`);
  const [data, setData] = useState<IncidentLogData>(
    initialDocument?.data || createEmptyIncident(config)
  );
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractedTemplate | null>(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [kbCategory, setKbCategory] = useState<KnowledgeDoc['category']>('ley_crecer_juntos');
  const [kbLoading, setKbLoading] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editar' | 'vista_previa'>('editar');

  // Mandatory pre-export checklist
  const [checklist, setChecklist] = useState({
    interesSuperior: false,
    confidencialidad: false,
    redaccionNeutral: false,
    sinLepina: false,
  });

  const kbFileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const allChecked =
    checklist.interesSuperior &&
    checklist.confidencialidad &&
    checklist.redaccionNeutral &&
    checklist.sinLepina;

  const loadKb = async () => {
    const docs = await getKnowledgeDocsByModule('bitacora');
    setKnowledgeDocs(docs);
  };

  useEffect(() => {
    void loadKb();
  }, []);

  const handleUploadKnowledgeDoc = async (file: File | null) => {
    if (!file) return;
    setKbError(null);
    setKbLoading(true);
    try {
      const parsed = await parseUploadedFile(file);
      let contentText = parsed.extractedText || '';

      if (!contentText && (parsed.kind === 'pdf' || parsed.kind === 'image')) {
        // Use Gemini to extract verbatim legal text from PDF/photo so it can be cached locally in IndexedDB
        contentText = await callGeminiAi({
          systemPrompt:
            'Extrae fielmente el texto normativo, títulos y artículos del documento adjunto sin inventar ni alterar nada.',
          userPrompt:
            'Transcribe los artículos, normas y secciones clave de este documento para usarlo como base de conocimiento legal escolar.',
          attachments: [parsed],
        });
      }

      if (!contentText.trim()) {
        throw new Error('No se encontró texto legible en el documento normativo.');
      }

      await saveKnowledgeDoc({
        id: `kb-${Date.now()}`,
        module: 'bitacora',
        title: file.name.replace(/\.[^.]+$/, ''),
        category: kbCategory,
        contentText,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      });
      await loadKb();
    } catch (err) {
      setKbError(err instanceof Error ? err.message : 'Error al procesar el documento normativo.');
    } finally {
      setKbLoading(false);
      if (kbFileRef.current) kbFileRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildIncidentLogPrompt({
        config,
        userNotes: notes || 'Utiliza únicamente la información contenida en los archivos/fotos adjuntos.',
        grade: data.grado,
        section: data.seccion,
        teacher: data.docenteReporta,
        useInitials: data.usarSoloIniciales,
        knowledgeDocs,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<IncidentLogData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        usarSoloIniciales: prev.usarSoloIniciales,
        estudiantesInvolucrados:
          prev.usarSoloIniciales && parsed.estudiantesInvolucrados && !parsed.estudiantesInvolucrados.includes('[COMPLETAR]')
            ? parsed.estudiantesInvolucrados
            : parsed.estudiantesInvolucrados || prev.estudiantesInvolucrados,
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al redactar la bitácora.');
    } finally {
      setGenerating(false);
    }
  };

  const updateField = <K extends keyof IncidentLogData>(key: K, val: IncidentLogData[K]) => {
    setData((prev) => ({ ...prev, [key]: val }));
  };

  const handleToggleInitials = (checked: boolean) => {
    setData((prev) => ({
      ...prev,
      usarSoloIniciales: checked,
      estudiantesInvolucrados:
        checked && prev.estudiantesInvolucrados && !prev.estudiantesInvolucrados.includes('[COMPLETAR]')
          ? namesToInitials(prev.estudiantesInvolucrados)
          : prev.estudiantesInvolucrados,
    }));
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<IncidentLogData>({
      id: docId,
      module: 'bitacora',
      title: `Bitácora ${data.correlativo} — ${data.grado} ${data.seccion}`,
      grade: data.grado,
      section: data.seccion,
      subject: 'Convivencia Escolar',
      period: config.academicYear,
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
        schoolSubtitle: `${config.schoolCity} · Tel. ${config.schoolPhone} · Año Lectivo ${config.academicYear}`,
        title: `BITÁCORA DE INCIDENTES ESCOLARES (${data.correlativo})`,
        subtitle: 'Marco Legal: Ley Crecer Juntos (vigente desde el 1 de enero de 2023) · Confidencial',
        orientation: 'portrait',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'I. Datos Generales del Registro',
            keyValues: [
              { label: 'N.º Correlativo', value: data.correlativo },
              { label: 'Fecha y Hora', value: `${data.fecha} — ${data.hora}` },
              { label: 'Lugar', value: data.lugar },
              { label: 'Grado y Sección', value: `${data.grado} — Sección "${data.seccion}"` },
              {
                label: data.usarSoloIniciales
                  ? 'Estudiantes involucrados (Iniciales)'
                  : 'Estudiantes involucrados',
                value: data.estudiantesInvolucrados,
              },
              { label: 'Docente que reporta', value: data.docenteReporta },
              { label: 'Testigos', value: data.testigos },
            ],
          },
          {
            heading: 'II. Descripción Objetiva de los Hechos',
            paragraphs: [data.descripcionHechos],
          },
          {
            heading: 'III. Clasificación y Medidas Formativas',
            keyValues: [
              { label: 'Clasificación de la falta', value: data.clasificacionFalta },
              { label: 'Artículo del Reglamento Interno', value: data.articuloReglamento },
              { label: 'Medidas formativas aplicadas', value: data.medidasFormativas },
            ],
          },
          {
            heading: 'IV. Comunicación con Responsables y Acuerdos',
            keyValues: [
              { label: 'Fecha y medio de comunicación', value: `${data.comunicacionPadresFecha} (${data.comunicacionPadresMedio})` },
              { label: 'Detalle de comunicación', value: data.comunicacionPadresDetalle },
              { label: 'Acuerdos y compromisos', value: data.acuerdosCompromisos },
            ],
          },
          {
            heading: 'V. Derivación y Seguimiento',
            keyValues: [
              { label: 'Sospecha de vulneración / Derivación', value: data.requiereDerivacion ? `SÍ — ${data.instanciaDerivacion}` : 'No aplica' },
              { label: 'Detalle de derivación', value: data.detalleDerivacion },
              { label: 'Plan de seguimiento', value: data.seguimiento },
              { label: 'Nota legal', value: data.observacionesLegales },
            ],
          },
          {
            heading: 'VI. Firmas de Constancia',
            table: {
              headers: ['Docente que reporta', 'Padre / Madre / Responsable', 'Dirección'],
              rows: [
                ['\n\n_____________________________', '\n\n_____________________________', '\n\n_____________________________'],
                [data.docenteReporta, 'Nombre y DUI: [COMPLETAR]', config.directorName],
              ],
            },
          },
        ],
      },
      `Bitacora_${data.correlativo}_${data.grado}`
    );
  };

  return (
    <div className="space-y-5">
      {/* Legal Notice Banner */}
      <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 space-y-1">
          <p className="font-bold">
            Marco Legal Vigente: Ley Crecer Juntos (en vigencia desde el 1 de enero de 2023; derogó la LEPINA)
          </p>
          <p className="text-amber-900/90">
            Principios obligatorios: interés superior del niño, confidencialidad y redacción objetiva sin juicios de valor. La IA nunca citará la LEPINA ni inventará artículos.
          </p>
        </div>
      </div>

      {/* Knowledge Base Panel for Bitácora */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#003366]" />
            <span className="text-xs font-bold text-[#003366]">
              Base de conocimiento legal del módulo (Local en dispositivo)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kbCategory}
              onChange={(e) => setKbCategory(e.target.value as KnowledgeDoc['category'])}
              className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 text-slate-800"
            >
              <option value="ley_crecer_juntos">Ley Crecer Juntos</option>
              <option value="reglamento_interno">Reglamento Interno Institucional</option>
              <option value="manual_convivencia">Manual de Convivencia</option>
              <option value="otro">Otro documento normativo</option>
            </select>
            <input
              ref={kbFileRef}
              type="file"
              accept=".pdf,.docx,.txt,image/*"
              onChange={(e) => void handleUploadKnowledgeDoc(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              disabled={kbLoading}
              onClick={() => kbFileRef.current?.click()}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{kbLoading ? 'Procesando...' : 'Subir normativa'}</span>
            </button>
          </div>
        </div>

        {kbError && <p className="text-xs text-rose-700">{kbError}</p>}

        {knowledgeDocs.length === 0 ? (
          <p className="text-xs text-slate-500">
            Sube aquí el PDF, Word o TXT de la Ley Crecer Juntos, el Reglamento Interno y el Manual de Convivencia para que la IA cite artículos exactos sin marcar [VERIFICAR].
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {knowledgeDocs.map((kd) => (
              <div
                key={kd.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-800 border border-slate-200"
              >
                <span className="font-semibold">{kd.title}</span>
                <span className="text-slate-500">· {kd.category.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => void deleteKnowledgeDoc(kd.id).then(loadKb)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  aria-label="Eliminar documento normativo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Library Picker */}
      <ModuleTemplatePicker
        moduleId="bitacora"
        moduleLabel="Bitácora de Incidentes"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* AI Input Panel */}
      <div className="no-print">
        <ContentInputPanel
          label="Dicta, escribe o sube evidencias/notas del incidente"
          placeholder="Ej: Hoy a las 9:45 a.m. en el patio central durante el recreo de 7.º A, los estudiantes... (puedes dictar con voz o subir foto de apuntes; la IA redactará de forma objetiva y neutral)."
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel="Redactar bitácora objetiva con IA"
          errorMessage={aiError}
        />
      </div>

      {/* Mobile Tab Switcher: Edit vs Preview */}
      <div className="no-print flex lg:hidden p-1 bg-slate-200/80 rounded-xl">
        <button
          type="button"
          onClick={() => setViewMode('editar')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'editar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          1. Editar campos
        </button>
        <button
          type="button"
          onClick={() => setViewMode('vista_previa')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold transition cursor-pointer ${
            viewMode === 'vista_previa' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          2. Vista previa / Exportar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editable Form */}
        <div
          className={`no-print lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs ${
            viewMode === 'vista_previa' ? 'hidden lg:block' : 'block'
          }`}
        >
          <h3 className="text-sm font-bold text-[#003366] border-b border-slate-100 pb-2">
            Edición de campos de la Bitácora
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">N.º Correlativo</label>
              <input
                type="text"
                value={data.correlativo}
                onChange={(e) => updateField('correlativo', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={/^\d{4}-\d{2}-\d{2}$/.test(data.fecha) ? data.fecha : ''}
                onChange={(e) => updateField('fecha', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Hora</label>
              <input
                type="text"
                value={data.hora}
                onChange={(e) => updateField('hora', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar</label>
              <input
                type="text"
                value={data.lugar}
                onChange={(e) => updateField('lugar', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
              <select
                value={data.grado}
                onChange={(e) => updateField('grado', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {config.grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sección</label>
              <select
                value={data.seccion}
                onChange={(e) => updateField('seccion', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {config.sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#003366] cursor-pointer">
              <input
                type="checkbox"
                checked={data.usarSoloIniciales}
                onChange={(e) => handleToggleInitials(e.target.checked)}
                className="w-4 h-4 accent-[#003366]"
              />
              <UserCheck className="w-4 h-4" />
              <span>Confidencialidad: usar solo iniciales de estudiantes</span>
            </label>
            <input
              type="text"
              value={data.estudiantesInvolucrados}
              onChange={(e) => updateField('estudiantesInvolucrados', e.target.value)}
              placeholder="Ej: M. A. G. R., C. E. L. P."
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Docente que reporta</label>
              <input
                type="text"
                list="casm-teachers-list"
                value={data.docenteReporta}
                onChange={(e) => updateField('docenteReporta', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
              <datalist id="casm-teachers-list">
                {config.userProfile?.name?.trim() && (
                  <option value={config.userProfile.name.trim()} />
                )}
                {config.teachers.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Testigos</label>
              <input
                type="text"
                value={data.testigos}
                onChange={(e) => updateField('testigos', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Descripción objetiva de los hechos (sin juicios de valor)
            </label>
            <textarea
              rows={4}
              value={data.descripcionHechos}
              onChange={(e) => updateField('descripcionHechos', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Clasificación de la falta
              </label>
              <select
                value={data.clasificacionFalta}
                onChange={(e) =>
                  updateField('clasificacionFalta', e.target.value as IncidentLogData['clasificacionFalta'])
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="Leve">Leve</option>
                <option value="Grave">Grave</option>
                <option value="Muy Grave">Muy Grave</option>
                <option value="Por determinar [COMPLETAR]">Por determinar [COMPLETAR]</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Artículo del Reglamento Interno
              </label>
              <input
                type="text"
                value={data.articuloReglamento}
                onChange={(e) => updateField('articuloReglamento', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Medidas formativas aplicadas</label>
            <textarea
              rows={2}
              value={data.medidasFormativas}
              onChange={(e) => updateField('medidasFormativas', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Comunicación padres (Fecha)</label>
              <input
                type="text"
                value={data.comunicacionPadresFecha}
                onChange={(e) => updateField('comunicacionPadresFecha', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Medio utilizado</label>
              <input
                type="text"
                value={data.comunicacionPadresMedio}
                onChange={(e) => updateField('comunicacionPadresMedio', e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Detalle comunicación con responsables</label>
            <textarea
              rows={2}
              value={data.comunicacionPadresDetalle}
              onChange={(e) => updateField('comunicacionPadresDetalle', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Acuerdos y compromisos</label>
            <textarea
              rows={2}
              value={data.acuerdosCompromisos}
              onChange={(e) => updateField('acuerdosCompromisos', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-rose-900 cursor-pointer">
              <input
                type="checkbox"
                checked={data.requiereDerivacion}
                onChange={(e) => updateField('requiereDerivacion', e.target.checked)}
                className="w-4 h-4 accent-rose-600"
              />
              <span>Sospecha de vulneración de derechos — Requiere derivación</span>
            </label>
            {data.requiereDerivacion && (
              <div className="space-y-2 pt-1">
                <select
                  value={data.instanciaDerivacion}
                  onChange={(e) => updateField('instanciaDerivacion', e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-rose-200 bg-white text-xs"
                >
                  <option value="Dirección del Centro Educativo">Dirección del Centro Educativo</option>
                  <option value="Junta de Protección / CONAPINA">Junta de Protección / CONAPINA</option>
                  <option value="Policía Nacional Civil (PNC)">Policía Nacional Civil (PNC)</option>
                  <option value="Fiscalía General de la República (FGR)">Fiscalía General de la República (FGR)</option>
                  <option value="Dirección + CONAPINA / PNC / FGR">Dirección + CONAPINA / PNC / FGR</option>
                </select>
                <textarea
                  rows={2}
                  value={data.detalleDerivacion}
                  onChange={(e) => updateField('detalleDerivacion', e.target.value)}
                  placeholder="Describe la derivación activada..."
                  className="w-full p-2.5 rounded-lg border border-rose-200 bg-white text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Seguimiento</label>
            <textarea
              rows={2}
              value={data.seguimiento}
              onChange={(e) => updateField('seguimiento', e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          {/* Mandatory Verification Checklist before export */}
          <div className="p-4 rounded-2xl border-2 border-[#003366]/20 bg-[#003366]/5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#003366]">
              <CheckSquare className="w-4 h-4" />
              <span>Lista de verificación obligatoria antes de exportar</span>
            </div>
            {[
              {
                key: 'interesSuperior' as const,
                label: 'Prioriza el interés superior del niño, niña o adolescente.',
              },
              {
                key: 'confidencialidad' as const,
                label: 'Se resguarda la confidencialidad y dignidad de los estudiantes.',
              },
              {
                key: 'redaccionNeutral' as const,
                label: 'La descripción es estrictamente objetiva y neutral (sin juicios de valor).',
              },
              {
                key: 'sinLepina' as const,
                label: 'Se aplica la Ley Crecer Juntos (NO se cita LEPINA) y verifiqué los campos [COMPLETAR]/[VERIFICAR].',
              },
            ].map((item) => (
              <label key={item.key} className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist[item.key]}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 accent-[#003366] shrink-0"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Live Document Preview + Export Bar */}
        <div
          className={`lg:col-span-7 space-y-4 ${
            viewMode === 'editar' ? 'hidden lg:block' : 'block'
          }`}
        >
          <DocumentActionBar
            previewRef={previewRef}
            fileBaseName={`Bitacora_${data.correlativo}_${data.grado}`}
            whatsappMessage={`Bitácora de incidentes ${data.correlativo} (${data.grado} ${data.seccion}) — ${config.schoolName}. Documento confidencial.`}
            orientation="portrait"
            pageSize="letter"
            onDownloadWord={handleDownloadWord}
            onSaveHistory={handleSaveHistory}
            onDuplicate={() => {
              setDocId(`doc-bit-${Date.now()}`);
              updateField('correlativo', `BIT-${config.academicYear}-${String(Math.floor(Math.random() * 900 + 100))}`);
            }}
            disabled={!allChecked}
            disabledReason="Marca los 4 puntos de la lista de verificación obligatoria (confidencialidad, redacción neutral y Ley Crecer Juntos) para habilitar la exportación."
          />

          <div className="print-only-container overflow-x-auto pb-4">
            <div ref={previewRef} className="doc-paper doc-paper-letter-portrait print-page text-[11px] leading-relaxed">
              <SchoolDocHeader
                config={config}
                documentTitle="Bitácora de Incidentes Escolares"
                subtitle={`Correlativo: ${data.correlativo} · CONFIDENCIAL`}
              />

              <div className="text-[10px] bg-slate-100 border border-slate-300 px-3 py-1.5 mb-3 text-slate-700">
                <strong>Marco Normativo:</strong> Ley Crecer Juntos para la Protección Integral de la Primera Infancia, Niñez y Adolescencia (vigente desde el 1 de enero de 2023) y Reglamento Interno del Centro Educativo.
              </div>

              <table className="w-full border-collapse border border-slate-300 mb-3 text-[11px]">
                <tbody>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/4 text-[#003366]">Fecha y Hora:</td>
                    <td className="border border-slate-300 p-1.5 w-1/4">
                      <HighlightedText text={`${data.fecha} — ${data.hora}`} />
                    </td>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/4 text-[#003366]">Grado y Sección:</td>
                    <td className="border border-slate-300 p-1.5 w-1/4">
                      <HighlightedText text={`${data.grado} "${data.seccion}"`} />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 text-[#003366]">Lugar:</td>
                    <td className="border border-slate-300 p-1.5">
                      <HighlightedText text={data.lugar} />
                    </td>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 text-[#003366]">Docente que reporta:</td>
                    <td className="border border-slate-300 p-1.5">
                      <HighlightedText text={data.docenteReporta} />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 text-[#003366]">
                      Estudiantes {data.usarSoloIniciales ? '(Solo iniciales)' : 'involucrados'}:
                    </td>
                    <td className="border border-slate-300 p-1.5" colSpan={3}>
                      <HighlightedText text={data.estudiantesInvolucrados} />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 text-[#003366]">Testigos:</td>
                    <td className="border border-slate-300 p-1.5" colSpan={3}>
                      <HighlightedText text={data.testigos} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  1. Descripción Objetiva de los Hechos
                </div>
                <div className="border border-slate-300 p-2.5 min-h-[75px] whitespace-pre-wrap">
                  <HighlightedText text={data.descripcionHechos} />
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  2. Clasificación según Reglamento Interno y Medidas Formativas
                </div>
                <table className="w-full border-collapse border border-slate-300">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/3">Clasificación de la falta:</td>
                      <td className="border border-slate-300 p-1.5 font-semibold">
                        <HighlightedText text={data.clasificacionFalta} />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Artículo aplicable:</td>
                      <td className="border border-slate-300 p-1.5">
                        <HighlightedText text={data.articuloReglamento} />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Medidas formativas aplicadas:</td>
                      <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">
                        <HighlightedText text={data.medidasFormativas} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  3. Comunicación con Padres/Responsables y Acuerdos
                </div>
                <table className="w-full border-collapse border border-slate-300">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/3">Fecha y medio:</td>
                      <td className="border border-slate-300 p-1.5">
                        <HighlightedText text={`${data.comunicacionPadresFecha} · ${data.comunicacionPadresMedio}`} />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Detalle de comunicación:</td>
                      <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">
                        <HighlightedText text={data.comunicacionPadresDetalle} />
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Acuerdos y compromisos:</td>
                      <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">
                        <HighlightedText text={data.acuerdosCompromisos} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  4. Derivación (Vulneración de Derechos) y Seguimiento
                </div>
                <table className="w-full border-collapse border border-slate-300">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/3">Derivación activada:</td>
                      <td className="border border-slate-300 p-1.5">
                        {data.requiereDerivacion ? (
                          <strong className="text-rose-800">{data.instanciaDerivacion}</strong>
                        ) : (
                          'No aplica'
                        )}
                      </td>
                    </tr>
                    {data.requiereDerivacion && (
                      <tr>
                        <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Detalle de derivación:</td>
                        <td className="border border-slate-300 p-1.5">
                          <HighlightedText text={data.detalleDerivacion} />
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Plan de seguimiento:</td>
                      <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">
                        <HighlightedText text={data.seguimiento} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-8 text-center text-[10px] avoid-break">
                <div>
                  <div className="h-10 flex items-end justify-center">
                    {resolveTeacherSignature(config, data.docenteReporta) && (
                      <img
                        src={resolveTeacherSignature(config, data.docenteReporta)}
                        alt="Firma docente"
                        className="max-h-10 object-contain"
                      />
                    )}
                  </div>
                  <div className="border-t border-slate-700 pt-1 font-bold">{data.docenteReporta}</div>
                  <div className="text-slate-500">Docente que reporta</div>
                </div>
                <div>
                  <div className="h-10" />
                  <div className="border-t border-slate-700 pt-1 font-bold">Padre / Madre / Responsable</div>
                  <div className="text-slate-500">Firma y N.º de DUI</div>
                </div>
                <div>
                  <div className="h-10 flex items-end justify-center">
                    {config.directorSignature && (
                      <img src={config.directorSignature} alt="Firma Directora" className="max-h-10 object-contain" />
                    )}
                  </div>
                  <div className="border-t border-slate-700 pt-1 font-bold">{config.directorName}</div>
                  <div className="text-slate-500">Directora</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
