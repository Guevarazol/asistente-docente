import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ExtractedTemplate,
  MinutesData,
  MinutesType,
  SavedDocument,
  SchoolConfig,
  UploadedAttachment,
} from '../types/casm';
import { saveDocumentToHistory } from '../db/indexedDb';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import { buildMinutesPrompt } from '../prompts/modulePrompts';
import { formatReadableDateEs, formatTodayIso } from '../utils/spanishDateToWords';
import { downloadStructuredDocx } from '../utils/exportEngine';
import { ContentInputPanel } from '../components/ContentInputPanel';
import { DocumentActionBar } from '../components/DocumentActionBar';
import { ModuleTemplatePicker } from '../components/ModuleTemplatePicker';
import { HighlightedText, SchoolDocHeader } from '../components/HighlightedText';
import {
  getDefaultTeacherName,
  getDefaultTeacherRole,
  resolveTeacherSignature,
} from '../utils/userProfileDefaults';

interface MinutesModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<MinutesData> | null;
}

const MINUTES_TYPES: MinutesType[] = [
  'Reunión de Padres de Familia',
  'Compromiso Conductual',
  'Compromiso Académico',
  'Reunión de Docentes / Consejo',
  'Entrega de Notas',
  'Acuerdos con Estudiantes',
  'Otra',
];

function createEmptyMinutes(config: SchoolConfig): MinutesData {
  return {
    tipoActa: 'Reunión de Padres de Familia',
    tipoPersonalizado: '',
    numeroActa: `Acta N.º 001-${config.academicYear}`,
    lugar: `${config.schoolName}, ${config.schoolCity}`,
    fecha: formatTodayIso(),
    horaInicio: '08:00',
    horaCierre: '09:00',
    grado: config.grades[6] || '4.º Grado',
    seccion: config.sections[0] || 'A',
    asistentes: '[COMPLETAR]',
    agenda: ['Oración inicial y bienvenida', '[COMPLETAR]'],
    desarrollo: '[COMPLETAR]',
    acuerdos: [
      {
        numero: 1,
        descripcion: '[COMPLETAR]',
        responsable: '[COMPLETAR]',
        plazo: '[COMPLETAR]',
      },
    ],
    firmantes: [
      { nombre: config.directorName, cargo: 'Directora' },
      {
        nombre: getDefaultTeacherName(config, 1),
        cargo: getDefaultTeacherRole(config, 'Docente Guía'),
      },
      { nombre: '[COMPLETAR]', cargo: 'Padre / Madre / Representante' },
    ],
  };
}

