import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  checkLicenseStatus,
  DEFAULT_LICENSE_CODE,
  getLicenseConfig,
  type LicenseUnit,
  setLicenseDuration,
  simulateImmediateExpiration,
  verifyLicenseCode,
} from '../utils/licenseManager';

interface HiddenLicenseModalProps {
  open: boolean;
  onClose: () => void;
  onLicenseUpdated: () => void;
}

export const HiddenLicenseModal: React.FC<HiddenLicenseModalProps> = ({
  open,
  onClose,
  onLicenseUpdated,
}) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // License duration controls
  const status = checkLicenseStatus();
  const [durationValue, setDurationValue] = useState<number>(status.config.durationValue || 30);
  const [durationUnit, setDurationUnit] = useState<LicenseUnit>(status.config.durationUnit || 'days');
  const [customCode, setCustomCode] = useState<string>(status.config.licenseCode || DEFAULT_LICENSE_CODE);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-slate-900 space-y-5 border border-slate-200">
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
                Temporizador de Licencia de Uso
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
          /* Step 1: Admin Authentication */
          <form onSubmit={handleAdminLogin} className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Panel de Control Restringido:</strong>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Introduce el código maestro de administrador para programar el temporizador de licencia.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código de Administrador (PIN):
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
                  placeholder="Introduce el código (ej. 1978)..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono tracking-widest bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                />
              </div>
              {pinError && (
                <p className="text-xs font-semibold text-rose-600 mt-1.5">
                  {pinError}
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
                className="px-5 py-2 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Acceder al Panel
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: License Management Controls */
          <div className="space-y-4">
            {/* Live Status Card */}
            <div className={`p-4 rounded-2xl border space-y-2.5 ${
              status.isExpired
                ? 'bg-rose-50 border-rose-200'
                : status.isLifetime
                ? 'bg-amber-50/90 border-amber-300'
                : status.isTrial
                ? 'bg-sky-50 border-sky-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between gap-2 border-b pb-2.5 border-black/5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    status.isExpired
                      ? 'bg-rose-100 text-rose-700'
                      : status.isLifetime
                      ? 'bg-amber-100 text-amber-800'
                      : status.isTrial
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {status.isExpired ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : status.isLifetime ? (
                      <Sparkles className="w-5 h-5 text-amber-600" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Estado de la Licencia
                    </div>
                    <div className={`text-sm font-black tracking-tight ${
                      status.isExpired
                        ? 'text-rose-700'
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
                  Código de Desbloqueo / Licencia (actual: {customCode || DEFAULT_LICENSE_CODE}):
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
              {/* Test Button for Admin */}
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
      </div>
    </div>
  );
};
