import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Delete,
  KeyRound,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import type { SchoolConfig } from '../types/casm';
import { verifyPin } from '../db/indexedDb';
import { DEFAULT_LICENSE_CODE, getLicenseConfig } from '../utils/licenseManager';

interface ModuleUnlockModalProps {
  open: boolean;
  config: SchoolConfig;
  moduleName?: string;
  onUnlocked: () => void;
  onClose: () => void;
}

export const ModuleUnlockModal: React.FC<ModuleUnlockModalProps> = ({
  open,
  config,
  moduleName,
  onUnlocked,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleVerify = async (inputCode: string) => {
    const clean = inputCode.trim();
    if (!clean) {
      setError('Por favor introduce tu código de entrada o PIN.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // 1. Check against Master / License code (1978 or custom licenseCode)
      const licenseCfg = getLicenseConfig();
      const isMasterCode = clean === DEFAULT_LICENSE_CODE || clean === licenseCfg.licenseCode.trim();

      // 2. Check against Personal Teacher PIN hash (if configured)
      let isTeacherPin = false;
      if (config.pinHash && config.pinSalt) {
        isTeacherPin = await verifyPin(clean, config);
      }

      if (isMasterCode || isTeacherPin) {
        setBusy(false);
        setPin('');
        onUnlocked();
      } else {
        setBusy(false);
        setError('Código o PIN incorrecto. Los campos permanecen bloqueados para proteger los datos.');
      }
    } catch (e) {
      console.error('Error al verificar PIN de módulo:', e);
      setBusy(false);
      setError('Ocurrió un error al verificar el código.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleVerify(pin);
  };

  const appendDigit = (digit: string) => {
    setError(null);
    if (pin.length < 8) {
      const next = pin + digit;
      setPin(next);
      // Auto submit if 4 digits and matches master code
      if (next === DEFAULT_LICENSE_CODE) {
        void handleVerify(next);
      }
    }
  };

  const removeDigit = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-900 space-y-5 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#003366] text-[#FFA92D] flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-[#FFA92D]" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-[#FFA92D]">
                Seguridad contra Modificaciones
              </div>
              <h2 className="text-base font-extrabold text-[#003366]">
                Desbloquear para Seguir Editando
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

        {/* Notice */}
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-950">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Datos Protegidos {moduleName ? `en ${moduleName}` : ''}</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Introduce tu código de entrada (PIN personal o código maestro <strong>1978</strong>) para reactivar la edición y poder modificar o añadir información.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
              Código de Acceso / PIN:
            </label>
            <div className="relative max-w-[240px] mx-auto">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="PIN o 1978..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-center text-lg font-mono tracking-widest bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>
          </div>

          {/* Numeric Keypad for Mobile / Touch screens */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-base font-bold transition cursor-pointer flex items-center justify-center"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError(null);
              }}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center cursor-pointer"
              title="Borrar todo"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => appendDigit('0')}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-base font-bold transition cursor-pointer flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={removeDigit}
              className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              title="Borrar dígito"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-semibold text-center flex items-center justify-center gap-1 animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Mantener Bloqueado
            </button>
            <button
              type="submit"
              disabled={busy || !pin.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition"
            >
              <Unlock className="w-4 h-4 text-[#FFA92D]" />
              <span>{busy ? 'Verificando...' : 'Desbloquear'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
