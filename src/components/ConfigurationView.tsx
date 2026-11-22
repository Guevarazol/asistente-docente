import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Calendar,
  Camera,
  Check,
  Clock,
  Database,
  Download,
  FileUp,
  HelpCircle,
  KeyRound,
  Lock,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  UserCircle2,
} from 'lucide-react';
import type {
  HolidayOrEvent,
  ReminderAlert,
  ReminderCategory,
  SchoolConfig,
  TeacherProfile,
  UserProfile,
} from '../types/casm';
import {
  exportDatabaseBackup,
  getDatabaseStats,
  hashPin,
  importDatabaseBackup,
  saveSchoolConfig,
  validateBackupPayload,
  verifyPin,
  type DatabaseBackupPayload,
  type DatabaseStats,
} from '../db/indexedDb';
import { fileToImageDataUrl } from '../utils/fileReader';
import {
  computeDueTimestamp,
  dispatchBrowserNotification,
  formatDueDateSpanish,
  getAdvanceLabel,
  getNotificationPermission,
  REMINDER_ADVANCE_OPTIONS,
  REMINDER_CATEGORY_LABELS,
  requestNotificationPermission,
  type BrowserNotificationPermission,
} from '../utils/reminderNotifications';
import { SignaturePadCanvas } from './SignaturePadCanvas';
import { TeacherPhotoModal } from './TeacherPhotoModal';

interface ConfigurationViewProps {
  config: SchoolConfig;
  onConfigUpdated: (next: SchoolConfig) => void;
  onOpenTutorial?: () => void;
  onOpenLicenseModal?: () => void;
}

const MAX_BACKUP_BYTES = 50 * 1024 * 1024; // 50 MB safety limit

