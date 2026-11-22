import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  ExternalLink,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  MessageCircle,
  Monitor,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Usb,
} from 'lucide-react';
import {
  activateDeviceSlot,
  activatePortableUsbMode,
  type DeviceBindingState,
  type DeviceSlot,
  getDeviceBindingState,
  getMachineId,
  type LicenseUnit,
  setLicenseDuration,
  SUPPORT_CEO,
  SUPPORT_PHONE,
  SUPPORT_PHONE_FULL,
  verifyLicenseCode,
} from '../utils/licenseManager';

interface LicenseLockScreenProps {
  expiresAtFormatted: string;
  isExpired: boolean;
  deviceBinding: DeviceBindingState;
  onUnlocked: () => void;
  onOpenAdminPanel?: () => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  expiresAtFormatted,
  isExpired,
  deviceBinding,
  onUnlocked,
  onOpenAdminPanel,
}) => {
  const machineId = deviceBinding.machineId || getMachineId();
  const isDeviceBlocked = !deviceBinding.isAuthorized && !deviceBinding.isPortableUsbMode;

  const [selectedSlot, setSelectedSlot] = useState<DeviceSlot>('slot_1');
  const [isUsbModeSelected, setIsUsbModeSelected] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Expiration renewal state
  const [renewalCode, setRenewalCode] = useState('');
  const [extending, setExtending] = useState(false);
  const [durationValue, setDurationValue] = useState<number>(30);
  const [durationUnit, setDurationUnit] = useState<LicenseUnit>('days');

  // Secret clicks to open admin panel
  const [secretClicks, setSecretClicks] = useState(0);

  const handleCopyId = () => {
    navigator.clipboard.writeText(machineId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleDeviceActivation = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isUsbModeSelected) {
      const res = activatePortableUsbMode(activationCode);
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => onUnlocked(), 1200);
      } else {
        setError(res.message);
      }
      return;
    }

    const res = activateDeviceSlot(selectedSlot, activationCode);
    if (res.success) {
      setSuccessMessage(res.message);
      setTimeout(() => onUnlocked(), 1200);
    } else {
      setError(res.message);
    }
  };

  const handleExpirationUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verifyLicenseCode(renewalCode)) {
      setExtending(true);
      setError(null);
    } else {
      setError('Código de licencia incorrecto. Contacta al administrador para renovar.');
    }
  };

  const handleConfirmRenewal = () => {
    setLicenseDuration(durationValue, durationUnit);
    onUnlocked();
  };

  const handleLogoClick = () => {
    const next = secretClicks + 1;
    if (next >= 5) {
      setSecretClicks(0);
      onOpenAdminPanel?.();
    } else {
      setSecretClicks(next);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hola Dr. Oscar Alexander Guevara, solicito la Clave de Activación para vincular mi equipo al Asistente Docente:\n\n• ID de Equipo: ${machineId}\n• Slot Solicitado: ${selectedSlot === 'slot_1' ? 'Equipo 1 (Principal)' : 'Equipo 2 (Secundario)'}`
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#001f3f] text-white flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Institucional */}
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={handleLogoClick}
            className="w-16 h-16 rounded-2xl bg-[#003366] text-[#FFA92D] flex items-center justify-center shadow-md mb-3 cursor-pointer hover:scale-105 transition"
            title="RENOVA NEXUS · Haz 5 clics para el Panel de Administrador"
          >
            {isDeviceBlocked ? (
              <Laptop className="w-8 h-8 text-[#FFA92D]" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-[#FFA92D]" />
            )}
          </button>
          <div className="text-[11px] font-black uppercase tracking-wider text-[#FFA92D]">
            RENOVA NEXUS · Sistema de Protección Institucional
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight mt-1">
            {isDeviceBlocked
              ? 'Vinculación de Equipo Requerida'
              : extending
              ? 'Reactivar Licencia de Uso'
              : 'Licencia de Uso Vencida'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Corporación Médica Integral RENOVA · Licencia para 2 Ordenadores
          </p>
        </div>

        {/* CASO 1: VINCULACIÓN DE EQUIPO (MÁXIMO 2 COMPUTADORAS O MODO USB) */}
        {isDeviceBlocked ? (
          <div className="space-y-4">
            {/* Banner Informativo */}
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sky-900">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Política de Licencia: Hasta 2 Equipos Autorizados</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11.5px]">
                Esta copia está configurada para vincularse exclusivamente a un máximo de <strong>2 ordenadores personales</strong> (ejemplo: PC de Aula y Laptop del Hogar), o ejecutarse de forma portátil directamente desde la memoria USB.
              </p>
            </div>

            {/* Tarjeta de Identificador Único de Hardware (Machine ID) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#003366]" />
                  ID de Este Equipo (Hardware Token):
                </span>
                <span className="text-[10px] font-semibold text-slate-400">Identificador Único</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm sm:text-base font-bold text-[#003366] bg-white px-3 py-2 rounded-xl border border-slate-200 tracking-wider">
                  {machineId}
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Copiar ID"
                >
                  {copiedId ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Selector de Slot de Vinculación */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Seleccione el Destino de Vinculación:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlot('slot_1');
                    setIsUsbModeSelected(false);
                  }}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    !isUsbModeSelected && selectedSlot === 'slot_1'
                      ? 'border-[#003366] bg-blue-50/70 ring-2 ring-[#003366]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Monitor className="w-4 h-4 text-[#003366]" />
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#003366]/10 text-[#003366]">
                      Slot 1
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-900">Equipo 1</div>
                  <div className="text-[10px] text-slate-500">Computadora de Aula / Principal</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlot('slot_2');
                    setIsUsbModeSelected(false);
                  }}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    !isUsbModeSelected && selectedSlot === 'slot_2'
                      ? 'border-[#003366] bg-blue-50/70 ring-2 ring-[#003366]/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Laptop className="w-4 h-4 text-[#003366]" />
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#FFA92D]/20 text-[#b36d00]">
                      Slot 2
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-900">Equipo 2</div>
                  <div className="text-[10px] text-slate-500">Laptop / Computadora del Hogar</div>
                </button>
              </div>

              {/* Opción adicional: Modo Portátil USB */}
              <button
                type="button"
                onClick={() => setIsUsbModeSelected(!isUsbModeSelected)}
                className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  isUsbModeSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-dashed border-slate-300 hover:border-slate-400 text-slate-600 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Usb className={`w-4 h-4 ${isUsbModeSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold">Ejecutar en Modo Portátil desde la USB</span>
                    <span className="block text-[10px] text-slate-500">Uso directo desde la memoria USB sin vincular a esta computadora</span>
                  </div>
                </div>
                {isUsbModeSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              </button>
            </div>

            {/* Formulario de Activación */}
            <form onSubmit={handleDeviceActivation} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isUsbModeSelected
                    ? 'Código de Desbloqueo Portátil (o PIN Maestro):'
                    : `Clave de Activación para ${selectedSlot === 'slot_1' ? 'Equipo 1' : 'Equipo 2'}:`}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={activationCode}
                    onChange={(e) => {
                      setActivationCode(e.target.value);
                      setError(null);
                    }}
                    placeholder={isUsbModeSelected ? 'Código portátil...' : 'RNX-XXXX-YYYY o código maestro...'}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono tracking-wider bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] uppercase"
                  />
                </div>
                {error && (
                  <p className="text-xs font-semibold text-rose-600 mt-2 flex items-start gap-1">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </p>
                )}
                {successMessage && (
                  <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMessage}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] rounded-xl bg-[#003366] hover:bg-[#002244] active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#FFA92D]" />
                <span>
                  {isUsbModeSelected
                    ? 'Desbloquear y Ejecutar Modo Portátil'
                    : `Vincular y Activar Este Equipo (${selectedSlot === 'slot_1' ? '1 de 2' : '2 de 2'})`}
                </span>
              </button>
            </form>

            {/* Enlace de Solicitud vía WhatsApp al Dr. Oscar Alexander Guevara */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <div className="text-[11px] text-center sm:text-left">
                ¿Aún no tienes tu clave de activación?
              </div>
              <a
                href={`https://wa.me/503${SUPPORT_PHONE}?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Pedir clave a {SUPPORT_CEO}</span>
              </a>
            </div>
          </div>
        ) : !extending ? (
          /* CASO 2: LICENCIA VENCIDA (TEMPORIZADOR EXPIRADO) */
          <>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>El periodo de vigencia ha finalizado</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                El temporizador de licencia configurado para esta instalación expiró el:{' '}
                <strong className="text-slate-800">{expiresAtFormatted}</strong>.
              </p>
              <p className="text-slate-500 text-[11px]">
                Para reactivar el acceso y continuar utilizando la plataforma, introduzca el código de licencia proporcionado por su administrador.
              </p>
            </div>

            <form onSubmit={handleExpirationUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Código de Renovación / PIN Maestro:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    value={renewalCode}
                    onChange={(e) => {
                      setRenewalCode(e.target.value);
                      setError(null);
                    }}
                    placeholder="Introduce el código..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-mono tracking-widest bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                  />
                </div>
                {error && (
                  <p className="text-xs font-semibold text-rose-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] rounded-xl bg-[#003366] hover:bg-[#002244] active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#FFA92D]" />
                <span>Desbloquear y Renovar</span>
              </button>
            </form>
          </>
        ) : (
          /* CASO 3: EXTENSIÓN / RENOVACIÓN TRAS DESBLOQUEO EXITOSO */
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-emerald-800">¡Código verificado con éxito!</div>
                <div className="text-[11px] text-emerald-700">Selecciona el nuevo periodo de licencia a otorgar:</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva Vigencia:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="1"
                    max="999"
                    disabled={durationUnit === 'lifetime'}
                    value={durationUnit === 'lifetime' ? 1 : durationValue}
                    onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
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

              {/* Presets Rápidos */}
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[
                  { label: 'Prueba (7d)', val: 7, u: 'days' as LicenseUnit },
                  { label: '30 Días', val: 30, u: 'days' as LicenseUnit },
                  { label: '3 Meses', val: 3, u: 'months' as LicenseUnit },
                  { label: '6 Meses', val: 6, u: 'months' as LicenseUnit },
                  { label: '1 Año', val: 1, u: 'years' as LicenseUnit },
                  { label: '🌟 Vitalicia', val: 1, u: 'lifetime' as LicenseUnit },
                ].map((p) => {
                  const isSelected = (p.u === 'lifetime' && durationUnit === 'lifetime') ||
                    (durationValue === p.val && durationUnit === p.u);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setDurationValue(p.val);
                        setDurationUnit(p.u);
                      }}
                      className={`h-9 px-2 rounded-xl border text-center transition cursor-pointer flex items-center justify-center text-xs font-bold ${
                        isSelected
                          ? 'border-[#003366] bg-[#003366] text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmRenewal}
              className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Nueva Vigencia y Continuar</span>
            </button>
          </div>
        )}

        {/* Footer Institucional con Contacto del CEO */}
        <div className="pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400 space-y-1">
          <div>
            Soporte Oficial: <strong>{SUPPORT_CEO}</strong> (CEO Corporación Médica Integral)
          </div>
          <div>
            Teléfono Directo / WhatsApp: <strong>{SUPPORT_PHONE_FULL}</strong> · San Miguel, El Salvador
          </div>
        </div>

      </div>
    </div>
  );
};
