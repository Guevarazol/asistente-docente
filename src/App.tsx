/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  BellRing,
  BookOpen,
  BookOpenCheck,
  CalendarRange,
  Camera,
  ClipboardCheck,
  FileSignature,
  GraduationCap,
  ListChecks,
  ShieldAlert,
  Users,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import type {
  ClassGuideData,
  ClassroomGradebook,
  DiplomaBatchData,
  ExamData,
  IncidentLogData,
  LessonPlanData,
  MinutesData,
  ModuleId,
  MyGradesData,
  PacingGuideData,
  ReminderAlert,
  SavedDocument,
  SchoolConfig,
  SyllabusData,
  UserProfile,
} from './types/casm';
import { DEFAULT_SCHOOL_CONFIG, loadSchoolConfig, saveSchoolConfig } from './db/indexedDb';
import {
  buildReminderBody,
  computeTriggerTimestamp,
  dispatchBrowserNotification,
  REMINDER_CATEGORY_LABELS,
} from './utils/reminderNotifications';
import { PinLockScreen } from './components/PinLockScreen';
import { AppHeader, type MainView, MobileBottomNav } from './components/AppHeader';
import { OfflineIndicator } from './components/PWAInstallButton';
import { OnboardingTutorialModal } from './components/OnboardingTutorialModal';
import { HistoryView, MODULE_LABELS } from './components/HistoryView';
import { TemplatesLibraryView } from './components/TemplatesLibraryView';
import { ConfigurationView } from './components/ConfigurationView';
import { ApiKeyModal } from './components/ApiKeyModal';
import { TeacherPhotoModal } from './components/TeacherPhotoModal';
import { UserManualModal } from './components/UserManualModal';
import { checkLicenseStatus, type LicenseStatus } from './utils/licenseManager';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { HiddenLicenseModal } from './components/HiddenLicenseModal';
import { ModuleLockBanner } from './components/ModuleLockBanner';
import { ModuleUnlockModal } from './components/ModuleUnlockModal';
import { IncidentLogModule } from './modules/IncidentLogModule';
import { LessonPlanModule } from './modules/LessonPlanModule';
import { ExamModule } from './modules/ExamModule';
import { PacingGuideModule } from './modules/PacingGuideModule';
import { MinutesModule } from './modules/MinutesModule';
import { ClassGuideModule } from './modules/ClassGuideModule';
import { SyllabusModule } from './modules/SyllabusModule';
import { DiplomaModule } from './modules/DiplomaModule';
import { MyGradesModule } from './modules/MyGradesModule';
import { AcademicPerformanceModule } from './modules/AcademicPerformanceModule';

interface ModuleCardMeta {
  id: ModuleId;
  number: string;
  title: string;
  subtitle: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBg: string;
  accentText: string;
}