export const MinutesModule: React.FC<MinutesModuleProps> = ({ config, initialDocument }) => {
  const [docId, setDocId] = useState(initialDocument?.id || `doc-acta-${Date.now()}`);
  const [data, setData] = useState<MinutesData>(
    initialDocument?.data || createEmptyMinutes(config)
  );
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractedTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editar' | 'vista_previa'>('editar');

  const previewRef = useRef<HTMLDivElement>(null);

  const effectiveTitle =
    data.tipoActa === 'Otra' && data.tipoPersonalizado.trim()
      ? data.tipoPersonalizado.trim()
      : data.tipoActa;

  const handleGenerate = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const { systemPrompt, userPrompt } = buildMinutesPrompt({
        config,
        userNotes: notes || 'Utiliza el contenido de los archivos o fotografías adjuntas.',
        minutesType: data.tipoActa,
        customType: data.tipoPersonalizado,
        grade: data.grado,
        section: data.seccion,
        template: selectedTemplate,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<MinutesData>>(raw);
      setData((prev) => ({
        ...prev,
        ...parsed,
        agenda: Array.isArray(parsed.agenda) && parsed.agenda.length > 0 ? parsed.agenda : prev.agenda,
        acuerdos:
          Array.isArray(parsed.acuerdos) && parsed.acuerdos.length > 0 ? parsed.acuerdos : prev.acuerdos,
        firmantes:
          Array.isArray(parsed.firmantes) && parsed.firmantes.length > 0 ? parsed.firmantes : prev.firmantes,
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al redactar el acta.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<MinutesData>({
      id: docId,
      module: 'actas',
      title: `${data.numeroActa} — ${effectiveTitle} (${data.grado})`,
      grade: data.grado,
      section: data.seccion,
      subject: effectiveTitle,
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
        schoolSubtitle: `${config.schoolCity} · Tel. ${config.schoolPhone}`,
        title: `${data.numeroActa.toUpperCase()} — ${effectiveTitle.toUpperCase()}`,
        subtitle: `${data.grado} "${data.seccion}" · ${formatReadableDateEs(data.fecha)}`,
        orientation: 'portrait',
        pageSize: 'letter',
        primaryHex: config.primaryColor,
        accentHex: config.accentColor,
        sections: [
          {
            heading: 'Datos Generales',
            keyValues: [
              { label: 'Número de Acta', value: data.numeroActa },
              { label: 'Lugar', value: data.lugar },
              { label: 'Fecha', value: formatReadableDateEs(data.fecha) },
              { label: 'Hora de inicio y cierre', value: `${data.horaInicio} a ${data.horaCierre}` },
              { label: 'Grado y Sección', value: `${data.grado} "${data.seccion}"` },
              { label: 'Asistentes', value: data.asistentes },
            ],
          },
          {
            heading: 'Agenda',
            paragraphs: data.agenda.map((a, idx) => `${idx + 1}. ${a}`),
          },
          {
            heading: 'Desarrollo',
            paragraphs: [data.desarrollo],
          },
          {
            heading: 'Acuerdos y Compromisos',
            table: {
              headers: ['N.º', 'Acuerdo', 'Responsable', 'Plazo'],
              rows: data.acuerdos.map((ac) => [
                String(ac.numero),
                ac.descripcion,
                ac.responsable,
                ac.plazo,
              ]),
            },
          },
          {
            heading: 'Firmas',
            table: {
              headers: data.firmantes.map((f) => f.cargo),
              rows: [
                data.firmantes.map(() => '\n\n_______________________'),
                data.firmantes.map((f) => f.nombre),
              ],
            },
          },
        ],
      },
      `Acta_${data.numeroActa}_${effectiveTitle}`
    );
  };

  return (
    <div className="space-y-5">
      <ModuleTemplatePicker
        moduleId="actas"
        moduleLabel="Actas"
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* Minutes Type Selector */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="text-xs font-bold text-[#003366]">Tipo de Acta</div>
        <div className="flex flex-wrap gap-2">
          {MINUTES_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setData((p) => ({ ...p, tipoActa: type }))}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                data.tipoActa === type
                  ? 'bg-[#003366] text-white border-[#003366]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        {data.tipoActa === 'Otra' && (
          <input
            type="text"
            value={data.tipoPersonalizado}
            onChange={(e) => setData((p) => ({ ...p, tipoPersonalizado: e.target.value }))}
            placeholder="Especifica el título o tipo de acta..."
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
          />
        )}
      </div>

      <div className="no-print">
        <ContentInputPanel
          label="Dicta o escribe los puntos tratados, asistentes y acuerdos"
          placeholder="Ej: Reunión de padres de 6.º A para entrega de notas del Periodo I. Asistieron 24 padres. Se acordó reforzar lectura 20 min diarios en casa..."
          value={notes}
          onChange={setNotes}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onGenerate={() => void handleGenerate()}
          generating={generating}
          generateButtonLabel="Redactar Acta Formal con IA"
          errorMessage={aiError}
        />
      </div>

      <div className="no-print flex lg:hidden p-1 bg-slate-200/80 rounded-xl">
        <button
          type="button"
          onClick={() => setViewMode('editar')}
          className={`flex-1 min-h-[44px] rounded-lg text-xs font-bold cursor-pointer ${
            viewMode === 'editar' ? 'bg-white text-[#003366] shadow-xs' : 'text-slate-600'
          }`}
        >
          Editar acta
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          className={`no-print lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs ${
            viewMode === 'vista_previa' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">N.º de Acta</label>
              <input
                type="text"
                value={data.numeroActa}
                onChange={(e) => setData((p) => ({ ...p, numeroActa: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
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
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Hora inicio</label>
              <input
                type="text"
                value={data.horaInicio}
                onChange={(e) => setData((p) => ({ ...p, horaInicio: e.target.value }))}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Hora cierre</label>
              <input
                type="text"
                value={data.horaCierre}
                onChange={(e) => setData((p) => ({ ...p, horaCierre: e.target.value }))}
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
                <option value="General / Institucional">General / Institucional</option>
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
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
              >
                {config.sections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Lugar</label>
            <input
              type="text"
              value={data.lugar}
              onChange={(e) => setData((p) => ({ ...p, lugar: e.target.value }))}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Asistentes</label>
            <textarea
              rows={2}
              value={data.asistentes}
              onChange={(e) => setData((p) => ({ ...p, asistentes: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Agenda (un punto por línea)</label>
            <textarea
              rows={3}
              value={data.agenda.join('\n')}
              onChange={(e) => setData((p) => ({ ...p, agenda: e.target.value.split('\n') }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Desarrollo</label>
            <textarea
              rows={4}
              value={data.desarrollo}
              onChange={(e) => setData((p) => ({ ...p, desarrollo: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#003366]">Acuerdos numerados</label>
              <button
                type="button"
                onClick={() =>
                  setData((p) => ({
                    ...p,
                    acuerdos: [
                      ...p.acuerdos,
                      {
                        numero: p.acuerdos.length + 1,
                        descripcion: '[COMPLETAR]',
                        responsable: '[COMPLETAR]',
                        plazo: '[COMPLETAR]',
                      },
                    ],
                  }))
                }
                className="px-2.5 py-1 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Acuerdo
              </button>
            </div>
            {data.acuerdos.map((ac, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Acuerdo #{ac.numero}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        acuerdos: p.acuerdos
                          .filter((_, i) => i !== idx)
                          .map((item, i) => ({ ...item, numero: i + 1 })),
                      }))
                    }
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={ac.descripcion}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      acuerdos: p.acuerdos.map((a, i) =>
                        i === idx ? { ...a, descripcion: e.target.value } : a
                      ),
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ac.responsable}
                    onChange={(e) =>
                      setData((p) => ({
                        ...p,
                        acuerdos: p.acuerdos.map((a, i) =>
                          i === idx ? { ...a, responsable: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder="Responsable"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={ac.plazo}
                    onChange={(e) =>
                      setData((p) => ({
                        ...p,
                        acuerdos: p.acuerdos.map((a, i) =>
                          i === idx ? { ...a, plazo: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder="Plazo"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`lg:col-span-7 space-y-4 ${
            viewMode === 'editar' ? 'hidden lg:block' : 'block'
          }`}
        >
          <DocumentActionBar
            previewRef={previewRef}
            fileBaseName={`Acta_${data.numeroActa}_${effectiveTitle}`}
            whatsappMessage={`${data.numeroActa} (${effectiveTitle}) — ${data.grado} "${data.seccion}" · ${config.schoolName}`}
            orientation="portrait"
            pageSize="letter"
            onDownloadWord={handleDownloadWord}
            onSaveHistory={handleSaveHistory}
            onDuplicate={() => setDocId(`doc-acta-${Date.now()}`)}
          />

          <div className="print-only-container overflow-x-auto pb-4">
            <div ref={previewRef} className="doc-paper doc-paper-letter-portrait print-page text-[11px] leading-relaxed">
              <SchoolDocHeader
                config={config}
                documentTitle={effectiveTitle}
                subtitle={data.numeroActa}
              />

              <table className="w-full border-collapse border border-slate-300 mb-3">
                <tbody>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/4">Lugar:</td>
                    <td className="border border-slate-300 p-1.5" colSpan={3}><HighlightedText text={data.lugar} /></td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Fecha:</td>
                    <td className="border border-slate-300 p-1.5">{formatReadableDateEs(data.fecha)}</td>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5 w-1/4">Horario:</td>
                    <td className="border border-slate-300 p-1.5">
                      <HighlightedText text={`${data.horaInicio} a ${data.horaCierre}`} />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Grado / Sección:</td>
                    <td className="border border-slate-300 p-1.5" colSpan={3}>{data.grado} "{data.seccion}"</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 bg-slate-50 font-bold p-1.5">Asistentes:</td>
                    <td className="border border-slate-300 p-1.5 whitespace-pre-wrap" colSpan={3}>
                      <HighlightedText text={data.asistentes} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  Agenda
                </div>
                <ol className="list-decimal list-inside space-y-1 border border-slate-300 p-2.5">
                  {data.agenda.filter(Boolean).map((item, idx) => (
                    <li key={idx}><HighlightedText text={item} /></li>
                  ))}
                </ol>
              </div>

              <div className="mb-3">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  Desarrollo
                </div>
                <div className="border border-slate-300 p-2.5 whitespace-pre-wrap min-h-[90px]">
                  <HighlightedText text={data.desarrollo} />
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-white px-2.5 py-1 mb-1.5" style={{ backgroundColor: config.primaryColor }}>
                  Acuerdos, Responsables y Plazos
                </div>
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[#003366]">
                      <th className="border border-slate-300 p-1.5 w-10 text-center">N.º</th>
                      <th className="border border-slate-300 p-1.5 text-left">Acuerdo / Compromiso</th>
                      <th className="border border-slate-300 p-1.5 text-left w-32">Responsable</th>
                      <th className="border border-slate-300 p-1.5 text-left w-28">Plazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.acuerdos.map((ac) => (
                      <tr key={ac.numero}>
                        <td className="border border-slate-300 p-1.5 text-center font-bold">{ac.numero}</td>
                        <td className="border border-slate-300 p-1.5"><HighlightedText text={ac.descripcion} /></td>
                        <td className="border border-slate-300 p-1.5"><HighlightedText text={ac.responsable} /></td>
                        <td className="border border-slate-300 p-1.5"><HighlightedText text={ac.plazo} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-slate-600 italic mb-6">
                Y no habiendo más que hacer constar, se cierra la presente acta a las {data.horaCierre} horas del día {formatReadableDateEs(data.fecha)}, firmando de conformidad los asistentes.
              </p>

              <div className="grid grid-cols-3 gap-6 pt-6 text-center text-[10px] avoid-break">
                {data.firmantes.map((f, idx) => {
                  const matchedSig = resolveTeacherSignature(config, f.nombre);
                  return (
                    <div key={idx}>
                      <div className="h-10 flex items-end justify-center">
                        {matchedSig && <img src={matchedSig} alt="Firma" className="max-h-10 object-contain" />}
                      </div>
                      <div className="border-t border-slate-700 pt-1 font-bold">
                        <HighlightedText text={f.nombre} />
                      </div>
                      <div className="text-slate-500">{f.cargo}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
