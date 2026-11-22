import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Award,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  Printer,
  RotateCw,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Users,
  Wand2,
} from 'lucide-react';
import type {
  ClassroomGrade,
  DiplomaBatchData,
  DiplomaFormatStyle,
  GraduateRecord,
  PageOrientation,
  PageSize,
  SavedDocument,
  SchoolConfig,
} from '../types/casm';
import { loadClassroomsRegistry, saveDocumentToHistory } from '../db/indexedDb';
import { fileToImageDataUrl, parseNamesFromSpreadsheet, parseUploadedFile } from '../utils/fileReader';
import { callGeminiAi, parseAiJsonResponse } from '../services/aiService';
import {
  buildDiplomaAiStylePrompt,
  buildDiplomaClonePrompt,
  buildDiplomaNameSpellingCheckPrompt,
  buildGraduateNamesExtractionPrompt,
} from '../prompts/modulePrompts';
import { spanishDateToWords } from '../utils/spanishDateToWords';
import { resolveTeacherSignature } from '../utils/userProfileDefaults';
import {
  downloadDiplomasDocx,
  downloadPdfFromElement,
  exportDiplomasBatchToZip,
  sharePdfOnWhatsApp,
  triggerPrintDocument,
} from '../utils/exportEngine';

interface DiplomaModuleProps {
  config: SchoolConfig;
  initialDocument?: SavedDocument<DiplomaBatchData> | null;
}

const GRADUATION_GRADES = [
  'Preparatoria',
  '6.º Grado',
  '9.º Grado',
  '2.º Año Bachillerato General',
  '3.º Año Bachillerato Técnico',
  'Kinder 4',
  'Kinder 5',
  'Educación Básica',
  'Reconocimiento General',
];

const STYLE_PRESETS: Array<{
  id: DiplomaFormatStyle;
  label: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: 'serif' | 'sans' | 'formal';
}> = [
  {
    id: 'clasico_institucional',
    label: 'Institucional Clásico',
    description: 'Marco azul marino y oro oficial, bordes dobles ornamentales.',
    primaryColor: '#003366',
    accentColor: '#C89B3C',
    fontFamily: 'serif',
  },
  {
    id: 'elegante_pergamino',
    label: 'Elegante Pergamino',
    description: 'Fondo cálido tipo marfil, detalles florales y tonos vino/dorado.',
    primaryColor: '#6B1D2F',
    accentColor: '#C59B27',
    fontFamily: 'formal',
  },
  {
    id: 'moderno_geometrico',
    label: 'Moderno Geométrico',
    description: 'Bordes finos contemporáneos, azul pizarra y acentos oro cobrizo.',
    primaryColor: '#0F172A',
    accentColor: '#D97706',
    fontFamily: 'sans',
  },
  {
    id: 'infantil_preescolar',
    label: 'Infantil / Parvularia',
    description: 'Colores alegres, marcos amigables y estrellas decorativas para Kinder.',
    primaryColor: '#0369A1',
    accentColor: '#F59E0B',
    fontFamily: 'sans',
  },
  {
    id: 'merito_academico',
    label: 'Excelencia y Mérito',
    description: 'Laureles dorados, banda de honor superior para alumnos destacados.',
    primaryColor: '#1E3A8A',
    accentColor: '#EAB308',
    fontFamily: 'serif',
  },
];

const COMMON_ACCENTS_DICTIONARY: Record<string, string> = {
  // Apellidos hispanos frecuentes
  perez: 'Pérez',
  gonzalez: 'González',
  gomez: 'Gómez',
  rodriguez: 'Rodríguez',
  hernandez: 'Hernández',
  martinez: 'Martínez',
  ramirez: 'Ramírez',
  sanchez: 'Sánchez',
  lopez: 'López',
  diaz: 'Díaz',
  fernandez: 'Fernández',
  alvarez: 'Álvarez',
  benitez: 'Benítez',
  velasquez: 'Velásquez',
  vasquez: 'Vásquez',
  nunez: 'Núñez',
  jimenez: 'Jiménez',
  gutierrez: 'Gutiérrez',
  juarez: 'Juárez',
  garcia: 'García',
  chavez: 'Chávez',
  castaneda: 'Castañeda',
  caceres: 'Cáceres',
  dominguez: 'Domínguez',
  menendez: 'Menéndez',
  mendez: 'Méndez',
  marquez: 'Márquez',
  ordonez: 'Ordóñez',
  quinones: 'Quiñones',
  solorzano: 'Solórzano',
  valdez: 'Valdés',
  moran: 'Morán',
  avila: 'Ávila',
  aguilar: 'Aguilar',
  aleman: 'Alemán',
  beltran: 'Beltrán',
  pena: 'Peña',
  cardenas: 'Cárdenas',
  // Nombres de pila comunes
  sofia: 'Sofía',
  maria: 'María',
  jose: 'José',
  angel: 'Ángel',
  rene: 'René',
  noe: 'Noé',
  raul: 'Raúl',
  matias: 'Matías',
  sebastian: 'Sebastián',
  belen: 'Belén',
  ines: 'Inés',
  lucia: 'Lucía',
  jesus: 'Jesús',
  andres: 'Andrés',
  agustin: 'Agustín',
  valentin: 'Valentín',
  adrian: 'Adrián',
  cesar: 'César',
  alvaro: 'Álvaro',
  ramon: 'Ramón',
  hector: 'Héctor',
  oscar: 'Óscar',
  edgar: 'Édgar',
  ruben: 'Rubén',
  victor: 'Víctor',
  joaquin: 'Joaquín',
  martin: 'Martín',
  felix: 'Félix',
  simon: 'Simón',
};

function resolveLevelForGrade(grade: string, config: SchoolConfig): string {
  const lower = grade.toLowerCase();
  if (lower.includes('9')) return config.diploma.levelMap.noveno || 'Educación Básica';
  if (lower.includes('bachillerato')) return config.diploma.levelMap.bachillerato || 'Educación Media';
  if (lower.includes('6')) return config.diploma.levelMap.sexto || 'Segundo Ciclo de Educación Básica';
  return config.diploma.levelMap.kinder || 'Educación Parvularia';
}

function createInitialBatch(config: SchoolConfig): DiplomaBatchData {
  const defaultGrade = '9.º Grado';
  const defaultDate = `${config.academicYear}-11-26`;
  return {
    grado: defaultGrade,
    nivelTexto: resolveLevelForGrade(defaultGrade, config),
    fechaEmision: defaultDate,
    fechaEnLetras: spanishDateToWords(defaultDate),
    directoraNombre: config.directorName,
    directoraCargo: 'Directora',
    maestraGuiaNombre:
      config.userProfile?.name?.trim() ||
      config.diploma.homeroomTeachers[defaultGrade] ||
      config.teachers[2]?.name ||
      'Prof. [COMPLETAR]',
    maestraGuiaCargo: `${config.userProfile?.gender === 'masculino' ? 'Maestro Guía' : 'Maestra Guía'} · ${defaultGrade}`,
    ministryHeader: config.diploma.ministryHeader,
    diplomaTitle: 'DIPLOMA',
    introPhrase: 'Por cuanto',
    bodyTextTemplate: config.diploma.templateText,
    verseOrMotto: config.verse || '«Instruye al niño en su camino, y aun cuando fuere viejo no se apartará de él.» — Proverbios 22:6',
    institutionSubtitle: config.schoolCity || 'San Miguel, El Salvador',
    pageSize: 'oficio',
    orientation: 'portrait',
    formatStyle: 'clasico_institucional',
    primaryColor: config.primaryColor || '#003366',
    accentColor: '#C89B3C',
    fontFamily: 'serif',
    showPhotoBox: true,
    showCenterSeal: true,
    graduates: [
      { id: 'grad-1', fullName: 'Sofía Alejandra Martínez Hernández' },
      { id: 'grad-2', fullName: 'Daniel Eduardo Vásquez Romero' },
    ],
    namesConfirmed: false,
  };
}