export const ConfigurationView: React.FC<ConfigurationViewProps> = ({
  config,
  onConfigUpdated,
  onOpenTutorial,
  onOpenLicenseModal,
}) => {
  const [draft, setDraft] = useState<SchoolConfig>(config);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  // Local IndexedDB backup & restore state
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    payload: DatabaseBackupPayload;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Browser notification reminders state
  const [notifPermission, setNotifPermission] = useState<BrowserNotificationPermission>(() =>
    getNotificationPermission()
  );
  const [remCategory, setRemCategory] = useState<ReminderCategory>('planificacion');
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [remTime, setRemTime] = useState('08:00');
  const [remAdvance, setRemAdvance] = useState<number>(1440);
  const [remNotes, setRemNotes] = useState('');
  const [remNotice, setRemNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [savingDrawnSig, setSavingDrawnSig] = useState(false);
  const [showTeacherPhotoModal, setShowTeacherPhotoModal] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    void getDatabaseStats()
      .then(setDbStats)
      .catch(() => setDbStats(null));
  }, []);

  const handleSave = async () => {
    await saveSchoolConfig(draft);
    onConfigUpdated(draft);
    setSavedNotice('Configuración guardada en este dispositivo.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleLogoUpload = async (
    field: 'casmLogo' | 'renovaLogo' | 'nationalShield' | 'directorSignature',
    file: File | null
  ) => {
    if (!file) return;
    const dataUrl = await fileToImageDataUrl(file);
    setDraft((p) => ({ ...p, [field]: dataUrl }));
  };

  const handleTeacherSigUpload = async (teacherId: string, file: File | null) => {
    if (!file) return;
    const dataUrl = await fileToImageDataUrl(file);
    setDraft((p) => ({
      ...p,
      teachers: p.teachers.map((t) =>
        t.id === teacherId ? { ...t, signatureDataUrl: dataUrl } : t
      ),
    }));
  };

  const handleUserProfileSigUpload = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await fileToImageDataUrl(file);
    setDraft((p) => ({
      ...p,
      userProfile: {
        name: p.userProfile?.name || '',
        specialty: p.userProfile?.specialty || '',
        signatureDataUrl: dataUrl,
      },
    }));
  };

  const handleSaveUserProfile = async () => {
    const cleanProfile: UserProfile = {
      name: (draft.userProfile?.name || '').trim(),
      gender: draft.userProfile?.gender || 'femenino',
      specialty: (draft.userProfile?.specialty || '').trim(),
      signatureDataUrl: draft.userProfile?.signatureDataUrl || '',
      photoUrl: draft.userProfile?.photoUrl || '',
    };
    const updated: SchoolConfig = { ...draft, userProfile: cleanProfile };
    setDraft(updated);
    await saveSchoolConfig(updated);
    onConfigUpdated(updated);
    setProfileNotice(
      'Perfil guardado. Tu nombre, especialidad y firma se autocompletarán al crear nuevos documentos.'
    );
    setTimeout(() => setProfileNotice(null), 4000);
  };

  const handleSaveDrawnSignature = async (pngDataUrl: string) => {
    setSavingDrawnSig(true);
    try {
      const updated: SchoolConfig = {
        ...draft,
        userProfile: {
          name: (draft.userProfile?.name || '').trim(),
          specialty: (draft.userProfile?.specialty || '').trim(),
          signatureDataUrl: pngDataUrl,
        },
      };
      setDraft(updated);
      await saveSchoolConfig(updated);
      onConfigUpdated(updated);
      setShowSignaturePad(false);
      setProfileNotice(
        'Firma a mano alzada guardada en IndexedDB. Se insertará automáticamente en los documentos donde aparezca tu nombre.'
      );
      setTimeout(() => setProfileNotice(null), 4500);
    } finally {
      setSavingDrawnSig(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinMsg('El nuevo PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }
    if (draft.pinHash) {
      const ok = await verifyPin(currentPin, draft);
      if (!ok) {
        setPinMsg('El PIN actual no es correcto.');
        return;
      }
    }
    const { hash, salt } = await hashPin(newPin);
    const updated: SchoolConfig = { ...draft, pinHash: hash, pinSalt: salt };
    await saveSchoolConfig(updated);
    setDraft(updated);
    onConfigUpdated(updated);
    setCurrentPin('');
    setNewPin('');
    setPinMsg('PIN actualizado correctamente.');
  };

  const handleExportBackup = async () => {
    setBackupNotice(null);
    setBackupBusy(true);
    try {
      const payload = await exportDatabaseBackup();
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `Asistente-Docente-Respaldo-${dateStamp}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setDbStats({
        documents: payload.stores.documents.length,
        templates: payload.stores.templates.length,
        knowledgeBase: payload.stores.knowledgeBase.length,
      });
      setBackupNotice({
        type: 'success',
        text: `Respaldo descargado (${fileName}): ${payload.stores.documents.length} documentos, ${payload.stores.templates.length} plantillas y ${payload.stores.knowledgeBase.length} archivos de normativa.`,
      });
    } catch (err) {
      setBackupNotice({
        type: 'error',
        text:
          err instanceof Error
            ? `No se pudo exportar el respaldo: ${err.message}`
            : 'No se pudo exportar la base de datos local.',
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleSelectBackupFile = async (file: File | null) => {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
    }
    if (!file) return;
    setBackupNotice(null);
    setPendingImport(null);

    if (file.size > MAX_BACKUP_BYTES) {
      setBackupNotice({
        type: 'error',
        text: 'El archivo seleccionado supera el límite máximo permitido (50 MB).',
      });
      return;
    }

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('El archivo no tiene formato JSON válido.');
      }
      const validated = validateBackupPayload(parsed);
      setImportMode('merge');
      setPendingImport({ fileName: file.name, payload: validated });
    } catch (err) {
      setBackupNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo leer el archivo de respaldo seleccionado.',
      });
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    setBackupBusy(true);
    setBackupNotice(null);
    try {
      const result = await importDatabaseBackup(pendingImport.payload, importMode);
      setDraft(result.config);
      onConfigUpdated(result.config);
      setDbStats(result.counts);
      setPendingImport(null);
      setBackupNotice({
        type: 'success',
        text: `Respaldo restaurado correctamente (${
          importMode === 'replace' ? 'reemplazo completo' : 'combinado'
        }). Ahora tienes ${result.counts.documents} documentos, ${result.counts.templates} plantillas y ${result.counts.knowledgeBase} archivos normativos.`,
      });
    } catch (err) {
      setBackupNotice({
        type: 'error',
        text:
          err instanceof Error
            ? `Error al importar el respaldo: ${err.message}`
            : 'No se pudo restaurar el respaldo en IndexedDB.',
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const persistReminders = async (nextReminders: ReminderAlert[]) => {
    const updated: SchoolConfig = { ...draft, reminders: nextReminders };
    setDraft(updated);
    await saveSchoolConfig(updated);
    onConfigUpdated(updated);
  };

  const handleRequestNotifications = async () => {
    setRemNotice(null);
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      setRemNotice({
        type: 'success',
        text: 'Notificaciones del navegador activadas. Recibirás alertas en las fechas programadas.',
      });
    } else if (result === 'denied') {
      setRemNotice({
        type: 'error',
        text: 'El navegador bloqueó las notificaciones. Puedes habilitarlas desde el candado de la barra de direcciones; mientras tanto verás alertas internas en la app.',
      });
    } else if (result === 'unsupported') {
      setRemNotice({
        type: 'error',
        text: 'Este navegador no soporta notificaciones nativas. Los recordatorios se mostrarán dentro de la app.',
      });
    }
  };

  const handleTestNotification = async () => {
    setRemNotice(null);
    const sent = await dispatchBrowserNotification(
      'Asistente Docente — Prueba de recordatorio',
      'Las alertas para entregas de planificaciones y cierres de notas están funcionando correctamente.',
      'asistente-test-notif'
    );
    if (sent) {
      setRemNotice({
        type: 'success',
        text: 'Notificación de prueba enviada al navegador.',
      });
    } else {
      setRemNotice({
        type: 'error',
        text: 'No se pudo mostrar la notificación nativa. Verifica los permisos del navegador o del sistema.',
      });
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setRemNotice(null);

    const trimmedTitle = remTitle.trim();
    if (!trimmedTitle) {
      setRemNotice({
        type: 'error',
        text: 'Escribe un título para el recordatorio (ej. Entrega de Guion de Clases).',
      });
      return;
    }

    const dueMs = computeDueTimestamp(remDate, remTime);
    if (dueMs === null) {
      setRemNotice({
        type: 'error',
        text: 'Selecciona una fecha y hora límite válidas.',
      });
      return;
    }

    // Request notification permission automatically on first reminder if still default
    if (notifPermission === 'default') {
      const nextPerm = await requestNotificationPermission();
      setNotifPermission(nextPerm);
    }

    const newReminder: ReminderAlert = {
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: trimmedTitle,
      category: remCategory,
      dueDate: remDate,
      dueTime: remTime,
      advanceMinutes: remAdvance,
      notes: remNotes.trim() || undefined,
      enabled: true,
    };

    const currentList = draft.reminders || [];
    const nextList = [...currentList, newReminder].sort((a, b) =>
      `${a.dueDate}T${a.dueTime}`.localeCompare(`${b.dueDate}T${b.dueTime}`)
    );

    await persistReminders(nextList);
    setRemTitle('');
    setRemNotes('');
    setRemNotice({
      type: 'success',
      text: `Alerta programada: "${newReminder.title}" (${formatDueDateSpanish(newReminder.dueDate, newReminder.dueTime)}).`,
    });
  };

  const handleToggleReminder = async (id: string) => {
    const nextList = (draft.reminders || []).map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    await persistReminders(nextList);
  };

  const handleResetReminder = async (id: string) => {
    const nextList = (draft.reminders || []).map((r) =>
      r.id === id ? { ...r, enabled: true, notifiedAt: undefined } : r
    );
    await persistReminders(nextList);
    setRemNotice({
      type: 'success',
      text: 'Recordatorio reactivado para volver a notificar.',
    });
  };

  const handleDeleteReminder = async (id: string) => {
    const nextList = (draft.reminders || []).filter((r) => r.id !== id);
    await persistReminders(nextList);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#003366] tracking-tight">
            Configuración Institucional
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Personaliza datos del colegio, logos, firmas escaneadas (PNG), versículo, escala de calificación y calendario escolar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#003366] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Ver tutorial</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            className="min-h-[44px] px-5 rounded-xl bg-[#003366] hover:bg-[#00254a] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar cambios</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Perfil del Usuario Docente (Autocompletado) */}
      <section className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-[#FFA92D] p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-1.5">
              <UserCircle2 className="w-4 h-4 text-[#003366]" />
              <span>Mi Perfil Docente (Autocompletado en Documentos)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configura tu nombre, especialidad y firma escaneada para que se completen automáticamente en cada nuevo documento creado (Bitácora, Planificación, Exámenes, Jornalización, Actas, Guías, Temarios y Diplomas).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveUserProfile()}
            className="min-h-[40px] px-4 rounded-xl bg-[#003366] hover:bg-[#00254a] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar perfil</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tratamiento / Sexo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((p) => ({
                    ...p,
                    userProfile: {
                      ...(p.userProfile || { name: '', specialty: '', signatureDataUrl: '' }),
                      gender: 'femenino',
                    },
                  }))
                }
                className={`min-h-[42px] px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  (draft.userProfile?.gender || 'femenino') === 'femenino'
                    ? 'bg-[#003366] text-white border-[#003366]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>👩 Profesora</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((p) => ({
                    ...p,
                    userProfile: {
                      ...(p.userProfile || { name: '', specialty: '', signatureDataUrl: '' }),
                      gender: 'masculino',
                    },
                  }))
                }
                className={`min-h-[42px] px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  draft.userProfile?.gender === 'masculino'
                    ? 'bg-[#003366] text-white border-[#003366]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>👨 Profesor</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nombre completo del docente
            </label>
            <input
              type="text"
              value={draft.userProfile?.name || ''}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  userProfile: {
                    ...(p.userProfile || { specialty: '', signatureDataUrl: '' }),
                    name: e.target.value,
                  },
                }))
              }
              placeholder={draft.userProfile?.gender === 'masculino' ? 'Ej. Prof. Carlos Eduardo Martínez' : 'Ej. Prof. María Elena Ramos'}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Especialidad / Asignatura principal
            </label>
            <input
              type="text"
              list="casm-profile-specialty-list"
              value={draft.userProfile?.specialty || ''}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  userProfile: {
                    ...(p.userProfile || { name: '', signatureDataUrl: '' }),
                    specialty: e.target.value,
                  },
                }))
              }
              placeholder="Ej. Matemática, Lenguaje, Básica..."
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
            />
            <datalist id="casm-profile-specialty-list">
              {draft.subjects.map((subject) => (
                <option key={subject} value={subject} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Foto del Docente para Portada y Perfil */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {draft.userProfile?.photoUrl ? (
                <img
                  src={draft.userProfile.photoUrl}
                  alt="Foto del docente"
                  className="w-16 h-16 object-cover rounded-full border-2 border-[#FFA92D] shadow-xs bg-white"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400">
                  <UserCircle2 className="w-8 h-8 opacity-40" />
                  <span className="text-[9px] font-bold mt-0.5">Sin foto</span>
                </div>
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Foto o Retrato del Docente
                </div>
                <div className="text-[11px] text-slate-500">
                  Se muestra junto al nombre y logotipo del colegio en la portada principal.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTeacherPhotoModal(true)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#FFA92D] hover:bg-[#f29b1d] text-[#003366] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{draft.userProfile?.photoUrl ? 'Cambiar foto' : 'Tomar / Subir foto'}</span>
              </button>

              {draft.userProfile?.photoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    const nextUserProfile = {
                      ...(draft.userProfile || { name: '', specialty: '', signatureDataUrl: '' }),
                      photoUrl: '',
                    };
                    const nextConfig = { ...draft, userProfile: nextUserProfile };
                    setDraft(nextConfig);
                    void saveSchoolConfig(nextConfig);
                    onConfigUpdated(nextConfig);
                  }}
                  className="min-h-[40px] px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-xs flex items-center cursor-pointer"
                  title="Eliminar foto del docente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {draft.userProfile?.signatureDataUrl ? (
                <img
                  src={draft.userProfile.signatureDataUrl}
                  alt="Firma del docente"
                  className="h-12 max-w-[160px] object-contain bg-white border border-slate-200 rounded-lg px-2 py-1"
                />
              ) : (
                <div className="h-12 px-3 rounded-lg border border-dashed border-slate-300 bg-white flex items-center text-[11px] text-slate-400">
                  Sin firma cargada
                </div>
              )}
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Firma digital del docente (mano alzada o imagen PNG)
                </div>
                <div className="text-[11px] text-slate-500">
                  Se guarda en IndexedDB y se inserta automáticamente sobre las líneas de firma donde aparezca tu nombre.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSignaturePad((open) => !open)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#FFA92D] hover:bg-[#f29b1d] text-[#003366] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{showSignaturePad ? 'Ocultar lienzo' : 'Dibujar firma'}</span>
              </button>

              <label className="min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-[#003366] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{draft.userProfile?.signatureDataUrl ? 'Subir otra PNG' : 'Subir PNG'}</span>
                <input
                  type="file"
                  accept="image/png,image/*"
                  onChange={(e) => void handleUserProfileSigUpload(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {draft.userProfile?.signatureDataUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      userProfile: {
                        name: p.userProfile?.name || '',
                        specialty: p.userProfile?.specialty || '',
                        signatureDataUrl: '',
                      },
                    }))
                  }
                  aria-label="Quitar firma digital"
                  className="min-h-[40px] px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-xs flex items-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {showSignaturePad && (
            <SignaturePadCanvas
              saving={savingDrawnSig}
              onSaveSignature={handleSaveDrawnSignature}
              onCancel={() => setShowSignaturePad(false)}
            />
          )}
        </div>

        {profileNotice && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{profileNotice}</span>
          </div>
        )}
      </section>

      {/* 1. Datos del Colegio y Calificación */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#003366]">1. Identidad de la Institución Educativa</h3>
            <p className="text-xs text-slate-500">
              Personaliza el nombre de tu centro escolar, colegio o instituto, ciudad, año lectivo y logotipo para que se adapte a cualquier institución.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="min-h-[38px] px-4 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar cambios</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre de la Institución / Colegio / Centro Escolar</label>
            <input
              type="text"
              value={draft.schoolName}
              onChange={(e) => setDraft((p) => ({ ...p, schoolName: e.target.value }))}
              placeholder="Ej. Centro Escolar San Francisco, Instituto Nacional..."
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-[#003366]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ciudad / Municipio / Ubicación</label>
            <input
              type="text"
              value={draft.schoolCity}
              onChange={(e) => setDraft((p) => ({ ...p, schoolCity: e.target.value }))}
              placeholder="Ej. San Miguel, El Salvador"
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Subtítulo / Niveles educativos atendidos</label>
            <input
              type="text"
              value={draft.schoolSubtitle || ''}
              onChange={(e) => setDraft((p) => ({ ...p, schoolSubtitle: e.target.value }))}
              placeholder="Ej. Parvularia, Básica y Bachillerato · Selecciona un módulo para generar, editar o imprimir."
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Año lectivo</label>
            <input
              type="text"
              value={draft.academicYear}
              onChange={(e) => setDraft((p) => ({ ...p, academicYear: e.target.value }))}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono de contacto</label>
            <input
              type="text"
              value={draft.schoolPhone}
              onChange={(e) => setDraft((p) => ({ ...p, schoolPhone: e.target.value }))}
              placeholder="Ej. 2661-7260"
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sistema global de calificación</label>
            <select
              value={draft.gradingScale}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  gradingScale: e.target.value as 'points' | 'percentage',
                }))
              }
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
            >
              <option value="points">Por puntos (escala 10)</option>
              <option value="percentage">Por porcentaje (%)</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Color principal</label>
              <input
                type="color"
                value={draft.primaryColor}
                onChange={(e) => setDraft((p) => ({ ...p, primaryColor: e.target.value }))}
                className="w-full h-[42px] rounded-xl border border-slate-300 p-1 cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Color acento</label>
              <input
                type="color"
                value={draft.accentColor}
                onChange={(e) => setDraft((p) => ({ ...p, accentColor: e.target.value }))}
                className="w-full h-[42px] rounded-xl border border-slate-300 p-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Lema institucional o versículo (aparece en los encabezados de exámenes)
          </label>
          <input
            type="text"
            value={draft.verse}
            onChange={(e) => setDraft((p) => ({ ...p, verse: e.target.value }))}
            placeholder="Ej. Educar es redimir / Si puedes creer, al que cree todo le es posible"
            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs"
          />
        </div>
      </section>

      {/* 2. Logos y Escudo Reemplazables */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-[#003366]">2. Logos Reemplazables (PNG/JPG)</h3>
        <p className="text-xs text-slate-500">
          Sube el escudo o logotipo de tu colegio para que reemplace el logotipo por defecto en la portada y en todos los documentos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(
            [
              { key: 'casmLogo' as const, label: 'Logo / Escudo de la Institución (Documentos y Portada)', fallback: '/assets/casm-logo.png', wide: false },
              {
                key: 'renovaLogo' as const,
                label: 'Logo RENOVA (Encabezado App)',
                fallback: '/assets/aistudio/Logo_largo_renova_5b497c22.png',
                wide: true,
              },
              { key: 'nationalShield' as const, label: 'Escudo Nacional (Diplomas)', fallback: '/assets/escudo-elsalvador.png', wide: false },
            ]
          ).map((item) => (
            <div key={item.key} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center gap-2.5">
              <img
                src={draft[item.key] || item.fallback}
                alt={item.label}
                className={`${item.wide ? 'w-40' : 'w-20'} h-20 object-contain bg-white rounded-xl p-1.5 border border-slate-200`}
              />
              <div className="text-xs font-semibold text-slate-700 text-center">{item.label}</div>
              <label className="min-h-[36px] px-3 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#003366] flex items-center gap-1.5 cursor-pointer hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5" />
                <span>Reemplazar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleLogoUpload(item.key, e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Directora, Docentes y Firmas Escaneadas (PNG) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#003366]">3. Directora, Docentes y Firmas Escaneadas (PNG)</h3>
          <button
            type="button"
            onClick={() =>
              setDraft((p) => ({
                ...p,
                teachers: [
                  ...p.teachers,
                  { id: `t-${Date.now()}`, name: 'Nuevo Docente', role: 'Docente' },
                ],
              }))
            }
            className="min-h-[36px] px-3 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Docente
          </button>
        </div>

        {/* Director */}
        <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-[#003366] mb-1">Directora (Firmante principal)</label>
            <input
              type="text"
              value={draft.directorName}
              onChange={(e) => setDraft((p) => ({ ...p, directorName: e.target.value }))}
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs"
            />
          </div>
          <div className="flex items-center gap-3">
            {draft.directorSignature && (
              <img src={draft.directorSignature} alt="Firma directora" className="h-10 bg-white border rounded px-1" />
            )}
            <label className="min-h-[40px] px-3 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#003366] flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{draft.directorSignature ? 'Cambiar firma PNG' : 'Subir firma PNG'}</span>
              <input
                type="file"
                accept="image/png,image/*"
                onChange={(e) => void handleLogoUpload('directorSignature', e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Teachers list */}
        <div className="space-y-2">
          {draft.teachers.map((t: TeacherProfile) => (
            <div key={t.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="text"
                value={t.name}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    teachers: p.teachers.map((item) =>
                      item.id === t.id ? { ...item, name: e.target.value } : item
                    ),
                  }))
                }
                className="flex-1 min-h-[38px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              />
              <input
                type="text"
                value={t.role}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    teachers: p.teachers.map((item) =>
                      item.id === t.id ? { ...item, role: e.target.value } : item
                    ),
                  }))
                }
                className="sm:w-44 min-h-[38px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <div className="flex items-center gap-2">
                {t.signatureDataUrl && (
                  <img src={t.signatureDataUrl} alt="Firma" className="h-8 bg-white border rounded px-1" />
                )}
                <label className="min-h-[38px] px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Firma PNG</span>
                  <input
                    type="file"
                    accept="image/png,image/*"
                    onChange={(e) => void handleTeacherSigUpload(t.id, e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((p) => ({ ...p, teachers: p.teachers.filter((item) => item.id !== t.id) }))
                  }
                  className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Grados, Secciones y Asignaturas */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-[#003366]">4. Grados, Secciones y Asignaturas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grados (uno por línea)</label>
            <textarea
              rows={6}
              value={draft.grades.join('\n')}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  grades: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                }))
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Secciones (separadas por coma)</label>
            <input
              type="text"
              value={draft.sections.join(', ')}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  sections: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                }))
              }
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs"
            />
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-[#003366]">Niveles para Diplomas</div>
              {(
                [
                  ['kinder', 'Kinder / Preparatoria'],
                  ['sexto', '6.º Grado'],
                  ['noveno', '9.º Grado'],
                  ['bachillerato', 'Bachillerato'],
                ] as const
              ).map(([k, lbl]) => (
                <div key={k}>
                  <label className="block text-[11px] text-slate-500">{lbl}</label>
                  <input
                    type="text"
                    value={draft.diploma.levelMap[k]}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        diploma: {
                          ...p.diploma,
                          levelMap: { ...p.diploma.levelMap, [k]: e.target.value },
                        },
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Asignaturas (una por línea)</label>
            <textarea
              rows={6}
              value={draft.subjects.join('\n')}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  subjects: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                }))
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
            />
          </div>
        </div>
      </section>

      {/* 5. Calendario Escolar (Jornalización) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#003366] flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>5. Calendario Escolar (Feriados, Evaluaciones y Vacaciones)</span>
          </h3>
          <button
            type="button"
            onClick={() =>
              setDraft((p) => ({
                ...p,
                calendarEvents: [
                  ...p.calendarEvents,
                  {
                    id: `ev-${Date.now()}`,
                    name: 'Nuevo evento',
                    startDate: `${p.academicYear}-05-01`,
                    endDate: `${p.academicYear}-05-01`,
                    type: 'feriado',
                  },
                ],
              }))
            }
            className="min-h-[36px] px-3 rounded-lg bg-[#003366] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Fecha
          </button>
        </div>

        <div className="space-y-2">
          {draft.calendarEvents.map((ev: HolidayOrEvent) => (
            <div key={ev.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="text"
                value={ev.name}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    calendarEvents: p.calendarEvents.map((item) =>
                      item.id === ev.id ? { ...item, name: e.target.value } : item
                    ),
                  }))
                }
                className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
              />
              <select
                value={ev.type}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    calendarEvents: p.calendarEvents.map((item) =>
                      item.id === ev.id
                        ? { ...item, type: e.target.value as HolidayOrEvent['type'] }
                        : item
                    ),
                  }))
                }
                className="sm:col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="feriado">Feriado</option>
                <option value="evaluacion">Evaluación</option>
                <option value="vacacion">Vacación</option>
              </select>
              <input
                type="date"
                value={ev.startDate}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    calendarEvents: p.calendarEvents.map((item) =>
                      item.id === ev.id ? { ...item, startDate: e.target.value } : item
                    ),
                  }))
                }
                className="sm:col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <input
                type="date"
                value={ev.endDate}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    calendarEvents: p.calendarEvents.map((item) =>
                      item.id === ev.id ? { ...item, endDate: e.target.value } : item
                    ),
                  }))
                }
                className="sm:col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((p) => ({
                    ...p,
                    calendarEvents: p.calendarEvents.filter((item) => item.id !== ev.id),
                  }))
                }
                className="sm:col-span-1 p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer flex justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Alertas Recordatorias (API de Notificaciones del Navegador) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-1.5">
              <BellRing className="w-4 h-4" />
              <span>6. Alertas Recordatorias (Planificaciones y Cierres de Notas)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Programa avisos del navegador para fechas límite de entrega de guiones de clase, jornalizaciones o cierres de notas de periodo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {notifPermission === 'granted' && (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                  <Bell className="w-3.5 h-3.5" />
                  Notificaciones activas
                </span>
                <button
                  type="button"
                  onClick={() => void handleTestNotification()}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#003366] text-xs font-semibold cursor-pointer"
                >
                  Probar notificación
                </button>
              </>
            )}

            {notifPermission === 'default' && (
              <button
                type="button"
                onClick={() => void handleRequestNotifications()}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#FFA92D] hover:bg-[#f29b1d] text-[#003366] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Activar notificaciones</span>
              </button>
            )}

            {(notifPermission === 'denied' || notifPermission === 'unsupported') && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <BellOff className="w-3.5 h-3.5" />
                {notifPermission === 'denied'
                  ? 'Bloqueadas en navegador (aviso interno activo)'
                  : 'Sin soporte nativo (aviso interno activo)'}
              </span>
            )}
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Plantillas rápidas:</span>
          <button
            type="button"
            onClick={() => {
              setRemCategory('planificacion');
              setRemTitle('Entrega de planificación semanal (Guion de clases)');
              setRemAdvance(1440);
            }}
            className="min-h-[32px] px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#003366] border border-sky-200 text-[11px] font-semibold cursor-pointer"
          >
            + Entrega de planificación
          </button>
          <button
            type="button"
            onClick={() => {
              setRemCategory('cierre_notas');
              setRemTitle('Cierre de notas del periodo académico');
              setRemAdvance(2880);
            }}
            className="min-h-[32px] px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-semibold cursor-pointer"
          >
            + Cierre de notas
          </button>
        </div>

        {/* New reminder form */}
        <form
          onSubmit={(e) => void handleAddReminder(e)}
          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Tipo de alerta
              </label>
              <select
                value={remCategory}
                onChange={(e) => setRemCategory(e.target.value as ReminderCategory)}
                className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="planificacion">Entrega de planificación</option>
                <option value="cierre_notas">Cierre de notas</option>
                <option value="otro">Otro recordatorio docente</option>
              </select>
            </div>
            <div className="sm:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Título del recordatorio
              </label>
              <input
                type="text"
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                placeholder="Ej. Entrega de Guion de Clases — Periodo II"
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Fecha límite
              </label>
              <input
                type="date"
                value={remDate}
                onChange={(e) => setRemDate(e.target.value)}
                className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Hora límite
              </label>
              <input
                type="time"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Anticipación del aviso
              </label>
              <select
                value={remAdvance}
                onChange={(e) => setRemAdvance(Number(e.target.value))}
                className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
              >
                {REMINDER_ADVANCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nota adicional (opcional)
              </label>
              <input
                type="text"
                value={remNotes}
                onChange={(e) => setRemNotes(e.target.value)}
                placeholder="Ej. Entregar en Coordinación Académica o subir cuadros de notas"
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <button
              type="submit"
              className="min-h-[42px] px-4 rounded-xl bg-[#003366] hover:bg-[#00254a] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Programar alerta</span>
            </button>
          </div>
        </form>

        {remNotice && (
          <div
            className={`flex items-start gap-2 text-xs font-semibold rounded-xl px-4 py-2.5 border ${
              remNotice.type === 'success'
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-rose-800 bg-rose-50 border-rose-200'
            }`}
          >
            {remNotice.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{remNotice.text}</span>
          </div>
        )}

        {/* Scheduled reminders list */}
        <div className="space-y-2">
          {(draft.reminders || []).length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
              No tienes alertas programadas todavía. Usa las plantillas rápidas o crea tu primer recordatorio arriba.
            </div>
          ) : (
            (draft.reminders || []).map((rem) => {
              const isSent = Boolean(rem.notifiedAt);
              const badgeColor =
                rem.category === 'cierre_notas'
                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : rem.category === 'planificacion'
                  ? 'bg-sky-100 text-[#003366] border-sky-200'
                  : 'bg-slate-200 text-slate-700 border-slate-300';

              return (
                <div
                  key={rem.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    rem.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badgeColor}`}>
                        {REMINDER_CATEGORY_LABELS[rem.category]}
                      </span>
                      {isSent ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                          Notificada
                        </span>
                      ) : rem.enabled ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#003366] text-[10px] font-semibold">
                          Programada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-semibold">
                          Pausada
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate">{rem.title}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Límite: {formatDueDateSpanish(rem.dueDate, rem.dueTime)}
                      </span>
                      <span>· Aviso: {getAdvanceLabel(rem.advanceMinutes)}</span>
                    </div>
                    {rem.notes && <p className="text-[11px] text-slate-600">{rem.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSent && (
                      <button
                        type="button"
                        onClick={() => void handleResetReminder(rem.id)}
                        title="Reactivar recordatorio"
                        className="min-h-[36px] px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#003366] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reactivar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleToggleReminder(rem.id)}
                      className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        rem.enabled
                          ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                          : 'border-[#003366] bg-[#003366] text-white'
                      }`}
                    >
                      {rem.enabled ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteReminder(rem.id)}
                      aria-label="Eliminar recordatorio"
                      className="min-h-[36px] w-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 7. Cambio de PIN local */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <h3 className="text-sm font-bold text-[#003366] flex items-center gap-1.5">
          <KeyRound className="w-4 h-4" />
          <span>7. Seguridad — Cambiar PIN de Acceso (4 a 6 dígitos)</span>
        </h3>
        <form onSubmit={(e) => void handleChangePin(e)} className="flex flex-col sm:flex-row gap-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
            placeholder="PIN actual"
            className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Nuevo PIN (4-6 dígitos)"
            className="min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs font-mono"
          />
          <button
            type="submit"
            className="min-h-[42px] px-4 rounded-xl bg-[#003366] text-white text-xs font-bold cursor-pointer"
          >
            Actualizar PIN
          </button>
        </form>
        {pinMsg && <p className="text-xs font-semibold text-[#003366]">{pinMsg}</p>}
      </section>

      {/* 8. Respaldo y Restauración Local (IndexedDB JSON) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#003366] flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span>8. Respaldo de Seguridad Local (Exportar / Importar JSON)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Guarda una copia completa de tu configuración, historial de documentos, plantillas y normativa legal en un archivo JSON local, o restaura un respaldo previo en este dispositivo.
            </p>
          </div>
          {dbStats && (
            <div className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              En este dispositivo:{' '}
              <strong className="text-[#003366]">{dbStats.documents}</strong> docs ·{' '}
              <strong className="text-[#003366]">{dbStats.templates}</strong> plantillas ·{' '}
              <strong className="text-[#003366]">{dbStats.knowledgeBase}</strong> normativa
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => void handleExportBackup()}
            className="min-h-[44px] px-4 rounded-xl bg-[#003366] hover:bg-[#00254a] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{backupBusy ? 'Procesando...' : 'Exportar respaldo (.json)'}</span>
          </button>

          <label className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#003366] text-xs font-bold flex items-center gap-2 cursor-pointer">
            <FileUp className="w-4 h-4" />
            <span>Importar respaldo (.json)</span>
            <input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              disabled={backupBusy}
              onChange={(e) => void handleSelectBackupFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-[11px] text-slate-500">
          Por seguridad, tu PIN de acceso no se exporta en el archivo y se mantiene intacto al restaurar un respaldo.
        </p>

        {pendingImport && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900">
                  Respaldo listo para importar: {pendingImport.fileName}
                </div>
                <div className="text-[11px] text-slate-600">
                  Exportado el{' '}
                  {new Date(pendingImport.payload.exportedAt).toLocaleString('es-SV', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  · Contiene{' '}
                  <strong>{pendingImport.payload.stores.documents.length}</strong> documentos,{' '}
                  <strong>{pendingImport.payload.stores.templates.length}</strong> plantillas,{' '}
                  <strong>{pendingImport.payload.stores.knowledgeBase.length}</strong> archivos de normativa
                  {pendingImport.payload.stores.settings ? ' y configuración institucional.' : '.'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                  importMode === 'merge'
                    ? 'border-[#003366] bg-white shadow-xs'
                    : 'border-slate-200 bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-[#003366]">
                  <input
                    type="radio"
                    name="backup-import-mode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                  />
                  <span>Combinar (Recomendado)</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 pl-5">
                  Conserva tus registros actuales y agrega o actualiza los del respaldo.
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                  importMode === 'replace'
                    ? 'border-rose-500 bg-white shadow-xs'
                    : 'border-slate-200 bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-rose-700">
                  <input
                    type="radio"
                    name="backup-import-mode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  <span>Reemplazar todo</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 pl-5">
                  Sustituye el historial, plantillas y normativa actuales por los del respaldo.
                </p>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => void handleConfirmImport()}
                className={`min-h-[40px] px-4 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-60 ${
                  importMode === 'replace'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#003366] hover:bg-[#00254a]'
                }`}
              >
                {backupBusy ? 'Restaurando...' : 'Confirmar restauración'}
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => setPendingImport(null)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {backupNotice && (
          <div
            className={`flex items-start gap-2 text-xs font-semibold rounded-xl px-4 py-2.5 border ${
              backupNotice.type === 'success'
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-rose-800 bg-rose-50 border-rose-200'
            }`}
          >
            {backupNotice.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{backupNotice.text}</span>
          </div>
        )}
      </section>

      {/* 8. Licencia y Vigencia del Sistema (Administrador) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#003366] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#FFA92D]" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">
              Vigencia y Licencia de Uso (RENOVA NEXUS)
            </div>
            <div className="text-[11px] text-slate-500">
              Periodo de prueba (7 días), vigencia programable (meses/años) y licencia vitalicia permanente.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLicenseModal}
          className="min-h-[38px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#003366] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Lock className="w-3.5 h-3.5 text-[#FFA92D]" />
          <span>Gestionar Licencia</span>
        </button>
      </section>

      <TeacherPhotoModal
        open={showTeacherPhotoModal}
        currentPhoto={draft.userProfile?.photoUrl}
        currentName={draft.userProfile?.name}
        currentGender={draft.userProfile?.gender}
        onSave={(data) => {
          const nextUserProfile = {
            ...(draft.userProfile || { specialty: '', signatureDataUrl: '' }),
            photoUrl: data.photoUrl,
            name: data.name !== undefined ? data.name : (draft.userProfile?.name || ''),
            gender: data.gender || draft.userProfile?.gender || 'femenino',
          };
          const nextConfig = { ...draft, userProfile: nextUserProfile };
          setDraft(nextConfig);
          void saveSchoolConfig(nextConfig);
          onConfigUpdated(nextConfig);
        }}
        onClose={() => setShowTeacherPhotoModal(false)}
      />
    </div>
  );
};