const MODULE_CARDS: ModuleCardMeta[] = [
  {
    id: 'grados',
    number: '01',
    title: 'Mis Grados y Alumnos',
    subtitle: 'Nómina · Cumpleaños · WhatsApp',
    detail: 'Aulas asignadas, carga por foto/Excel, cálculo automático de edad y enlace a Diplomas.',
    icon: Users,
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
  },
  {
    id: 'desempeno',
    number: '02',
    title: 'Desempeño Escolar',
    subtitle: 'Calificaciones · Semáforo · Conducta',
    detail: 'Notas por materia, ponderaciones MINEDUCYT (70/30), semáforo preventivo y reporte de incidentes.',
    icon: BarChart3,
    accentBg: 'bg-teal-50',
    accentText: 'text-teal-700',
  },
  {
    id: 'jornalizacion',
    number: '03',
    title: 'Jornalización Docente',
    subtitle: 'Calendario escolar integrado',
    detail: 'Distribución semanal por periodo con feriados, vacaciones y evaluaciones.',
    icon: CalendarRange,
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
  },
  {
    id: 'planificacion',
    number: '04',
    title: 'Planificación (Guion de clases)',
    subtitle: 'AOS · Horizontal Carta',
    detail: 'Generalidades, estándar, proceso didáctico con IFEA y detalle por clase.',
    icon: BookOpenCheck,
    accentBg: 'bg-sky-50',
    accentText: 'text-[#003366]',
  },
  {
    id: 'guias',
    number: '05',
    title: 'Guías por Clase',
    subtitle: 'Tercer Ciclo y Bachillerato',
    detail: 'Pestañas separadas (45 o 90 min), ejemplos resueltos y rúbricas.',
    icon: GraduationCap,
    accentBg: 'bg-cyan-50',
    accentText: 'text-cyan-800',
  },
  {
    id: 'temarios',
    number: '06',
    title: 'Temarios de Examen',
    subtitle: 'Coherentes con planificación',
    detail: 'Contenidos evaluados, fecha, ponderación y guía de estudio para padres.',
    icon: ListChecks,
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
  },
  {
    id: 'examenes',
    number: '07',
    title: 'Exámenes',
    subtitle: 'Con clave en hoja aparte',
    detail: 'Kinder a Bachillerato, escala 10 o %, versículo e ítems visuales.',
    icon: ClipboardCheck,
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
  },
  {
    id: 'bitacora',
    number: '08',
    title: 'Bitácora de Incidentes',
    subtitle: 'Ley Crecer Juntos · Confidencial',
    detail: 'Registro objetivo, iniciales opcionales, Reglamento Interno y derivaciones.',
    icon: ShieldAlert,
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-700',
  },
  {
    id: 'actas',
    number: '09',
    title: 'Actas',
    subtitle: '7 tipos institucionales',
    detail: 'Reunión de padres, compromisos conductuales/académicos, consejo y acuerdos.',
    icon: FileSignature,
    accentBg: 'bg-indigo-50',
    accentText: 'text-indigo-700',
  },
  {
    id: 'diplomas',
    number: '10',
    title: 'Diplomas de Graduación',
    subtitle: 'Oficio 8.5×13" · Lote PDF/ZIP/Word',
    detail: 'Marco azul y dorado, fecha en letras, revisión de tildes e importación de Mis Grados.',
    icon: Award,
    accentBg: 'bg-orange-50',
    accentText: 'text-orange-700',
  },
];

