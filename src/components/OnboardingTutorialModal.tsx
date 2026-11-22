import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileCheck2,
  Grid2X2,
  Layers,
  Mic,
  Share2,
  X,
} from 'lucide-react';

interface OnboardingTutorialModalProps {
  open: boolean;
  onComplete: () => void;
}

interface TutorialStep {
  stepNumber: number;
  kicker: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  highlights: Array<{
    title: string;
    detail: string;
  }>;
  tip: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    stepNumber: 1,
    kicker: 'Paso 1 de 3 · Sistema de módulos',
    title: 'Ocho módulos diseñados para tu labor docente',
    description:
      'Desde la pantalla principal accedes con un toque a las 8 áreas del Colegio Adventista San Miguel: desde Kinder 4 hasta Bachillerato.',
    icon: Grid2X2,
    highlights: [
      {
        title: 'Planificación, Guías, Temarios y Exámenes conectados',
        detail:
          'Puedes importar tu Planificación o Jornalización guardada para generar Temarios y Exámenes coherentes entre sí, con clave de respuestas en hoja aparte.',
      },
      {
        title: 'Bitácora, Actas y Diplomas oficiales',
        detail:
          'Bitácora alineada a la Ley Crecer Juntos (con iniciales confidenciales), 7 tipos de actas y Diplomas en tamaño Oficio (8.5 × 13") en lote PDF o ZIP.',
      },
      {
        title: 'Privacidad local en tu dispositivo',
        detail:
          'Tu historial, plantillas y datos de estudiantes se guardan únicamente en este dispositivo (IndexedDB), protegidos con tu PIN.',
      },
    ],
    tip: 'Usa la barra inferior (en celular) o la superior (en computadora) para ir a Módulos, Historial, Plantillas y Configuración.',
  },
  {
    stepNumber: 2,
    kicker: 'Paso 2 de 3 · Cámara para documentos',
    title: 'Captura fotos de cuadernos, libros o listas con la cámara',
    description:
      'Dentro de cualquier módulo pulsa el botón "Tomar foto" para abrir la cámara trasera de tu celular y escanear material al instante.',
    icon: Camera,
    highlights: [
      {
        title: 'Varias fotos por documento',
        detail:
          'Toma tantas fotografías como necesites (páginas de libro, apuntes escritos a mano, listas de graduandos o formatos modelo). La IA las analiza todas juntas.',
      },
      {
        title: 'Consejos para una lectura precisa',
        detail:
          'Coloca la hoja sobre una superficie plana con buena luz natural, evita sombras fuertes y mantén el texto enfocado antes de capturar.',
      },
      {
        title: 'Combina cámara, archivos y voz',
        detail:
          'También puedes subir PDF, Word (.docx), Excel (.xlsx), CSV o usar el botón "Dictar" para redactar con tu voz.',
      },
    ],
    tip: 'En Diplomas de Graduación puedes tomar foto de la nómina impresa y revisar cada tilde en la tabla antes de generar los PDF.',
  },
  {
    stepNumber: 3,
    kicker: 'Paso 3 de 3 · Revisión y exportación',
    title: 'Edita la vista previa y comparte en segundos',
    description:
      'La IA nunca inventa nombres, fechas ni artículos legales. Siempre revisa y corrige cualquier campo antes de imprimir o enviar.',
    icon: FileCheck2,
    highlights: [
      {
        title: 'Marcas [COMPLETAR] y [VERIFICAR]',
        detail:
          'Cuando falte un dato o una referencia legal no subida, aparecerá resaltado en amarillo para que puedas completarlo con facilidad.',
      },
      {
        title: 'Biblioteca de formatos reutilizables',
        detail:
          'Sube un formato modelo (DOCX, PDF o foto) en cualquier módulo para guardar su estructura y reutilizarla por grado o nivel.',
      },
      {
        title: 'PDF, Word, Impresión y WhatsApp',
        detail:
          'La vista previa coincide con el PDF y la impresión. En celular, "Enviar por WhatsApp" comparte el archivo PDF directamente.',
      },
    ],
    tip: 'Puedes volver a abrir este tutorial en cualquier momento desde Configuración.',
  },
];

export const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  open,
  onComplete,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onComplete();
      } else if (e.key === 'ArrowRight' && stepIndex < TUTORIAL_STEPS.length - 1) {
        setStepIndex((i) => i + 1);
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        setStepIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, stepIndex, onComplete]);

  if (!open) return null;

  const current = TUTORIAL_STEPS[stepIndex];
  const Icon = current.icon;
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const progressPercent = ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Brand Header */}
        <div className="bg-[#003366] text-white px-5 pt-5 pb-4 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#FFA92D]" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#FFA92D] tracking-wide">
                  {current.kicker}
                </div>
                <h2
                  id="tutorial-modal-title"
                  className="text-base sm:text-lg font-extrabold leading-snug text-white mt-0.5"
                >
                  {current.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onComplete}
              aria-label="Cerrar tutorial"
              className="min-w-[40px] min-h-[40px] rounded-xl text-sky-100 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-[#FFA92D] rounded-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 leading-relaxed">{current.description}</p>

          {/* Visual mini-diagram for Step 2 (Camera workflow) */}
          {stepIndex === 1 && (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="flex flex-col items-center gap-1.5 p-2">
                <div className="w-9 h-9 rounded-xl bg-[#003366]/10 text-[#003366] flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-800">1. Tomar foto(s)</span>
                <span className="text-[10px] text-slate-500">Cámara trasera múltiple</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-2">
                <div className="w-9 h-9 rounded-xl bg-[#FFA92D]/20 text-[#003366] flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-800">2. IA estructura</span>
                <span className="text-[10px] text-slate-500">Respeta tu plantilla</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-800">3. Exportar</span>
                <span className="text-[10px] text-slate-500">PDF, Word o WhatsApp</span>
              </div>
            </div>
          )}

          {/* Structured Highlights */}
          <div className="space-y-2.5">
            {current.highlights.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1"
              >
                <div className="text-xs font-bold text-[#003366] flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#FFA92D]">0{idx + 1}.</span>
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>

          {/* Helpful note */}
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 text-xs text-amber-950">
            {stepIndex === 1 ? (
              <Mic className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            )}
            <span>{current.tip}</span>
          </div>
        </div>

        {/* Sticky Footer Controls */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 pb-safe">
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="min-h-[44px] px-3 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer"
              >
                Omitir
              </button>
            )}
          </div>

          {/* Step Dots */}
          <div className="hidden sm:flex items-center gap-1.5" aria-hidden="true">
            {TUTORIAL_STEPS.map((s, idx) => (
              <button
                key={s.stepNumber}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === stepIndex ? 'w-6 bg-[#003366]' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          {/* Primary CTA: Siguiente -> Entendido */}
          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))}
              className="min-h-[44px] px-5 rounded-xl bg-[#003366] hover:bg-[#00254a] active:scale-[0.98] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className="min-h-[44px] px-5 rounded-xl bg-[#003366] hover:bg-[#00254a] active:scale-[0.98] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#FFA92D]" />
              <span>Entendido</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