function getDiplomaSheetDimensions(pageSize: PageSize = 'oficio', orientation: PageOrientation = 'portrait') {
  let w = '8.5in';
  let h = '11in';
  let paperClass = 'doc-paper-letter-portrait';

  if (pageSize === 'oficio') {
    w = orientation === 'landscape' ? '13in' : '8.5in';
    h = orientation === 'landscape' ? '8.5in' : '13in';
    paperClass = orientation === 'landscape' ? 'doc-paper-oficio-landscape' : 'doc-paper-oficio-portrait';
  } else if (pageSize === 'legal') {
    w = orientation === 'landscape' ? '14in' : '8.5in';
    h = orientation === 'landscape' ? '8.5in' : '14in';
    paperClass = orientation === 'landscape' ? 'doc-paper-legal-landscape' : 'doc-paper-legal-portrait';
  } else if (pageSize === 'a4') {
    w = orientation === 'landscape' ? '297mm' : '210mm';
    h = orientation === 'landscape' ? '210mm' : '297mm';
    paperClass = orientation === 'landscape' ? 'doc-paper-a4-landscape' : 'doc-paper-a4-portrait';
  } else {
    w = orientation === 'landscape' ? '11in' : '8.5in';
    h = orientation === 'landscape' ? '8.5in' : '11in';
    paperClass = orientation === 'landscape' ? 'doc-paper-letter-landscape' : 'doc-paper-letter-portrait';
  }
  return { w, h, paperClass };
}

/**
 * Reorders a full name between "Firstnames Lastnames" and "Lastnames, Firstnames"
 */
function transformNameOrder(fullName: string, target: 'first_last' | 'last_first'): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  if (trimmed.includes(',')) {
    const [lastnames, firstnames] = trimmed.split(',').map((s) => s.trim());
    if (lastnames && firstnames) {
      return target === 'first_last' ? `${firstnames} ${lastnames}` : `${lastnames}, ${firstnames}`;
    }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return trimmed;

  if (target === 'last_first') {
    if (parts.length === 4) return `${parts[2]} ${parts[3]}, ${parts[0]} ${parts[1]}`;
    if (parts.length === 3) return `${parts[1]} ${parts[2]}, ${parts[0]}`;
    return `${parts[1]}, ${parts[0]}`;
  } else {
    // If coming as "Pérez Gómez Juan Carlos" without comma
    if (parts.length === 4) return `${parts[2]} ${parts[3]} ${parts[0]} ${parts[1]}`;
    if (parts.length === 3) return `${parts[2]} ${parts[0]} ${parts[1]}`;
    return `${parts[1]} ${parts[0]}`;
  }
}

/**
 * Normalizes title case or all-uppercase
 */