export default function App() {
  const [config, setConfig] = useState<SchoolConfig>(DEFAULT_SCHOOL_CONFIG);
  const [dbReady, setDbReady] = useState(false);
  const [unlocked, setUnlocked] = useState(true);

  const [activeView, setActiveView] = useState<MainView>('inicio');
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);
  const [openedDocument, setOpenedDocument] = useState<SavedDocument | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [firedAlerts, setFiredAlerts] = useState<ReminderAlert[]>([]);
  const [showTeacherPhotoModal, setShowTeacherPhotoModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(() => checkLicenseStatus());
  const [showHiddenLicenseModal, setShowHiddenLicenseModal] = useState(false);
  const [nexusClicks, setNexusClicks] = useState(0);

  // Module Data Lock State (Tamper-Protection)
  const [lockedModules, setLockedModules] = useState<Record<string, boolean>>(() => {
    try {
      const stored = sessionStorage.getItem('renova_locked_modules');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [showModuleUnlockModal, setShowModuleUnlockModal] = useState(false);

  const isCurrentModuleLocked = activeModule ? Boolean(lockedModules[activeModule]) : false;

  const handleLockCurrentModule = () => {
    if (!activeModule) return;
    setLockedModules((prev) => {
      const next = { ...prev, [activeModule]: true };
      try {
        sessionStorage.setItem('renova_locked_modules', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleUnlockCurrentModule = () => {
    if (!activeModule) return;
    setLockedModules((prev) => {
      const next = { ...prev, [activeModule]: false };
      try {
        sessionStorage.setItem('renova_locked_modules', JSON.stringify(next));
      } catch {}
      return next;
    });
    setShowModuleUnlockModal(false);
  };

  const handleToggleModuleLock = () => {
    if (isCurrentModuleLocked) {
      setShowModuleUnlockModal(true);
    } else {
      handleLockCurrentModule();
    }
  };

  // Inactivity Auto-Lock: if a module is open and inactive for 5 minutes, automatically protect data
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeView === 'modulo' && activeModule && !isCurrentModuleLocked) {
          handleLockCurrentModule();
        }
      }, 5 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [activeView, activeModule, isCurrentModuleLocked]);

  // Alt + L shortcut to quickly toggle module data lock
  useEffect(() => {
    const handleAltL = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeView === 'modulo') {
          handleToggleModuleLock();
        }
      }
    };
    window.addEventListener('keydown', handleAltL);
    return () => window.removeEventListener('keydown', handleAltL);
  }, [activeView, activeModule, isCurrentModuleLocked]);

  const handleSecretNexusClick = () => {
    setNexusClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowHiddenLicenseModal(true);
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) ||
        (e.ctrlKey && e.altKey && (e.key === 'L' || e.key === 'l'))
      ) {
        e.preventDefault();
        setShowHiddenLicenseModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLicenseStatus(checkLicenseStatus());
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveTeacherPhoto = async (data: { photoUrl: string; name?: string; gender?: 'femenino' | 'masculino' }) => {
    const updatedUserProfile: UserProfile = {
      name: data.name !== undefined ? data.name : (config.userProfile?.name || ''),
      gender: data.gender || config.userProfile?.gender || 'femenino',
      specialty: config.userProfile?.specialty || '',
      signatureDataUrl: config.userProfile?.signatureDataUrl || '',
      photoUrl: data.photoUrl,
    };
    const updatedConfig: SchoolConfig = {
      ...config,
      userProfile: updatedUserProfile,
    };
    setConfig(updatedConfig);
    await saveSchoolConfig(updatedConfig);
  };

  useEffect(() => {
    const handleMissingKey = () => {
      setShowApiKeyModal(true);
    };
    window.addEventListener('casm-missing-api-key', handleMissingKey);
    return () => window.removeEventListener('casm-missing-api-key', handleMissingKey);
  }, []);

  useEffect(() => {
    void loadSchoolConfig().then((cfg) => {
      setConfig(cfg);
      setDbReady(true);
    });
  }, []);

  // Active scheduler for programmed delivery & grading deadline reminders
  useEffect(() => {
    if (!unlocked) return;
    const reminders = config.reminders || [];
    const pending = reminders.filter((r) => r.enabled && !r.notifiedAt);
    if (pending.length === 0) return;

    let cancelled = false;

    const checkDueReminders = async () => {
      const now = Date.now();
      const dueNow = pending.filter((r) => {
        const triggerMs = computeTriggerTimestamp(r);
        return triggerMs !== null && triggerMs <= now;
      });
      if (dueNow.length === 0 || cancelled) return;

      const sentAt = new Date().toISOString();
      const dueIds = new Set(dueNow.map((r) => r.id));

      for (const rem of dueNow) {
        const title = `CASM Docente · ${rem.title}`;
        const body = buildReminderBody(rem);
        void dispatchBrowserNotification(title, body, `casm-rem-${rem.id}`);
      }

      setFiredAlerts((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const additions = dueNow.filter((item) => !existingIds.has(item.id));
        return additions.length > 0 ? [...additions, ...prev] : prev;
      });

      const updatedReminders = (config.reminders || []).map((r) =>
        dueIds.has(r.id) ? { ...r, notifiedAt: sentAt } : r
      );
      const updatedConfig: SchoolConfig = { ...config, reminders: updatedReminders };
      setConfig(updatedConfig);
      await saveSchoolConfig(updatedConfig);
    };

    void checkDueReminders();

    // Check every 30 seconds while open, plus an exact timer for the next upcoming alert within 24h
    const intervalId = window.setInterval(() => {
      void checkDueReminders();
    }, 30_000);

    const upcomingDelays = pending
      .map((r) => computeTriggerTimestamp(r))
      .filter((ms): ms is number => ms !== null && ms > Date.now() && ms - Date.now() <= 86_400_000)
      .map((ms) => ms - Date.now());

    const nextTimeoutId =
      upcomingDelays.length > 0
        ? window.setTimeout(() => {
            void checkDueReminders();
          }, Math.min(...upcomingDelays) + 500)
        : null;

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (nextTimeoutId !== null) window.clearTimeout(nextTimeoutId);
    };
  }, [unlocked, config]);

  const handleCompleteTutorial = async () => {
    setShowTutorial(false);
    if (!config.hasSeenTutorial) {
      const updated: SchoolConfig = { ...config, hasSeenTutorial: true };
      setConfig(updated);
      await saveSchoolConfig(updated);
    }
  };

  useEffect(() => {
    if (activeView === 'modulo' && activeModule) {
      document.title = `${MODULE_LABELS[activeModule]} · Asistente Docente`;
    } else if (activeView === 'historial') {
      document.title = 'Historial de Documentos · Asistente Docente';
    } else if (activeView === 'plantillas') {
      document.title = 'Biblioteca de Plantillas · Asistente Docente';
    } else if (activeView === 'configuracion') {
      document.title = 'Configuración Institucional · Asistente Docente';
    } else {
      document.title = 'Asistente Docente · RENOVA NEXUS';
    }
  }, [activeView, activeModule]);

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-[#003366] flex items-center justify-center text-white text-sm font-semibold">
        Cargando Asistente Docente...
      </div>
    );
  }

  if (!unlocked) {
    return (
      <PinLockScreen
        config={config}
        onUnlocked={(updatedCfg) => {
          setConfig(updatedCfg);
          setUnlocked(true);
          if (!updatedCfg.hasSeenTutorial) {
            setShowTutorial(true);
          }
        }}
      />
    );
  }

  // Enforce hidden license expiration & device binding lock
  const isDeviceBlocked = !licenseStatus.deviceBinding.isAuthorized && !licenseStatus.deviceBinding.isPortableUsbMode;
  if (licenseStatus.isExpired || isDeviceBlocked) {
    return (
      <>
        <LicenseLockScreen
          expiresAtFormatted={licenseStatus.formattedExpiresAt}
          isExpired={licenseStatus.isExpired}
          deviceBinding={licenseStatus.deviceBinding}
          onUnlocked={() => setLicenseStatus(checkLicenseStatus())}
          onOpenAdminPanel={() => setShowHiddenLicenseModal(true)}
        />
        <HiddenLicenseModal
          open={showHiddenLicenseModal}
          onClose={() => setShowHiddenLicenseModal(false)}
          onLicenseUpdated={() => setLicenseStatus(checkLicenseStatus())}
        />
      </>
    );
  }

  const handleOpenModule = (moduleId: ModuleId) => {
    setOpenedDocument(null);
    setActiveModule(moduleId);
    setActiveView('modulo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSavedDocument = (doc: SavedDocument) => {
    setOpenedDocument(doc);
    setActiveModule(doc.module);
    setActiveView('modulo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (view: MainView) => {
    if (view !== 'modulo') {
      setActiveModule(null);
      setOpenedDocument(null);
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col w-full overflow-x-hidden">
      <AppHeader
        config={config}
        activeView={activeView}
        onNavigate={handleNavigate}
        onLockApp={() => setUnlocked(false)}
        onOpenApiKeyModal={() => setShowApiKeyModal(true)}
        onOpenManual={() => setShowManualModal(true)}
        onSecretNexusClick={handleSecretNexusClick}
        isModuleLocked={isCurrentModuleLocked}
        onToggleModuleLock={handleToggleModuleLock}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 pt-5 pb-24 md:pb-12 min-w-0">
        {/* HOME: 8 LARGE MODULE CARDS */}
        {activeView === 'inicio' && (
          <div className="space-y-6">
            {/* School context strip */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* 1. School Logo */}
                <div className="relative shrink-0">
                  <img
                    src={config.casmLogo || '/assets/casm-logo.png'}
                    alt="Logo Institución Educativa"
                    className="w-14 h-14 object-contain rounded-xl border border-slate-100 bg-slate-50/50 p-1"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* 2. Teacher Photo + Title & Name underneath */}
                <div className="flex flex-col items-center shrink-0 group">
                  <div className="relative">
                    {config.userProfile?.photoUrl ? (
                      <img
                        src={config.userProfile.photoUrl}
                        alt={`Foto del docente`}
                        className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-full border-2 border-[#FFA92D] shadow-sm bg-slate-100 cursor-pointer"
                        onClick={() => setShowTeacherPhotoModal(true)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowTeacherPhotoModal(true)}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-slate-300 hover:border-[#FFA92D] bg-slate-50 hover:bg-amber-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-[#003366] transition cursor-pointer"
                        title="Tomar o cargar foto del docente"
                      >
                        <Camera className="w-5 h-5 text-slate-400 group-hover:text-[#FFA92D]" />
                        <span className="text-[9px] font-bold leading-none mt-0.5">Mi Foto</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowTeacherPhotoModal(true)}
                      title={config.userProfile?.photoUrl ? 'Cambiar foto o nombre del docente' : 'Tomar o cargar foto del docente'}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#003366] hover:bg-[#FFA92D] text-white hover:text-[#003366] flex items-center justify-center shadow-xs transition cursor-pointer border border-white"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Nombre y tratamiento abajo de la foto */}
                  <button
                    type="button"
                    onClick={() => setShowTeacherPhotoModal(true)}
                    className="mt-1 text-center max-w-[105px] sm:max-w-[125px] min-w-0 cursor-pointer group-hover:opacity-90"
                    title="Editar perfil y nombre del docente"
                  >
                    <div className="text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#FFA92D] leading-none">
                      {config.userProfile?.gender === 'masculino' ? 'Profesor' : 'Profesora'}
                    </div>
                    <div
                      className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight truncate mt-0.5"
                      title={config.userProfile?.name || 'Clic para escribir nombre'}
                    >
                      {config.userProfile?.name ? config.userProfile.name : 'Asignar nombre'}
                    </div>
                  </button>
                </div>

                {/* 3. School Details */}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-500">
                    {config.schoolCity} · Año Lectivo {config.academicYear}
                  </div>
                  <h1 className="text-lg sm:text-2xl font-extrabold text-[#003366] tracking-tight">
                    {config.schoolName}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {config.schoolSubtitle || 'Selecciona un módulo para generar, editar o imprimir.'}
                  </p>
                </div>
              </div>

              {/* Right side: Teacher Info and subtle optional settings note */}
              <div className="text-xs text-slate-500 sm:text-right border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 flex flex-col items-start sm:items-end gap-1 shrink-0">
                {config.userProfile?.name?.trim() && (
                  <div>
                    Docente:{' '}
                    <strong className="text-[#003366]">{config.userProfile.name.trim()}</strong>
                    {config.userProfile.specialty?.trim()
                      ? ` · ${config.userProfile.specialty.trim()}`
                      : ''}
                  </div>
                )}
                <div>Datos resguardados localmente en tu dispositivo</div>
                <div className="text-[11px] text-slate-400">
                  (Opcional: puedes personalizar la institución en{' '}
                  <button
                    type="button"
                    onClick={() => handleNavigate('configuracion')}
                    className="text-[#003366] hover:text-[#FFA92D] underline font-semibold cursor-pointer"
                  >
                    Ajustes
                  </button>
                  )
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  className="mt-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#003366] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Abrir Manual de Uso Oficial y Referencia Operativa"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#FFA92D]" />
                  <span>Manual de Uso (PDF)</span>
                </button>
              </div>
            </section>

            {/* 8 Large Cards Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {MODULE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleOpenModule(card.id)}
                    className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-[#003366] hover:shadow-md active:scale-[0.99] p-5 flex flex-col justify-between gap-4 transition cursor-pointer min-h-[168px]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl ${card.accentBg} ${card.accentText} flex items-center justify-center shrink-0`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-300 group-hover:text-[#FFA92D] transition">
                        {card.number}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500">
                        {card.subtitle}
                      </div>
                      <h2 className="text-base font-extrabold text-[#003366] leading-snug">
                        {card.title}
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {card.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </section>
          </div>
        )}

        {/* ACTIVE MODULE WORKSPACE */}
        {activeView === 'modulo' && activeModule && (
          <div className="space-y-3">
            <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleNavigate('inicio')}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-[#003366] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Módulos</span>
                </button>
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-[#003366] tracking-tight">
                    {MODULE_LABELS[activeModule]}
                  </h1>
                  {openedDocument && (
                    <p className="text-[11px] text-slate-500">
                      Editando documento guardado: {openedDocument.title}
                    </p>
                  )}
                </div>
              </div>

              {/* Botón rápido de bloqueo en cabecera del módulo */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleModuleLock}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                    isCurrentModuleLocked
                      ? 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 ring-2 ring-amber-300/40 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
                  }`}
                  title={
                    isCurrentModuleLocked
                      ? 'Desbloquear campos con PIN o código para seguir editando'
                      : 'Bloquear campos de este módulo para evitar alteraciones'
                  }
                >
                  {isCurrentModuleLocked ? (
                    <>
                      <Unlock className="w-4 h-4 text-slate-950" />
                      <span>Seguir Editando</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-amber-700" />
                      <span>Bloquear Datos</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Banner de Bloqueo de Datos */}
            <ModuleLockBanner
              isLocked={isCurrentModuleLocked}
              moduleName={MODULE_LABELS[activeModule]}
              onLock={handleLockCurrentModule}
              onUnlockRequest={() => setShowModuleUnlockModal(true)}
            />

            {/* Contenedor del Módulo con Protección activa si está bloqueado */}
            <div className={`transition-all duration-200 relative ${
              isCurrentModuleLocked ? 'pointer-events-none select-none opacity-90' : ''
            }`}>
              {isCurrentModuleLocked && (
                <div
                  onClick={() => setShowModuleUnlockModal(true)}
                  className="absolute inset-0 z-30 bg-slate-900/5 backdrop-blur-[0.5px] rounded-2xl flex items-start justify-center pt-8 pointer-events-auto cursor-not-allowed group"
                  title="Campos bloqueados contra alteraciones. Haz clic aquí para desbloquear con PIN."
                >
                  <div className="bg-white/95 text-slate-800 px-4 py-2.5 rounded-2xl shadow-lg border-2 border-amber-300 flex items-center gap-2 text-xs font-bold animate-in fade-in zoom-in-95 group-hover:scale-105 transition cursor-pointer">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Campos protegidos contra edición · Haz clic para desbloquear con PIN</span>
                  </div>
                </div>
              )}

              {activeModule === 'bitacora' && (
                <IncidentLogModule
                  key={openedDocument?.id || 'new-bitacora'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<IncidentLogData> | null}
                />
              )}
              {activeModule === 'planificacion' && (
                <LessonPlanModule
                  key={openedDocument?.id || 'new-plan'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<LessonPlanData> | null}
                />
              )}
              {activeModule === 'examenes' && (
                <ExamModule
                  key={openedDocument?.id || 'new-exam'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<ExamData> | null}
                />
              )}
              {activeModule === 'jornalizacion' && (
                <PacingGuideModule
                  key={openedDocument?.id || 'new-jor'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<PacingGuideData> | null}
                />
              )}
              {activeModule === 'actas' && (
                <MinutesModule
                  key={openedDocument?.id || 'new-actas'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<MinutesData> | null}
                />
              )}
              {activeModule === 'guias' && (
                <ClassGuideModule
                  key={openedDocument?.id || 'new-guias'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<ClassGuideData> | null}
                />
              )}
              {activeModule === 'temarios' && (
                <SyllabusModule
                  key={openedDocument?.id || 'new-temarios'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<SyllabusData> | null}
                />
              )}
              {activeModule === 'diplomas' && (
                <DiplomaModule
                  key={openedDocument?.id || 'new-diplomas'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<DiplomaBatchData> | null}
                />
              )}
              {activeModule === 'grados' && (
                <MyGradesModule
                  key={openedDocument?.id || 'grades-registry'}
                  config={config}
                />
              )}
              {activeModule === 'desempeno' && (
                <AcademicPerformanceModule
                  key={openedDocument?.id || 'performance-registry'}
                  config={config}
                  initialDocument={openedDocument as SavedDocument<ClassroomGradebook> | null}
                />
              )}
            </div>
          </div>
        )}

        {activeView === 'historial' && (
          <HistoryView config={config} onOpenDocument={handleOpenSavedDocument} />
        )}

        {activeView === 'plantillas' && <TemplatesLibraryView />}

        {activeView === 'configuracion' && (
          <ConfigurationView
            config={config}
            onConfigUpdated={setConfig}
            onOpenTutorial={() => setShowTutorial(true)}
            onOpenLicenseModal={() => setShowHiddenLicenseModal(true)}
          />
        )}
      </main>

      {/* Footer con Copyright 2026 Corporación Médica Integral RENOVA */}
      <footer className="no-print mt-auto border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-600 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 font-bold text-slate-800 text-xs sm:text-sm">
            <span>© 2026 Corporación Médica Integral RENOVA</span>
            <span className="text-slate-300">·</span>
            <span className="text-[#003366] font-extrabold">Asistente Docente</span>
            <span className="text-slate-300">·</span>
            <span
              onClick={handleSecretNexusClick}
              className="text-[#FFA92D] font-black cursor-pointer select-none"
              title="RENOVA NEXUS"
            >
              RENOVA NEXUS
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Todos los derechos reservados.
          </div>
        </div>
      </footer>

      <MobileBottomNav activeView={activeView} onNavigate={handleNavigate} />
      <OfflineIndicator />

      {/* In-app reminder alert banners when scheduled deadlines trigger */}
      {firedAlerts.length > 0 && (
        <div className="no-print fixed top-20 right-3 left-3 sm:left-auto sm:w-96 z-50 space-y-2">
          {firedAlerts.map((alert) => (
            <div
              key={alert.id}
              role="alert"
              className="bg-[#003366] text-white rounded-2xl shadow-lg border border-[#FFA92D]/60 p-3.5 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-[#FFA92D] text-[#003366] flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#FFA92D]">
                  {REMINDER_CATEGORY_LABELS[alert.category]}
                </div>
                <div className="text-xs font-extrabold leading-snug mt-0.5">{alert.title}</div>
                <p className="text-[11px] text-sky-100 mt-1 leading-snug">
                  {buildReminderBody(alert)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar alerta"
                onClick={() =>
                  setFiredAlerts((prev) => prev.filter((item) => item.id !== alert.id))
                }
                className="p-1 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <OnboardingTutorialModal
        open={showTutorial}
        onComplete={() => void handleCompleteTutorial()}
      />

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
      />

      <TeacherPhotoModal
        open={showTeacherPhotoModal}
        currentPhoto={config.userProfile?.photoUrl}
        currentName={config.userProfile?.name}
        currentGender={config.userProfile?.gender}
        onSave={(data) => void handleSaveTeacherPhoto(data)}
        onClose={() => setShowTeacherPhotoModal(false)}
      />

      <UserManualModal
        open={showManualModal}
        config={config}
        onClose={() => setShowManualModal(false)}
      />

      <HiddenLicenseModal
        open={showHiddenLicenseModal}
        onClose={() => setShowHiddenLicenseModal(false)}
        onLicenseUpdated={() => setLicenseStatus(checkLicenseStatus())}
      />

      <ModuleUnlockModal
        open={showModuleUnlockModal}
        config={config}
        moduleName={activeModule ? MODULE_LABELS[activeModule] : undefined}
        onUnlocked={handleUnlockCurrentModule}
        onClose={() => setShowModuleUnlockModal(false)}
      />
    </div>
  );
}
