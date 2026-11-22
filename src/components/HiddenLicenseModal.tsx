import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  KeyRound,
  Laptop,
  Lock,
  MessageCircle,
  Monitor,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Usb,
  X,
} from 'lucide-react';
import {
  checkLicenseStatus,
  DEFAULT_LICENSE_CODE,
  type DeviceSlot,
  generateActivationKeyForMachine,
  getDeviceBindingState,
  getLicenseConfig,
  getMachineId,
  type LicenseUnit,
  resetAllDeviceSlots,
  saveDeviceBindingState,
  setLicenseDuration,
  simulateImmediateExpiration,
  SUPPORT_CEO,
  SUPPORT_PHONE,
  SUPPORT_PHONE_FULL,
  unbindCurrentDevice,
  verifyLicenseCode,
} from '../utils/licenseManager';

interface HiddenLicenseModalProps {
  open: boolean;
  onClose: () => void;
  onLicenseUpdated: () => void;
}

type AdminTab = 'vigencia' | 'equipos' | 'generador';

export const HiddenLicenseModal: React.FC<HiddenLicenseModalProps> = ({
  open,
  onClose,
  onLicenseUpdated,
}) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('vigencia');

  // License duration controls
  const status = checkLicenseStatus();
  const [durationValue, setDurationValue] = useState<number>(status.config.durationValue || 30);
  const [durationUnit, setDurationUnit] = useState<LicenseUnit>(status.config.durationUnit || 'days');
  const [customCode, setCustomCode] = useState<string>(status.config.licenseCode || DEFAULT_LICENSE_CODE);

  // Device binding controls
  const [deviceState, setDeviceState] = useState(getDeviceBindingState());
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  // Key generator state
  const [genMachineId, setGenMachineId] = useState('');
  const [genSlot, setGenSlot] = useState<DeviceSlot>('slot_1');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);

  if (!open) return null;

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyLicenseCode(adminPin)) {
      setAuthenticated(true);
      setPinError(null);
    } else {
      setPinError('Código de administrador incorrecto.');
    }
  };

  const handleApplyDuration = () => {
    setLicenseDuration(durationValue, durationUnit, customCode);
    if (durationUnit === 'lifetime') {
      setNotice('¡Licencia VITALICIA activada con éxito! Acceso permanente sin fecha de expiración.');
    } else {
      setNotice(`Licencia actualizada con éxito para ${durationValue} ${durationUnit === 'days' ? 'días' : durationUnit === 'months' ? 'meses' : 'años'}.`);
    }
    onLicenseUpdated();
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSimulateExpiration = () => {
    simulateImmediateExpiration();
    onLicenseUpdated();
    onClose();
  };

  const handleUnbindCurrent = () => {
    const updated = unbindCurrentDevice();
    setDeviceState(updated);
    setDeviceNotice('Este equipo ha sido desvinculado. El cupo ha sido liberado.');
    onLicenseUpdated();
    setTimeout(() => setDeviceNotice(null), 3000);
  };

  const handleResetAllSlots = () => {
    if (window.confirm('¿Está seguro de que desea resetear todos los cupos de equipos? Esto requerirá volver a activar los ordenadores.')) {
      const reset = resetAllDeviceSlots();
      setDeviceState(reset);
      setDeviceNotice('Todos los cupos de equipos han sido reseteados.');
      onLicenseUpdated();
      setTimeout(() => setDeviceNotice(null), 3000);
    }
  };

  const handleToggleUsbMode = () => {
    const nextState = !deviceState.isPortableUsbMode;
    const updated = {
      ...deviceState,
      isPortableUsbMode: nextState,
      isAuthorized: nextState ? true : deviceState.isAuthorized,
    };
    saveDeviceBindingState(updated);
    setDeviceState(updated);
    setDeviceNotice(nextState ? 'Modo Portátil USB Habilitado.' : 'Modo Portátil USB Deshabilitado.');
    onLicenseUpdated();
    setTimeout(() => setDeviceNotice(null), 3000);
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genMachineId.trim()) return;
    const key = generateActivationKeyForMachine(genMachineId, genSlot);
    setGeneratedKey(key);
  };

  const handleCopyGeneratedKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 space-y-5 border border-slate-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#003366] text-[#FFA92D] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#FFA92D]" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-[#FFA92D]">
                Administración RENOVA NEXUS
              </div>
              <h2 className="text-base font-extrabold text-[#003366]">
                Gestor de Licencias y Equipos
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!authenticated ? (
          /* Paso 1: Autenticación de Administrador */
          <form onSubmit={handleAdminLogin} className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Panel de Control Restringido:</strong>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Introduce el código maestro de administrador para programar el temporizador de licencia, gestionar equipos y generar claves.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                PIN Maestro de Administrador:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoFocus
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value);
                    setPinError(null);
                  }}
                  placeholder="Código maestro..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tracking-widest bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                />
              </div>
              {pinError && (
                <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-[#FFA92D]" />
                <span>Acceder como Administrador</span>
              </button>
            </div>
          </form>
        ) : (
          /* Paso 2: Panel de Control Multi-Pestaña */
          <div className="space-y-4">
            
            {/* Navegación por pestañas */}
            <div className="flex border-b border-slate-200 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('vigencia')}
                className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                  activeTab === 'vigencia'
                    ? 'border-[#003366] text-[#003366]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="w-4 h-4 text-[#FFA92D]" />
                <span>Vigencia y Tiempo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('equipos')}
                className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                  activeTab === 'equipos'
                    ? 'border-[#003366] text-[#003366]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Laptop className="w-4 h-4 text-[#003366]" />
                <span>Equipos y USB ({deviceState.assignedSlot ? '1/2' : '0/2'})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('generador')}
                className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                  activeTab === 'generador'
                    ? 'border-[#003366] text-[#003366]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>Generador de Claves</span>
              </button>
            </div>

            {/* PESTAÑA 1: VIGENCIA Y TIEMPO */}
            {activeTab === 'vigencia' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                {/* Live Status Card */}
                <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
                  status.isExpired
                    ? 'bg-rose-50 border-rose-200'
                    : status.isLifetime
                    ? 'bg-amber-50/80 border-amber-300'
                    : status.isTrial
                    ? 'bg-sky-50 border-sky-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        status.isExpired
                          ? 'bg-rose-200 text-rose-800'
                          : status.isLifetime
                          ? 'bg-amber-200 text-amber-900'
                          : status.isTrial
                          ? 'bg-sky-200 text-sky-800'
                          : 'bg-emerald-200 text-emerald-800'
                      }`}>
                        {status.isExpired ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : status.isLifetime ? (
                          <Sparkles className="w-4 h-4 text-amber-700" />
                        ) : status.isTrial ? (
                          <Calendar className="w-4 h-4 text-sky-700" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Estado Actual de la Licencia
                        </span>
                        <div className={`text-xs font-black ${
                          status.isExpired
                            ? 'text-rose-900'
                            : status.isLifetime
                            ? 'text-amber-900'
                            : status.isTrial
                            ? 'text-sky-800'
                            : 'text-emerald-800'
                        }`}>
                          {status.isExpired
                            ? '🔴 LICENCIA VENCIDA (Bloqueada)'
                            : status.isLifetime
                            ? '🌟 LICENCIA VITALICIA ACTIVA'
                            : status.isTrial
                            ? '⏳ PERIODO DE PRUEBA (7 DÍAS)'
                            : '🟢 LICENCIA ACTIVA'}
                        </div>
                      </div>
                    </div>

                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
                      status.isExpired
                        ? 'bg-rose-200 text-rose-900'
                        : status.isLifetime
                        ? 'bg-amber-200/90 text-amber-950'
                        : status.isTrial
                        ? 'bg-sky-200 text-sky-950'
                        : 'bg-emerald-200 text-emerald-950'
                    }`}>
                      {status.isExpired
                        ? 'Expirada'
                        : status.isLifetime
                        ? 'Permanente'
                        : `${status.daysRemaining}d ${status.hoursRemaining}h`}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 pt-0.5">
                    <span className="text-slate-500">{status.isLifetime ? 'Condición de uso:' : 'Fecha de vencimiento:'}</span>
                    <strong className={`font-bold ${status.isLifetime ? 'text-amber-900' : 'text-slate-800'}`}>
                      {status.isLifetime ? 'Permanente · Sin fecha de vencimiento' : status.formattedExpiresAt}
                    </strong>
                  </div>
                </div>

                {/* Duration Selector Form */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#FFA92D]" />
                      <span>Programar Vigencia de Licencia:</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      A partir del momento de guardar
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Cantidad:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        disabled={durationUnit === 'lifetime'}
                        value={durationUnit === 'lifetime' ? 1 : durationValue}
                        onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Modalidad / Unidad:
                      </label>
                      <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as LicenseUnit)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="days">Días</option>
                        <option value="months">Meses</option>
                        <option value="years">Años</option>
                        <option value="lifetime">🌟 Vitalicia (Permanente)</option>
                      </select>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Atajos rápidos:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                      {[
                        { label: 'Prueba (7d)', val: 7, u: 'days' as LicenseUnit, highlight: 'sky' },
                        { label: '15 Días', val: 15, u: 'days' as LicenseUnit },
                        { label: '30 Días', val: 30, u: 'days' as LicenseUnit },
                        { label: '3 Meses', val: 3, u: 'months' as LicenseUnit },
                        { label: '6 Meses', val: 6, u: 'months' as LicenseUnit },
                        { label: '1 Año', val: 1, u: 'years' as LicenseUnit },
                        { label: '2 Años', val: 2, u: 'years' as LicenseUnit },
                        { label: '🌟 Vitalicia', val: 1, u: 'lifetime' as LicenseUnit, highlight: 'gold' },
                      ].map((preset) => {
                        const isSelected = (preset.u === 'lifetime' && durationUnit === 'lifetime') ||
                          (durationValue === preset.val && durationUnit === preset.u);
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setDurationValue(preset.val);
                              setDurationUnit(preset.u);
                            }}
                            className={`h-9 px-1 rounded-xl border transition cursor-pointer flex items-center justify-center text-center truncate ${
                              isSelected
                                ? 'bg-[#003366] text-white border-[#003366] shadow-xs'
                                : preset.highlight === 'gold'
                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                : preset.highlight === 'sky'
                                ? 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate">{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Master Unlock Code Config */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código de Desbloqueo Maestro (actual: {customCode || DEFAULT_LICENSE_CODE}):
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        placeholder="Código de desbloqueo (ej. 1978)..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold tracking-wider bg-white"
                      />
                    </div>
                  </div>
                </div>

                {notice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleSimulateExpiration}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer py-1"
                    title="Pone la fecha de vencimiento en el pasado para probar la pantalla de bloqueo y desbloquearla con 1978"
                  >
                    🧪 Simular Vencimiento Inmediato
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyDuration}
                      className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FFA92D]" />
                      <span>Guardar y Aplicar</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 2: EQUIPOS Y USB */}
            {activeTab === 'equipos' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-[#003366]" />
                      <span>Hardware Token de Este Dispositivo:</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {deviceState.machineId}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center justify-between pt-1">
                    <span>Estado en este equipo:</span>
                    <strong className={`font-bold ${
                      deviceState.isAuthorized
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}>
                      {deviceState.isAuthorized
                        ? deviceState.isPortableUsbMode
                          ? '🌟 Modo Portátil USB Habilitado'
                          : `🟢 Autorizado como ${deviceState.assignedSlot === 'slot_1' ? 'Equipo 1' : 'Equipo 2'}`
                        : '🟡 Pendiente de Vinculación'}
                    </strong>
                  </div>
                </div>

                {/* Slots de Equipos Autorizados (Máximo 2) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Cupos de Equipos Autorizados (Máximo 2):</span>
                    <span className="text-[11px] text-slate-500 font-normal">Licencia por Docente</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Slot 1 */}
                    <div className={`p-3.5 rounded-2xl border ${
                      deviceState.assignedSlot === 'slot_1'
                        ? 'bg-blue-50/70 border-[#003366]'
                        : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Monitor className="w-4 h-4 text-[#003366]" />
                          <span>Equipo 1 (Principal)</span>
                        </div>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          deviceState.assignedSlot === 'slot_1'
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {deviceState.assignedSlot === 'slot_1' ? 'Este PC' : 'Disponible'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Computadora de Aula o Computadora de Escritorio.
                      </p>
                    </div>

                    {/* Slot 2 */}
                    <div className={`p-3.5 rounded-2xl border ${
                      deviceState.assignedSlot === 'slot_2'
                        ? 'bg-blue-50/70 border-[#003366]'
                        : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Laptop className="w-4 h-4 text-[#003366]" />
                          <span>Equipo 2 (Secundario)</span>
                        </div>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          deviceState.assignedSlot === 'slot_2'
                            ? 'bg-[#003366] text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {deviceState.assignedSlot === 'slot_2' ? 'Este PC' : 'Disponible'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Laptop personal o Computadora del Hogar.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Modo Portátil USB Switch */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Usb className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        Modo Portátil USB
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Permite ejecutar directamente desde la memoria USB sin fijarse a ningún slot.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleUsbMode}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      deviceState.isPortableUsbMode
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {deviceState.isPortableUsbMode ? 'Activo' : 'Inactivo'}
                  </button>
                </div>

                {deviceNotice && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{deviceNotice}</span>
                  </div>
                )}

                {/* Acciones de Desvinculación */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={handleUnbindCurrent}
                    disabled={!deviceState.assignedSlot}
                    className="text-rose-600 hover:text-rose-800 font-bold hover:underline disabled:text-slate-300 disabled:no-underline cursor-pointer"
                  >
                    Liberar cupo de este equipo
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAllSlots}
                    className="text-slate-500 hover:text-slate-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Resetear todos los cupos</span>
                  </button>
                </div>
              </div>
            )}

            {/* PESTAÑA 3: GENERADOR DE CLAVES (PARA CLIENTES) */}
            {activeTab === 'generador' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    <span>Generador Maestro de Claves de Activación</span>
                  </div>
                  <p className="text-[11.5px] text-amber-800 leading-relaxed">
                    Cuando un docente o colegio le envíe su <strong>ID de Equipo (Machine ID)</strong> por WhatsApp, péguelo aquí y seleccione si es para el <strong>Equipo 1</strong> o <strong>Equipo 2</strong> para expedir su clave criptográfica de activación.
                  </p>
                </div>

                <form onSubmit={handleGenerateKey} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ID del Equipo del Cliente (ej. RNX-PC-9A1F-38C2):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={genMachineId}
                        onChange={(e) => {
                          setGenMachineId(e.target.value.toUpperCase());
                          setGeneratedKey(null);
                        }}
                        placeholder="Pegar ID de equipo aquí..."
                        className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold tracking-wider uppercase bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setGenMachineId(deviceState.machineId);
                          setGeneratedKey(null);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                        title="Usar ID de esta máquina"
                      >
                        Este PC
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cupo a Otorgar:
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setGenSlot('slot_1');
                          setGeneratedKey(null);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          genSlot === 'slot_1'
                            ? 'bg-[#003366] text-white border-[#003366]'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Equipo 1 (Principal)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGenSlot('slot_2');
                          setGeneratedKey(null);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          genSlot === 'slot_2'
                            ? 'bg-[#003366] text-white border-[#003366]'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Equipo 2 (Secundario)
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!genMachineId.trim()}
                    className="w-full min-h-[42px] rounded-xl bg-[#003366] hover:bg-[#002244] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-[#FFA92D]" />
                    <span>Calcular Clave de Activación</span>
                  </button>
                </form>

                {generatedKey && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2.5 animate-in fade-in duration-150">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                      Clave Generada para {genSlot === 'slot_1' ? 'Equipo 1' : 'Equipo 2'}:
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 font-mono text-base font-black text-emerald-900 bg-white px-3 py-2 rounded-xl border border-emerald-300 tracking-widest text-center">
                        {generatedKey}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyGeneratedKey}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedKey ? 'Copiada' : 'Copiar'}</span>
                      </button>
                    </div>

                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Estimado docente, aquí tiene su Clave de Activación oficial para Asistente Docente (RENOVA NEXUS):\n\n• Equipo: ${genSlot === 'slot_1' ? 'Equipo 1 (Principal)' : 'Equipo 2 (Secundario)'}\n• ID Registrado: ${genMachineId}\n• Clave de Activación: ${generatedKey}\n\nAtentamente,\nDr. Oscar Alexander Guevara\nCEO Corporación Médica Integral`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Compartir Clave por WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