function transformCase(text: string, style: 'title' | 'upper'): string {
  if (style === 'upper') return text.toUpperCase();
  const lowerWords = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en']);
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Single High-Resolution Diploma Sheet Component (Landscape or Portrait, Letter or Oficio)
 */
const DiplomaSheet: React.FC<{
  config: SchoolConfig;
  batch: DiplomaBatchData;
  graduate: GraduateRecord;
}> = ({ config, batch, graduate }) => {
  const orientation = batch.orientation || 'portrait';
  const pageSize = batch.pageSize || 'oficio';
  const primaryColor = batch.primaryColor || config.primaryColor || '#003366';
  const accentColor = batch.accentColor || '#C89B3C';
  const formatStyle = batch.formatStyle || 'clasico_institucional';
  const isLandscape = orientation === 'landscape';

  const { w, h, paperClass } = getDiplomaSheetDimensions(pageSize, orientation);

  const renderedBody = batch.bodyTextTemplate
    .replace(/\[NIVEL\]/g, batch.nivelTexto)
    .replace(/\[FECHA EN LETRAS\]/g, batch.fechaEnLetras)
    .replace(/\[GRADO\]/g, batch.grado)
    .replace(/\[ALUMNO\]/g, graduate.fullName);

  const homeroomSig =
    batch.maestraGuiaFirma || resolveTeacherSignature(config, batch.maestraGuiaNombre);

  const leftLogo = batch.leftLogoUrl || config.casmLogo || '/assets/casm-logo.png';
  const rightLogo = batch.rightLogoUrl || config.nationalShield || '/assets/escudo-elsalvador.png';

  // Dynamic styling based on selected format
  const getStyleTheme = () => {
    switch (formatStyle) {
      case 'elegante_pergamino':
        return {
          containerBg: 'bg-[#FFFDF8]',
          outerBorder: `6px double ${accentColor}`,
          innerBorder: `inset 0 0 0 2px #fff, inset 0 0 0 4px ${primaryColor}`,
          titleFont: 'font-serif-diploma',
          accentDecor: 'border-[#C59B27]',
        };
      case 'moderno_geometrico':
        return {
          containerBg: 'bg-white',
          outerBorder: `4px solid ${primaryColor}`,
          innerBorder: `inset 0 0 0 2px #fff, inset 0 0 0 5px ${accentColor}`,
          titleFont: 'font-sans font-black',
          accentDecor: 'border-amber-600',
        };
      case 'infantil_preescolar':
        return {
          containerBg: 'bg-gradient-to-b from-sky-50/40 via-white to-amber-50/30',
          outerBorder: `5px solid #0284C7`,
          innerBorder: `inset 0 0 0 3px #fff, inset 0 0 0 6px #F59E0B`,
          titleFont: 'font-sans font-extrabold',
          accentDecor: 'border-sky-400',
        };
      case 'merito_academico':
        return {
          containerBg: 'bg-[#FDFBF7]',
          outerBorder: `6px solid #1E3A8A`,
          innerBorder: `inset 0 0 0 3px #fff, inset 0 0 0 7px #EAB308`,
          titleFont: 'font-serif-diploma',
          accentDecor: 'border-yellow-500',
        };
      case 'clasico_institucional':
      default:
        return {
          containerBg: 'bg-white',
          outerBorder: `6px solid ${primaryColor}`,
          innerBorder: `inset 0 0 0 3px #ffffff, inset 0 0 0 6px ${accentColor}`,
          titleFont: 'font-serif-diploma',
          accentDecor: 'border-[#C89B3C]',
        };
    }
  };

  const theme = getStyleTheme();

  return (
    <div
      className={`doc-paper ${paperClass} print-page relative flex flex-col justify-between select-none ${theme.containerBg}`}
      style={{
        width: w,
        height: h,
        padding: isLandscape ? '0.35in' : '0.38in',
      }}
    >
      {/* Outer Ornate Frame */}
      <div
        className="w-full h-full relative flex flex-col justify-between px-7 py-6"
        style={{
          border: theme.outerBorder,
          boxShadow: theme.innerBorder,
        }}
      >
        {/* Corner Golden Decorative Ornaments */}
        {[
          'top-2 left-2 border-t-4 border-l-4',
          'top-2 right-2 border-t-4 border-r-4',
          'bottom-2 left-2 border-b-4 border-l-4',
          'bottom-2 right-2 border-b-4 border-r-4',
        ].map((pos, idx) => (
          <div
            key={idx}
            className={`absolute w-9 h-9 ${pos}`}
            style={{ borderColor: accentColor }}
          />
        ))}

        {/* TOP HEADER ROW: Left Logo | Ministry & School Header | Right Logo */}
        <div className={`flex items-start justify-between gap-4 ${isLandscape ? 'pt-1' : 'pt-2'}`}>
          <div className="w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center shrink-0">
            {leftLogo && (
              <img
                src={leftLogo}
                alt="Logo Institución"
                className="w-18 h-18 sm:w-20 sm:h-20 object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          <div className="flex-1 text-center pt-0.5">
            {batch.ministryHeader &&
              batch.ministryHeader.split('\n').map((line, i) => (
                <div
                  key={i}
                  className={
                    i === 0
                      ? 'text-[12px] sm:text-[13px] font-extrabold tracking-wide uppercase'
                      : 'text-[10px] sm:text-[11px] font-bold tracking-wider uppercase mt-0.5'
                  }
                  style={{ color: primaryColor }}
                >
                  {line}
                </div>
              ))}
            <div
              className="w-36 h-0.5 mx-auto mt-2"
              style={{ backgroundColor: accentColor }}
            />
          </div>

          <div className="w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center shrink-0">
            {rightLogo && (
              <img
                src={rightLogo}
                alt="Escudo o Logo Derecho"
                className="w-18 h-18 sm:w-20 sm:h-20 object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>

        {/* SCHOOL TITLE + DIPLOMA TITLE */}
        <div className={`text-center space-y-1.5 ${isLandscape ? 'mt-1' : 'mt-3'}`}>
          <div
            className={`text-[26px] sm:text-[30px] font-extrabold tracking-wide uppercase leading-tight ${theme.titleFont}`}
            style={{ color: primaryColor }}
          >
            {config.schoolName}
          </div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-slate-600 font-semibold">
            {batch.institutionSubtitle || config.schoolCity}
          </div>

          <div className="pt-2">
            <span
              className={`inline-block text-[24px] sm:text-[28px] font-extrabold tracking-[0.18em] uppercase ${theme.titleFont}`}
              style={{ color: accentColor }}
            >
              {batch.diplomaTitle || 'DIPLOMA'}
            </span>
          </div>

          <div className="font-serif-diploma italic text-lg sm:text-xl text-slate-700">
            {batch.introPhrase || 'Por cuanto'}
          </div>
        </div>

        {/* MIDDLE SECTION: OPTIONAL PHOTO BOX + GRADUATE CALLIGRAPHIC NAME */}
        <div className={`flex items-center justify-center gap-5 px-2 ${isLandscape ? 'my-2' : 'my-3'}`}>
          {batch.showPhotoBox && (
            <div
              className="w-[1.3in] h-[1.65in] shrink-0 flex flex-col items-center justify-center overflow-hidden bg-slate-50/60"
              style={{
                border: `2px solid ${primaryColor}`,
                outline: `2px solid ${accentColor}`,
                outlineOffset: '2px',
              }}
            >
              {graduate.photoDataUrl ? (
                <img
                  src={graduate.photoDataUrl}
                  alt={`Fotografía de ${graduate.fullName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold text-center px-1">
                  Fotografía
                </span>
              )}
            </div>
          )}

          {/* Graduate Name */}
          <div className="flex-1 text-center px-2 max-w-2xl">
            <div
              className={`font-script-diploma text-[40px] sm:text-[46px] leading-[1.15] pb-1`}
              style={{ color: primaryColor }}
            >
              {graduate.fullName || '[COMPLETAR NOMBRE]'}
            </div>
            <div
              className="w-full h-[3px] rounded-full mx-auto"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor} 15%, #FFA92D 50%, ${accentColor} 85%, transparent)`,
              }}
            />
          </div>
        </div>

        {/* FORMAL DIPLOMA BODY TEXT */}
        <div className={`px-4 ${isLandscape ? 'my-2' : 'my-3'}`}>
          <p
            className={`text-[14px] sm:text-[15.5px] leading-[1.8] text-justify text-slate-800 indent-6 font-serif-diploma`}
          >
            {renderedBody}
          </p>
        </div>

        {/* OPTIONAL VERSE OR MOTTO */}
        {batch.verseOrMotto && (
          <div className="text-center px-6 my-1">
            <p className="text-[11px] sm:text-[12px] italic text-slate-600 font-serif-diploma">
              {batch.verseOrMotto}
            </p>
          </div>
        )}

        {/* BOTTOM SECTION: 2 SIGNATURES + CENTER SEAL */}
        <div className={`${isLandscape ? 'pt-2 pb-1' : 'pt-3 pb-2'}`}>
          <div className="grid grid-cols-3 items-end gap-3 text-center">
            {/* Left Signature: Directora */}
            <div className="px-2">
              <div className="h-12 flex items-end justify-center mb-1">
                {config.directorSignature && (
                  <img
                    src={config.directorSignature}
                    alt="Firma Directora"
                    className="max-h-12 object-contain"
                  />
                )}
              </div>
              <div className="border-t-2 pt-1" style={{ borderColor: primaryColor }}>
                <div className="text-xs font-bold leading-tight" style={{ color: primaryColor }}>
                  {batch.directoraNombre}
                </div>
                <div className="text-[10.5px] text-slate-600 font-serif-diploma italic mt-0.5">
                  {batch.directoraCargo || 'Directora'}
                </div>
              </div>
            </div>

            {/* Center Gold Seal / Medal */}
            <div className="flex flex-col items-center justify-center pb-1">
              {batch.showCenterSeal !== false ? (
                batch.centerSealUrl ? (
                  <img
                    src={batch.centerSealUrl}
                    alt="Sello del Diploma"
                    className="w-20 h-20 object-contain"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex flex-col items-center justify-center text-center shadow-inner"
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #FCE79C, #D4A138 65%, #9B6E18 100%)',
                      border: '4px double #7A5410',
                      color: '#3D2703',
                    }}
                  >
                    <Award className="w-6 h-6 mb-0.5" />
                    <span className="text-[7px] font-extrabold uppercase tracking-wider leading-tight text-center truncate max-w-full px-1">
                      {config.schoolName
                        ? config.schoolName
                            .split(' ')
                            .filter((w) => w.length > 2)
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 5)
                            .toUpperCase() || 'HONOR'
                        : 'HONOR'}
                    </span>
                    <span className="text-[7.5px] font-bold">{config.academicYear}</span>
                  </div>
                )
              ) : null}
            </div>

            {/* Right Signature: Maestra Guía */}
            <div className="px-2">
              <div className="h-12 flex items-end justify-center mb-1">
                {homeroomSig && (
                  <img
                    src={homeroomSig}
                    alt="Firma Maestra Guía"
                    className="max-h-12 object-contain"
                  />
                )}
              </div>
              <div className="border-t-2 pt-1" style={{ borderColor: primaryColor }}>
                <div className="text-xs font-bold leading-tight" style={{ color: primaryColor }}>
                  {batch.maestraGuiaNombre}
                </div>
                <div className="text-[10.5px] text-slate-600 font-serif-diploma italic mt-0.5">
                  {batch.maestraGuiaCargo || `Maestra Guía · ${batch.grado}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DiplomaModule: React.FC<DiplomaModuleProps> = ({ config, initialDocument }) => {
  const [docId] = useState(initialDocument?.id || `doc-dip-${Date.now()}`);
  const [batch, setBatch] = useState<DiplomaBatchData>(
    initialDocument?.data || createInitialBatch(config)
  );

  const [pastedNames, setPastedNames] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [extractingNames, setExtractingNames] = useState(false);
  const [cloningFormat, setCloningFormat] = useState(false);
  const [generatingAiStyle, setGeneratingAiStyle] = useState(false);
  const [aiStylePrompt, setAiStylePrompt] = useState('');
  const [showAiStyleModal, setShowAiStyleModal] = useState(false);

  // Spellcheck / Tilde verification state
  const [spellingChecking, setSpellingChecking] = useState(false);
  const [spellingSuggestions, setSpellingSuggestions] = useState<
    Array<{ original: string; corrected: string; hasChanges: boolean; reason?: string }>
  >([]);
  const [showSpellingModal, setShowSpellingModal] = useState(false);

  // Import from Mis Grados state
  const [showImportGradesModal, setShowImportGradesModal] = useState(false);
  const [registeredClassrooms, setRegisteredClassrooms] = useState<ClassroomGrade[]>([]);
  const [selectedGradeIdForImport, setSelectedGradeIdForImport] = useState<string>('');
  const [selectedStudentNamesForImport, setSelectedStudentNamesForImport] = useState<Set<string>>(new Set());

  const [batchError, setBatchError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | 'zip' | 'whatsapp' | null>(null);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const photoListInputRef = useRef<HTMLInputElement>(null);
  const cloneFileInputRef = useRef<HTMLInputElement>(null);
  const leftLogoInputRef = useRef<HTMLInputElement>(null);
  const rightLogoInputRef = useRef<HTMLInputElement>(null);
  const centerSealInputRef = useRef<HTMLInputElement>(null);
  const batchRenderRef = useRef<HTMLDivElement>(null);

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, batch.graduates.length - 1));
  const currentGraduate = batch.graduates[safeActiveIndex];

  /* ---------------- HANDLERS: METADATA & STYLES ---------------- */

  const handleGradeChange = (grade: string) => {
    setBatch((prev) => ({
      ...prev,
      grado: grade,
      nivelTexto: resolveLevelForGrade(grade, config),
      maestraGuiaNombre: config.diploma.homeroomTeachers[grade] || prev.maestraGuiaNombre,
      maestraGuiaCargo: `Maestra Guía · ${grade}`,
    }));
  };

  const handleDateChange = (isoDate: string) => {
    setBatch((prev) => ({
      ...prev,
      fechaEmision: isoDate,
      fechaEnLetras: spanishDateToWords(isoDate),
    }));
  };

  const applyStylePreset = (presetId: DiplomaFormatStyle) => {
    const preset = STYLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setBatch((prev) => ({
      ...prev,
      formatStyle: preset.id,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      fontFamily: preset.fontFamily,
    }));
  };

  /* ---------------- HANDLERS: CLONING DIPLOMA FORMAT FROM PHOTO/FILE ---------------- */

  const handleCloneFormatUpload = async (file: File | null) => {
    if (!file) return;
    setBatchError(null);
    setCloningFormat(true);
    setExportStatus('Analizando diploma modelo con IA para clonar formato y diseño...');
    try {
      const att = await parseUploadedFile(file);
      const { systemPrompt, userPrompt } = buildDiplomaClonePrompt();
      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments: [att],
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<DiplomaBatchData> & { notes?: string }>(raw);

      setBatch((prev) => ({
        ...prev,
        diplomaTitle: parsed.diplomaTitle || prev.diplomaTitle,
        introPhrase: parsed.introPhrase || prev.introPhrase,
        ministryHeader: parsed.ministryHeader || prev.ministryHeader,
        institutionSubtitle: parsed.institutionSubtitle || prev.institutionSubtitle,
        bodyTextTemplate: parsed.bodyTextTemplate || prev.bodyTextTemplate,
        verseOrMotto: parsed.verseOrMotto !== undefined ? parsed.verseOrMotto : prev.verseOrMotto,
        directoraCargo: parsed.directoraCargo || prev.directoraCargo,
        maestraGuiaCargo: parsed.maestraGuiaCargo || prev.maestraGuiaCargo,
        orientation: parsed.orientation || prev.orientation,
        pageSize: parsed.pageSize || prev.pageSize,
        formatStyle: parsed.formatStyle || prev.formatStyle,
        primaryColor: parsed.primaryColor || prev.primaryColor,
        accentColor: parsed.accentColor || prev.accentColor,
        fontFamily: parsed.fontFamily || prev.fontFamily,
      }));

      setExportStatus('¡Formato de diploma clonado exitosamente desde el archivo modelo!');
      setTimeout(() => setExportStatus(null), 4000);
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : 'Error al clonar el formato del diploma con IA.'
      );
    } finally {
      setCloningFormat(false);
      if (cloneFileInputRef.current) cloneFileInputRef.current.value = '';
    }
  };

  /* ---------------- HANDLERS: GENERATE DIPLOMA WITH IA PROMPT ---------------- */

  const handleGenerateAiStyle = async () => {
    if (!aiStylePrompt.trim()) return;
    setGeneratingAiStyle(true);
    setBatchError(null);
    try {
      const { systemPrompt, userPrompt } = buildDiplomaAiStylePrompt({
        topicOrGrade: batch.grado,
        userInstructions: aiStylePrompt,
        schoolName: config.schoolName,
      });

      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<Partial<DiplomaBatchData>>(raw);

      setBatch((prev) => ({
        ...prev,
        diplomaTitle: parsed.diplomaTitle || prev.diplomaTitle,
        introPhrase: parsed.introPhrase || prev.introPhrase,
        ministryHeader: parsed.ministryHeader || prev.ministryHeader,
        institutionSubtitle: parsed.institutionSubtitle || prev.institutionSubtitle,
        bodyTextTemplate: parsed.bodyTextTemplate || prev.bodyTextTemplate,
        verseOrMotto: parsed.verseOrMotto || prev.verseOrMotto,
        orientation: parsed.orientation || prev.orientation,
        pageSize: parsed.pageSize || prev.pageSize,
        formatStyle: parsed.formatStyle || prev.formatStyle,
        primaryColor: parsed.primaryColor || prev.primaryColor,
        accentColor: parsed.accentColor || prev.accentColor,
      }));

      setShowAiStyleModal(false);
      setAiStylePrompt('');
      setExportStatus('¡Nuevo estilo generado por IA aplicado con éxito!');
      setTimeout(() => setExportStatus(null), 4000);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Error al generar estilo con IA.');
    } finally {
      setGeneratingAiStyle(false);
    }
  };

  /* ---------------- HANDLERS: STUDENT LIST & REORDERING ---------------- */

  const addGraduatesList = (names: string[]) => {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setBatch((prev) => ({
      ...prev,
      namesConfirmed: false,
      graduates: [
        ...prev.graduates,
        ...cleaned.map((fullName, idx) => ({
          id: `grad-${Date.now()}-${idx}`,
          fullName,
        })),
      ],
    }));
  };

  const handleExcelUpload = async (file: File | null) => {
    if (!file) return;
    setBatchError(null);
    try {
      const names = await parseNamesFromSpreadsheet(file);
      if (names.length === 0) {
        throw new Error('No se detectaron nombres en la hoja de cálculo.');
      }
      setBatch((prev) => ({
        ...prev,
        namesConfirmed: false,
        graduates: names.map((fullName, idx) => ({
          id: `grad-xls-${Date.now()}-${idx}`,
          fullName,
        })),
      }));
      setActiveIndex(0);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Error al leer el archivo Excel.');
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  const handlePhotoOrPdfListUpload = async (file: File | null) => {
    if (!file) return;
    setBatchError(null);
    setExtractingNames(true);
    try {
      const att = await parseUploadedFile(file);
      const { systemPrompt, userPrompt } = buildGraduateNamesExtractionPrompt();
      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt,
        attachments: [att],
        expectJson: true,
      });
      const parsed = parseAiJsonResponse<{ names?: string[] }>(raw);
      if (!Array.isArray(parsed.names) || parsed.names.length === 0) {
        throw new Error('No se lograron extraer nombres de la foto/PDF. Intenta con una foto más nítida.');
      }
      setBatch((prev) => ({
        ...prev,
        namesConfirmed: false,
        graduates: parsed.names!.map((fullName, idx) => ({
          id: `grad-ai-${Date.now()}-${idx}`,
          fullName: fullName.trim(),
        })),
      }));
      setActiveIndex(0);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Error al extraer nombres con IA.');
    } finally {
      setExtractingNames(false);
      if (photoListInputRef.current) photoListInputRef.current.value = '';
    }
  };

  const handleImportPasted = () => {
    const lines = pastedNames
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+[.)-\s]+/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    addGraduatesList(lines);
    setPastedNames('');
  };

  const handleOpenImportGradesModal = async () => {
    try {
      const cls = await loadClassroomsRegistry();
      setRegisteredClassrooms(cls);
      if (cls.length > 0) {
        setSelectedGradeIdForImport(cls[0].id);
        setSelectedStudentNamesForImport(new Set(cls[0].students.map((s) => s.fullName)));
      }
      setShowImportGradesModal(true);
    } catch {
      alert('Error al cargar grados registrados.');
    }
  };

  const handleToggleSelectStudent = (fullName: string) => {
    setSelectedStudentNamesForImport((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  };

  const handleToggleSelectAllInGrade = () => {
    const cls = registeredClassrooms.find((c) => c.id === selectedGradeIdForImport);
    if (!cls) return;
    if (selectedStudentNamesForImport.size === cls.students.length) {
      setSelectedStudentNamesForImport(new Set());
    } else {
      setSelectedStudentNamesForImport(new Set(cls.students.map((s) => s.fullName)));
    }
  };

  const handleConfirmImportGrades = () => {
    const cls = registeredClassrooms.find((c) => c.id === selectedGradeIdForImport);
    if (!cls) return;
    const chosen = cls.students.filter((s) => selectedStudentNamesForImport.has(s.fullName));
    if (chosen.length === 0) {
      alert('Selecciona al menos un alumno para importar.');
      return;
    }
    const newGrads: GraduateRecord[] = chosen.map((st, i) => ({
      id: `grad-${Date.now()}-${i}`,
      fullName: st.fullName,
      photoDataUrl: st.photoDataUrl,
    }));
    setBatch((prev) => ({
      ...prev,
      grado: prev.grado || cls.gradeName,
      graduates: [...prev.graduates, ...newGrads],
    }));
    setShowImportGradesModal(false);
  };

  const handleReorderAll = (targetOrder: 'first_last' | 'last_first') => {
    setBatch((prev) => ({
      ...prev,
      namesConfirmed: false,
      graduates: prev.graduates.map((g) => ({
        ...g,
        fullName: transformNameOrder(g.fullName, targetOrder),
      })),
    }));
  };

  const handleCaseTransformAll = (style: 'title' | 'upper') => {
    setBatch((prev) => ({
      ...prev,
      namesConfirmed: false,
      graduates: prev.graduates.map((g) => ({
        ...g,
        fullName: transformCase(g.fullName, style),
      })),
    }));
  };

  const handleAlphabeticalSort = () => {
    setBatch((prev) => ({
      ...prev,
      graduates: [...prev.graduates].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' })
      ),
    }));
  };

  /* ---------------- HANDLERS: SPELLCHECK & TILDES VERIFICATION ---------------- */

  const runSpellAndTildeCheck = async () => {
    if (batch.graduates.length === 0) return;
    setSpellingChecking(true);
    setBatchError(null);

    // 1. Instant local dictionary pass
    const localCorrections = batch.graduates.map((g) => {
      const words = g.fullName.split(/\s+/);
      let changed = false;
      const correctedWords = words.map((w) => {
        const clean = w.replace(/[,.]/g, '').toLowerCase();
        if (COMMON_ACCENTS_DICTIONARY[clean]) {
          const replacement = COMMON_ACCENTS_DICTIONARY[clean];
          if (replacement.toLowerCase() === clean && replacement !== w) {
            changed = true;
            return w.endsWith(',') ? `${replacement},` : replacement;
          }
        }
        return w;
      });
      const corrected = correctedWords.join(' ');
      return {
        original: g.fullName,
        corrected,
        hasChanges: changed && corrected !== g.fullName,
        reason: changed ? 'Tilde ortográfica corregida según diccionario' : undefined,
      };
    });

    try {
      // 2. Deep Gemini verification for complete accuracy
      const namesList = batch.graduates.map((g) => g.fullName).join('\n');
      const { systemPrompt, userPrompt } = buildDiplomaNameSpellingCheckPrompt();
      const raw = await callGeminiAi({
        systemPrompt,
        userPrompt: userPrompt.replace('{NAMES_LIST}', namesList),
        expectJson: true,
      });

      const parsed = parseAiJsonResponse<{
        corrections?: Array<{ original: string; corrected: string; hasChanges: boolean; reason?: string }>;
      }>(raw);

      if (Array.isArray(parsed.corrections) && parsed.corrections.length > 0) {
        setSpellingSuggestions(parsed.corrections);
      } else {
        setSpellingSuggestions(localCorrections);
      }
    } catch {
      // Fallback to local dictionary if offline
      setSpellingSuggestions(localCorrections);
    } finally {
      setSpellingChecking(false);
      setShowSpellingModal(true);
    }
  };

  const applySpellingCorrections = () => {
    setBatch((prev) => {
      const map = new Map<string, string>();
      spellingSuggestions.forEach((s) => {
        if (s.hasChanges && s.corrected) {
          map.set(s.original.trim(), s.corrected.trim());
        }
      });
      return {
        ...prev,
        namesConfirmed: false,
        graduates: prev.graduates.map((g) => ({
          ...g,
          fullName: map.get(g.fullName.trim()) || g.fullName,
        })),
      };
    });
    setShowSpellingModal(false);
    setExportStatus('Correcciones de ortografía y tildes aplicadas a la lista.');
    setTimeout(() => setExportStatus(null), 3000);
  };

  /* ---------------- HANDLERS: LOGOS & STUDENT PHOTO ---------------- */

  const handleCustomLogoUpload = async (
    target: 'left' | 'right' | 'center',
    file: File | null
  ) => {
    if (!file) return;
    const dataUrl = await fileToImageDataUrl(file);
    setBatch((prev) => ({
      ...prev,
      leftLogoUrl: target === 'left' ? dataUrl : prev.leftLogoUrl,
      rightLogoUrl: target === 'right' ? dataUrl : prev.rightLogoUrl,
      centerSealUrl: target === 'center' ? dataUrl : prev.centerSealUrl,
    }));
  };

  const handleStudentPhotoUpload = async (gradId: string, file: File | null) => {
    if (!file) return;
    const dataUrl = await fileToImageDataUrl(file);
    setBatch((prev) => ({
      ...prev,
      graduates: prev.graduates.map((g) => (g.id === gradId ? { ...g, photoDataUrl: dataUrl } : g)),
    }));
  };

  /* ---------------- HANDLERS: EXPORTING & SAVING ---------------- */

  const handleSaveHistory = async () => {
    const now = new Date().toISOString();
    await saveDocumentToHistory<DiplomaBatchData>({
      id: docId,
      module: 'diplomas',
      title: `Diplomas de Graduación — ${batch.grado} (${batch.graduates.length} estudiantes)`,
      grade: batch.grado,
      section: 'Promoción',
      subject: 'Graduación',
      period: config.academicYear,
      date: batch.fechaEmision,
      orientation: batch.orientation || 'portrait',
      pageSize: batch.pageSize || 'oficio',
      data: batch,
      createdAt: initialDocument?.createdAt || now,
      updatedAt: now,
    });
    setExportStatus('Lote de diplomas guardado en el historial local.');
    setTimeout(() => setExportStatus(null), 3000);
  };

  const handleExportAllPdf = async () => {
    if (!batchRenderRef.current || !batch.namesConfirmed) return;
    setExporting('pdf');
    setExportStatus(`Generando PDF (${batch.graduates.length} diplomas en alta resolución)...`);
    try {
      await downloadPdfFromElement(
        batchRenderRef.current,
        `Diplomas_${batch.grado.replace(/\s+/g, '_')}_${config.academicYear}.pdf`,
        {
          orientation: batch.orientation || 'portrait',
          pageSize: batch.pageSize || 'oficio',
          scale: 2.8,
        }
      );
      setExportStatus('PDF multipágina descargado con éxito.');
    } catch {
      setExportStatus('Error al generar el PDF.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportWordDocx = async () => {
    if (!batch.namesConfirmed) return;
    setExporting('docx');
    setExportStatus(`Generando documento Word editable (.docx) con ${batch.graduates.length} diplomas...`);
    try {
      await downloadDiplomasDocx(
        config,
        batch,
        `Diplomas_Editables_${batch.grado.replace(/\s+/g, '_')}_${config.academicYear}.docx`
      );
      setExportStatus('Documento Word editable (.docx) descargado con éxito.');
    } catch {
      setExportStatus('Error al exportar documento Word.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportZip = async () => {
    if (!batchRenderRef.current || !batch.namesConfirmed) return;
    const nodes = Array.from(batchRenderRef.current.querySelectorAll<HTMLElement>('.print-page'));
    if (nodes.length === 0) return;

    setExporting('zip');
    try {
      await exportDiplomasBatchToZip(
        nodes,
        batch.graduates.map((g) => g.fullName),
        `Diplomas_Individuales_${batch.grado.replace(/\s+/g, '_')}_${config.academicYear}.zip`,
        (cur, tot) => setExportStatus(`Empaquetando diploma ${cur} de ${tot} en ZIP...`),
        {
          orientation: batch.orientation || 'portrait',
          pageSize: batch.pageSize || 'oficio',
        }
      );
      setExportStatus('Archivo ZIP con diplomas individuales descargado.');
    } catch {
      setExportStatus('Error al generar el archivo ZIP.');
    } finally {
      setExporting(null);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!batchRenderRef.current || !batch.namesConfirmed) return;
    setExporting('whatsapp');
    try {
      await sharePdfOnWhatsApp(
        batchRenderRef.current,
        `Diplomas_${batch.grado.replace(/\s+/g, '_')}_${config.academicYear}.pdf`,
        `Diplomas de Graduación (${batch.grado}) — ${config.schoolName} (${batch.graduates.length} graduandos).`,
        {
          orientation: batch.orientation || 'portrait',
          pageSize: batch.pageSize || 'oficio',
          scale: 2.6,
        }
      );
      setExportStatus('PDF listo para compartir por WhatsApp.');
    } finally {
      setExporting(null);
    }
  };

  const canExport = batch.namesConfirmed && batch.graduates.length > 0;
  const missingNamesCount = useMemo(
    () => batch.graduates.filter((g) => !g.fullName.trim()).length,
    [batch.graduates]
  );

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR DE FORMATO, TAMAÑO DE PAPEL Y ORIENTACIÓN */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#C89B3C]" />
              Formato, Tamaño y Orientación del Diploma
            </h3>
            <p className="text-xs text-slate-500">
              Personaliza el estilo visual, el tamaño de papel y la orientación (horizontal o vertical).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Input oculto para subir archivo o tomar foto de diploma para clonar */}
            <input
              ref={cloneFileInputRef}
              type="file"
              accept="image/*,.pdf,.docx"
              capture="environment"
              onChange={(e) => void handleCloneFormatUpload(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              disabled={cloningFormat}
              onClick={() => cloneFileInputRef.current?.click()}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {cloningFormat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <span>{cloningFormat ? 'Analizando...' : 'Copiar formato con IA (Foto o Archivo)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAiStyleModal(true)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Wand2 className="w-4 h-4 text-[#FFA92D]" />
              <span>Diseñar nuevo estilo con IA</span>
            </button>
          </div>
        </div>

        {/* SELECTORES DE TAMAÑO DE PAPEL Y ORIENTACIÓN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Tamaño de papel */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tamaño de Papel</label>
            <select
              value={batch.pageSize || 'oficio'}
              onChange={(e) => setBatch((p) => ({ ...p, pageSize: e.target.value as PageSize }))}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white font-medium cursor-pointer"
            >
              <option value="oficio">Oficio / Folio (8.5 × 13 pulgadas)</option>
              <option value="letter">Carta / Letter (8.5 × 11 pulgadas)</option>
              <option value="legal">Legal (8.5 × 14 pulgadas)</option>
              <option value="a4">A4 Internacional (210 × 297 mm)</option>
            </select>
          </div>

          {/* Orientación */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Orientación</label>
            <div className="grid grid-cols-2 gap-1.5 min-h-[42px] p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setBatch((p) => ({ ...p, orientation: 'portrait' }))}
                className={`text-xs font-semibold rounded-lg py-1.5 transition flex items-center justify-center gap-1 cursor-pointer ${
                  (batch.orientation || 'portrait') === 'portrait'
                    ? 'bg-white text-[#003366] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vertical
              </button>
              <button
                type="button"
                onClick={() => setBatch((p) => ({ ...p, orientation: 'landscape' }))}
                className={`text-xs font-semibold rounded-lg py-1.5 transition flex items-center justify-center gap-1 cursor-pointer ${
                  batch.orientation === 'landscape'
                    ? 'bg-white text-[#003366] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Horizontal
              </button>
            </div>
          </div>

          {/* Grado / Motivo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Grado que gradúa</label>
            <select
              value={batch.grado}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white font-medium cursor-pointer"
            >
              {GRADUATION_GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Fecha de Emisión */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Emisión</label>
            <input
              type="date"
              value={batch.fechaEmision}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-medium"
            />
          </div>
        </div>

        {/* PRESETS DE ESTILOS */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-semibold text-slate-700">Estilos prediseñados por IA</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {STYLE_PRESETS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => applyStylePreset(st.id)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  batch.formatStyle === st.id
                    ? 'border-[#003366] bg-sky-50/70 shadow-xs ring-1 ring-[#003366]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: st.primaryColor }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: st.accentColor }}
                  />
                  <span className="text-xs font-bold text-slate-800 truncate">{st.label}</span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">{st.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* SUBIDA DE LOGOS Y OPCIONES VISUALES */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-1">Logos del diploma:</span>

            {/* Logo Izquierdo */}
            <input
              ref={leftLogoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleCustomLogoUpload('left', e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => leftLogoInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#003366]" />
              <span>{batch.leftLogoUrl ? 'Cambiar Logo Izq.' : 'Subir Logo Izq.'}</span>
            </button>

            {/* Logo Derecho */}
            <input
              ref={rightLogoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleCustomLogoUpload('right', e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => rightLogoInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#003366]" />
              <span>{batch.rightLogoUrl ? 'Cambiar Escudo/Der.' : 'Subir Escudo/Der.'}</span>
            </button>

            {/* Sello / Medalla central */}
            <input
              ref={centerSealInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleCustomLogoUpload('center', e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => centerSealInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>{batch.centerSealUrl ? 'Cambiar Sello Central' : 'Sello Personalizado'}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={batch.showPhotoBox !== false}
                onChange={(e) => setBatch((p) => ({ ...p, showPhotoBox: e.target.checked }))}
                className="rounded border-slate-300 text-[#003366] cursor-pointer"
              />
              <span>Recuadro para foto</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={batch.showCenterSeal !== false}
                onChange={(e) => setBatch((p) => ({ ...p, showCenterSeal: e.target.checked }))}
                className="rounded border-slate-300 text-[#003366] cursor-pointer"
              />
              <span>Sello o medalla central</span>
            </label>
          </div>
        </div>

        {/* DETALLE EDITABLE DE TEXTOS DEL DIPLOMA */}
        <details className="text-xs pt-1">
          <summary className="cursor-pointer font-bold text-[#003366] hover:underline">
            Editar textos, encabezados, títulos y firmas del diploma
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Título del diploma</label>
              <input
                type="text"
                value={batch.diplomaTitle || 'DIPLOMA'}
                onChange={(e) => setBatch((p) => ({ ...p, diplomaTitle: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-[#003366]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Frase de introducción</label>
              <input
                type="text"
                value={batch.introPhrase || 'Por cuanto'}
                onChange={(e) => setBatch((p) => ({ ...p, introPhrase: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs italic"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Subtítulo / Ciudad</label>
              <input
                type="text"
                value={batch.institutionSubtitle || config.schoolCity}
                onChange={(e) => setBatch((p) => ({ ...p, institutionSubtitle: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Encabezado superior (Ministerio/Institución)</label>
              <textarea
                rows={2}
                value={batch.ministryHeader}
                onChange={(e) => setBatch((p) => ({ ...p, ministryHeader: e.target.value }))}
                className="w-full p-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha en letras</label>
              <input
                type="text"
                value={batch.fechaEnLetras}
                onChange={(e) => setBatch((p) => ({ ...p, fechaEnLetras: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cuerpo formal del diploma (Variables: [NIVEL], [FECHA EN LETRAS], [GRADO], [ALUMNO])
              </label>
              <textarea
                rows={3}
                value={batch.bodyTextTemplate}
                onChange={(e) => setBatch((p) => ({ ...p, bodyTextTemplate: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Versículo bíblico o lema</label>
              <input
                type="text"
                value={batch.verseOrMotto || ''}
                onChange={(e) => setBatch((p) => ({ ...p, verseOrMotto: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs italic"
              />
            </div>

            {/* Firmas */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre 1.ª Firma (Directora)</label>
              <input
                type="text"
                value={batch.directoraNombre}
                onChange={(e) => setBatch((p) => ({ ...p, directoraNombre: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo 1.ª Firma</label>
              <input
                type="text"
                value={batch.directoraCargo || 'Directora'}
                onChange={(e) => setBatch((p) => ({ ...p, directoraCargo: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre 2.ª Firma (Maestra Guía)</label>
              <input
                type="text"
                value={batch.maestraGuiaNombre}
                onChange={(e) => setBatch((p) => ({ ...p, maestraGuiaNombre: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo 2.ª Firma</label>
              <input
                type="text"
                value={batch.maestraGuiaCargo || `Maestra Guía · ${batch.grado}`}
                onChange={(e) => setBatch((p) => ({ ...p, maestraGuiaCargo: e.target.value }))}
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>
        </details>
      </div>

      {/* 2. GESTIÓN AVANZADA DE LISTA DE GRADUANDOS, ORDEN DE NOMBRES Y TILDES */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Lista de Alumnos Graduandos ({batch.graduates.length})
            </h3>
            <p className="text-xs text-slate-500">
              Sube la nómina desde Excel, CSV, Word o foto. Ajusta el orden (Nombres o Apellidos primero) y revisa tildes con IA.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void handleExcelUpload(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Subir Excel / CSV</span>
            </button>

            <input
              ref={photoListInputRef}
              type="file"
              accept="image/*,.pdf,.docx"
              capture="environment"
              onChange={(e) => void handlePhotoOrPdfListUpload(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              disabled={extractingNames}
              onClick={() => photoListInputRef.current?.click()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {extractingNames ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <span>{extractingNames ? 'Extrayendo...' : 'Foto o PDF de lista'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleOpenImportGradesModal()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-[#003366] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Importar lista de estudiantes desde el módulo Mis Grados"
            >
              <Users className="w-4 h-4 text-[#003366]" />
              <span>Importar de Mis Grados</span>
            </button>

            <button
              type="button"
              disabled={spellingChecking || batch.graduates.length === 0}
              onClick={() => void runSpellAndTildeCheck()}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {spellingChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span>Verificar tildes y ortografía (IA)</span>
            </button>
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS DE ORDEN Y CAPITALIZACIÓN DE NOMBRES */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5 text-[#003366]" /> Formato de Nombres:
            </span>

            <button
              type="button"
              onClick={() => handleReorderAll('first_last')}
              title="Convierte 'Pérez Gómez, Juan' en 'Juan Pérez Gómez'"
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Nombres Primero (Juan Pérez)
            </button>

            <button
              type="button"
              onClick={() => handleReorderAll('last_first')}
              title="Convierte 'Juan Pérez Gómez' en 'Pérez Gómez, Juan'"
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Apellidos Primero (Pérez, Juan)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCaseTransformAll('title')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Tipo Título
            </button>
            <button
              type="button"
              onClick={() => handleCaseTransformAll('upper')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              MAYÚSCULAS
            </button>
            <button
              type="button"
              onClick={handleAlphabeticalSort}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Ordenar A-Z
            </button>
          </div>
        </div>

        {/* Pegar nombres manualmente */}
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            rows={2}
            value={pastedNames}
            onChange={(e) => setPastedNames(e.target.value)}
            placeholder="O pega aquí nombres de alumnos (uno por línea)..."
            className="flex-1 p-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
          />
          <button
            type="button"
            onClick={handleImportPasted}
            disabled={!pastedNames.trim()}
            className="min-h-[42px] px-4 rounded-xl bg-[#003366] text-white text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0"
          >
            Agregar nombres
          </button>
        </div>

        {batchError && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {batchError}
          </div>
        )}

        {/* TABLA DE NOMBRES EDITABLE */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700">
              Tabla de Graduandos (Editable directamente fila por fila)
            </span>
            <button
              type="button"
              onClick={() => {
                setBatch((p) => ({
                  ...p,
                  namesConfirmed: false,
                  graduates: [...p.graduates, { id: `grad-${Date.now()}`, fullName: '' }],
                }));
              }}
              className="px-2.5 py-1 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir graduando
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {batch.graduates.map((g, idx) => (
              <div
                key={g.id}
                className={`flex items-center gap-2 p-2.5 ${
                  safeActiveIndex === idx ? 'bg-sky-50/70' : 'bg-white'
                }`}
              >
                <span className="w-7 text-center text-xs font-mono font-bold text-slate-400">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={g.fullName}
                  onFocus={() => setActiveIndex(idx)}
                  onChange={(e) =>
                    setBatch((p) => ({
                      ...p,
                      namesConfirmed: false,
                      graduates: p.graduates.map((item) =>
                        item.id === g.id ? { ...item, fullName: e.target.value } : item
                      ),
                    }))
                  }
                  placeholder="Nombre completo con tildes..."
                  className="flex-1 min-h-[38px] px-3 rounded-lg border border-slate-300 text-xs font-medium"
                />

                <label
                  title="Insertar foto del graduando"
                  className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-600 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ImagePlus className="w-4 h-4 text-[#003366]" />
                  <span className="hidden sm:inline">{g.photoDataUrl ? 'Cambiar foto' : 'Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleStudentPhotoUpload(g.id, e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setBatch((p) => ({
                      ...p,
                      namesConfirmed: false,
                      graduates: p.graduates.filter((item) => item.id !== g.id),
                    }))
                  }
                  aria-label="Eliminar graduando"
                  className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* CONFIRMACIÓN DE NOMBRES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
          <div className="text-xs text-amber-950">
            <strong>Revisión obligatoria:</strong> Verifica tildes y orden antes de exportar a PDF o Word.
            {missingNamesCount > 0 && (
              <span className="text-rose-700 font-bold"> Hay {missingNamesCount} nombre(s) vacío(s).</span>
            )}
          </div>
          <button
            type="button"
            disabled={batch.graduates.length === 0 || missingNamesCount > 0}
            onClick={() => setBatch((p) => ({ ...p, namesConfirmed: true }))}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shrink-0 ${
              batch.namesConfirmed
                ? 'bg-emerald-600 text-white'
                : 'bg-[#003366] hover:bg-[#00254a] text-white disabled:opacity-45'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {batch.namesConfirmed
                ? 'Nombres confirmados para exportar'
                : 'Confirmo que los nombres están correctos'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. BARRA DE ACCIONES DE EXPORTACIÓN (PDF, WORD DOCX, ZIP, IMPRIMIR) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Word Editable (.docx) */}
          <button
            type="button"
            disabled={!canExport || exporting !== null}
            onClick={() => void handleExportWordDocx()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {exporting === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>Descargar en Word Editable (.docx)</span>
          </button>

          {/* Botón PDF Todos */}
          <button
            type="button"
            disabled={!canExport || exporting !== null}
            onClick={() => void handleExportAllPdf()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#003366] hover:bg-[#00254a] disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Todos en un PDF ({batch.graduates.length})</span>
          </button>

          {/* Botón ZIP Individuales */}
          <button
            type="button"
            disabled={!canExport || exporting !== null}
            onClick={() => void handleExportZip()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FFA92D] hover:brightness-95 disabled:opacity-45 text-[#002244] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {exporting === 'zip' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            <span>Cada uno en ZIP</span>
          </button>

          {/* Botón Imprimir */}
          <button
            type="button"
            disabled={!canExport || exporting !== null}
            onClick={() => triggerPrintDocument(batch.orientation || 'portrait', batch.pageSize || 'oficio')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-45 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          {/* WhatsApp */}
          <button
            type="button"
            disabled={!canExport || exporting !== null}
            onClick={() => void handleShareWhatsApp()}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          {/* Guardar Lote */}
          <button
            type="button"
            onClick={() => void handleSaveHistory()}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#003366]/30 bg-[#003366]/5 text-[#003366] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar lote</span>
          </button>
        </div>

        {!canExport && (
          <p className="text-xs text-amber-800">
            Haz clic en <strong>"Confirmo que los nombres están correctos"</strong> para habilitar las descargas en PDF y Word.
          </p>
        )}

        {exportStatus && (
          <div className="text-xs font-semibold text-[#003366] bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
            {exportStatus}
          </div>
        )}
      </div>

      {/* 4. CARRUSEL DE VISTA PREVIA INDIVIDUAL */}
      {currentGraduate && (
        <div className="no-print flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-xs">
          <button
            type="button"
            disabled={safeActiveIndex <= 0}
            onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            className="min-h-[40px] px-3 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <div className="text-xs font-semibold text-slate-700 text-center">
            Vista previa {safeActiveIndex + 1} de {batch.graduates.length}:{' '}
            <strong className="text-[#003366]">{currentGraduate.fullName}</strong>{' '}
            <span className="text-slate-400 font-normal">
              ({batch.pageSize?.toUpperCase() || 'OFICIO'} · {batch.orientation === 'landscape' ? 'Horizontal' : 'Vertical'})
            </span>
          </div>
          <button
            type="button"
            disabled={safeActiveIndex >= batch.graduates.length - 1}
            onClick={() => setActiveIndex((i) => Math.min(batch.graduates.length - 1, i + 1))}
            className="min-h-[40px] px-3 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. VISTA PREVIA EN PANTALLA */}
      {currentGraduate && (
        <div className="no-print overflow-x-auto pb-6 flex justify-center">
          <DiplomaSheet config={config} batch={batch} graduate={currentGraduate} />
        </div>
      )}

      {/* 6. CONTENEDOR OCULTO DE IMPRESIÓN Y MULTI-PDF (TODOS LOS DIPLOMAS) */}
      <div
        ref={batchRenderRef}
        className="print-only-container fixed -left-[99999px] top-0 print:static print:left-0"
      >
        {batch.graduates.map((grad) => (
          <DiplomaSheet key={grad.id} config={config} batch={batch} graduate={grad} />
        ))}
      </div>

      {/* MODAL: DISEÑAR FORMATO CON IA */}
      {showAiStyleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[#FFA92D]" />
                Diseñar nuevo formato de diploma con IA
              </h4>
              <button
                type="button"
                onClick={() => setShowAiStyleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Describe cómo quieres el diploma (tema, motivo, nivel, colores o versículo) y Gemini creará la redacción y estilo visual:
            </p>
            <textarea
              rows={4}
              value={aiStylePrompt}
              onChange={(e) => setAiStylePrompt(e.target.value)}
              placeholder="Ej: Diploma solemne para graduación de Bachillerato Técnico con colores azul marino y dorado, versículo bíblico formal y orientación horizontal..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAiStyleModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={generatingAiStyle || !aiStylePrompt.trim()}
                onClick={() => void handleGenerateAiStyle()}
                className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {generatingAiStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                <span>Generar diseño</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERIFICACIÓN DE TILDES Y ORTOGRAFÍA */}
      {showSpellingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Revisión Ortográfica y Tildes (IA)
              </h4>
              <button
                type="button"
                onClick={() => setShowSpellingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Se revisaron los nombres con las reglas de ortografía y antroponimia en español. Revisa las sugerencias antes de aplicarlas:
            </p>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {spellingSuggestions.map((item, i) => (
                <div key={i} className="p-2.5 text-xs flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[11px]">{i + 1}.</span>
                      <span className={item.hasChanges ? 'text-slate-500 line-through' : 'font-medium text-slate-700'}>
                        {item.original}
                      </span>
                      {item.hasChanges && (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ➔ {item.corrected}
                        </span>
                      )}
                    </div>
                    {item.reason && (
                      <span className="text-[10px] text-slate-400 block ml-5 mt-0.5">{item.reason}</span>
                    )}
                  </div>
                  <div>
                    {item.hasChanges ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        Tilde corregida
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Correcto</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-medium">
                {spellingSuggestions.filter((s) => s.hasChanges).length} correcciones detectadas
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSpellingModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={applySpellingCorrections}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Aplicar correcciones a la lista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR ALUMNOS DESDE MIS GRADOS */}
      {showImportGradesModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="text-sm font-extrabold text-[#003366] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FFA92D]" />
                Importar Alumnos desde "Mis Grados"
              </h4>
              <button
                type="button"
                onClick={() => setShowImportGradesModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {registeredClassrooms.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm font-bold text-slate-700">No hay grados configurados</p>
                <p className="text-xs text-slate-500 mt-1">
                  Ingresa primero al módulo <strong>"Mis Grados"</strong> para registrar los grados y alumnos que atiendes.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Selecciona el Grado:
                  </label>
                  <select
                    value={selectedGradeIdForImport}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedGradeIdForImport(newId);
                      const cls = registeredClassrooms.find((c) => c.id === newId);
                      if (cls) {
                        setSelectedStudentNamesForImport(new Set(cls.students.map((s) => s.fullName)));
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  >
                    {registeredClassrooms.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.gradeName} - Sección "{cls.section}" ({cls.students.length} alumnos)
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const currentClass = registeredClassrooms.find(
                    (c) => c.id === selectedGradeIdForImport
                  );
                  if (!currentClass || currentClass.students.length === 0) {
                    return (
                      <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                        Este grado no tiene alumnos registrados aún.
                      </div>
                    );
                  }

                  const allSelected =
                    selectedStudentNamesForImport.size === currentClass.students.length;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="flex items-center gap-2 text-xs font-bold text-[#003366] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleToggleSelectAllInGrade}
                            className="rounded border-slate-300 text-[#003366] focus:ring-0 cursor-pointer"
                          />
                          <span>
                            {allSelected ? 'Desmarcar todos' : 'Seleccionar todos los alumnos'}
                          </span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {selectedStudentNamesForImport.size} de {currentClass.students.length} seleccionados
                        </span>
                      </div>

                      <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1">
                        {currentClass.students.map((st) => {
                          const isChecked = selectedStudentNamesForImport.has(st.fullName);
                          return (
                            <label
                              key={st.id}
                              className={`flex items-center gap-3 p-2 rounded-lg text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                                isChecked ? 'bg-sky-50/50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectStudent(st.fullName)}
                                className="rounded border-slate-300 text-[#003366] focus:ring-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-slate-800 block truncate">
                                  {st.fullName}
                                </span>
                                {st.guardianName && (
                                  <span className="text-[10px] text-slate-400 block">
                                    Encargado: {st.guardianName}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowImportGradesModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImportGrades}
                    disabled={selectedStudentNamesForImport.size === 0}
                    className="px-4 py-2 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold cursor-pointer disabled:opacity-40"
                  >
                    Importar {selectedStudentNamesForImport.size} Alumnos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
