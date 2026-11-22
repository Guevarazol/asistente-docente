import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  type LicenseUnit,
  setLicenseDuration,
  verifyLicenseCode,
} from '../utils/licenseManager';

interface LicenseLockScreenProps {
  expiresAtFormatted: string;
  onUnlocked: () => void;
  onOpenAdminPanel?: () => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  expiresAtFormatted,
  onUnlocked,
  onOpenAdminPanel,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [extending, setExtending] = useState(false);

  // Renewal duration state once unlocked
  const [durationValue, setDurationValue] = useState<number>(30);
  const [durationUnit, setDurationUnit] = useState<LicenseUnit>('days');

  // Secret click counter on logo to open admin panel
  const [secretClicks, setSecretClicks] = useState(0);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verifyLicenseCode(code)) {
      setSuccess(true);
      setExtending(true);
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

  return (
    <div className="fixed inset-0 z-50 bg-[#001f3f] text-white flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={handleLogoClick}
            className="w-16 h-16 rounded-2xl bg-[#003366] text-[#FFA92D] flex items-center justify-center shadow-md mb-3 cursor-pointer hover:scale-105 transition"
            title="Asistente Docente · RENOVA NEXUS"
          >
            <ShieldAlert className="w-8 h-8 text-[#FFA92D]" />
          </button>
          <div className="text-[11px] font-black uppercase tracking-wider text-[#FFA92D]">
            RENOVA NEXUS · Licencia Oficial
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight mt-1">
            {extending ? 'Reactivar Licencia de Uso' : 'Licencia de Uso Vencida'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Corporación Médica Integral RENOVA
          </p>
        </div>

        {!extending ? (
          <>
            {/* Expiration Notice */}
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

            {/* Input Form */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Código de Activación / Licencia:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoFocus
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(null);
                    }}
                    placeholder="Introduce el código de licencia..."
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
                <span>Desbloquear y Reactivar</span>
              </button>
            </form>
          </>
        ) : (
          /* Extension / Renewal Form */
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

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[
                  { label: 'Prueba (7d)', val: 7, u: 'days' as LicenseUnit, highlight: 'sky' },
                  { label: '30 Días', val: 30, u: 'days' as LicenseUnit },
                  { label: '3 Meses', val: 3, u: 'months' as LicenseUnit },
                  { label: '6 Meses', val: 6, u: 'months' as LicenseUnit },
                  { label: '1 Año', val: 1, u: 'years' as LicenseUnit },
                  { label: '🌟 Vitalicia', val: 1, u: 'lifetime' as LicenseUnit, highlight: 'gold' },
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
                      className={`h-9 px-2 rounded-xl border transition cursor-pointer flex items-center justify-center text-center ${
                        isSelected
                          ? 'bg-[#003366] text-white border-[#003366] shadow-xs'
                          : p.highlight === 'gold'
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          : p.highlight === 'sky'
                          ? 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleConfirmRenewal}
                className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer mt-2"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Aplicar Renovación y Desbloquear</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Support Info */}
        <div className="pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
          <div>© 2026 Corporación Médica Integral RENOVA</div>
          <div className="text-[10px] text-slate-400/80 mt-0.5">
            Soporte y Activaciones: RENOVA NEXUS
          </div>
        </div>
      </div>
    </div>
  );
};
