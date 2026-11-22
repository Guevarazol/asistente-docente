import React, { useEffect, useState } from 'react';
import { Delete, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { hashPin, saveSchoolConfig, verifyPin } from '../db/indexedDb';
import type { SchoolConfig } from '../types/casm';

interface PinLockScreenProps {
  config: SchoolConfig;
  onUnlocked: (updatedConfig: SchoolConfig) => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ config, onUnlocked }) => {
  const isFirstSetup = !config.pinHash;
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const appendDigit = (digit: string) => {
    setError('');
    setPin((prev) => (prev.length < 6 ? prev + digit : prev));
  };

  const removeDigit = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) {
      setError('El PIN debe tener entre 4 y 6 dígitos.');
      return;
    }

    setBusy(true);
    try {
      if (isFirstSetup) {
        if (step === 'enter') {
          setFirstPin(pin);
          setPin('');
          setStep('confirm');
        } else {
          if (pin !== firstPin) {
            setError('Los códigos PIN no coinciden. Intenta nuevamente.');
            setPin('');
            setFirstPin('');
            setStep('enter');
          } else {
            const { hash, salt } = await hashPin(pin);
            const updated: SchoolConfig = {
              ...config,
              pinHash: hash,
              pinSalt: salt,
            };
            await saveSchoolConfig(updated);
            onUnlocked(updated);
          }
        }
      } else {
        const ok = await verifyPin(pin, config);
        if (ok) {
          onUnlocked(config);
        } else {
          setError('PIN incorrecto. Verifica e intenta de nuevo.');
          setPin('');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        removeDigit();
      } else if (e.key === 'Enter' && pin.length >= 4) {
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="min-h-screen bg-[#003366] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80">
        {/* Top RENOVA + CASM Brand Header */}
        <div className="bg-[#003366] px-6 pt-6 pb-5 text-center border-b-4 border-[#FFA92D]">
          <div className="bg-white rounded-2xl px-3.5 py-2 shadow-md w-full max-w-[232px] h-24 mx-auto flex items-center justify-center mb-3.5">
            <img
              src={config.renovaLogo || '/assets/aistudio/Logo_largo_renova_5b497c22.png'}
              alt="Logo Corporación Médica Integral RENOVA"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              Asistente Docente
            </h1>
            <p className="text-[11px] font-medium text-sky-100 leading-snug mt-0.5">
              Corporación Médica Integral RENOVA
            </p>
            <p className="text-[10px] font-bold tracking-wider text-[#FFA92D] mt-0.5">
              RENOVA NEXUS
            </p>
          </div>
        </div>

        {/* PIN Body */}
        <div className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-[#003366] mb-1">
              {isFirstSetup ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {isFirstSetup
                ? step === 'enter'
                  ? 'Crea tu PIN de acceso local'
                  : 'Confirma tu PIN de acceso'
                : 'Acceso docente protegido'}
            </h2>
            <p className="text-xs text-slate-500">
              {isFirstSetup
                ? 'Ingresa de 4 a 6 dígitos para proteger tus documentos en este dispositivo.'
                : 'Ingresa tu PIN de 4 a 6 dígitos para abrir Asistente Docente.'}
            </p>
          </div>

          {/* PIN Dots Display */}
          <div className="flex items-center justify-center gap-2.5 py-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const filled = idx < pin.length;
              const requiredSlot = idx < 4;
              return (
                <div
                  key={idx}
                  className={`w-10 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                    filled
                      ? 'border-[#003366] bg-[#003366]/5'
                      : requiredSlot
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-dashed border-slate-200 bg-white'
                  }`}
                >
                  {filled && <span className="w-3 h-3 rounded-full bg-[#003366]" />}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="text-xs text-center font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Large Touch Keypad */}
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xl font-bold text-slate-900 transition cursor-pointer font-mono tabular-nums"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={removeDigit}
              disabled={pin.length === 0}
              aria-label="Borrar dígito"
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-40 flex items-center justify-center text-slate-700 transition cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => appendDigit('0')}
              className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xl font-bold text-slate-900 transition cursor-pointer font-mono tabular-nums"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={pin.length < 4 || busy}
              className="h-14 rounded-2xl bg-[#003366] hover:bg-[#00264d] active:scale-95 disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Entrar</span>
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400 pt-1">
            Datos guardados exclusivamente en tu dispositivo (IndexedDB).
          </p>
        </div>
      </div>
    </div>
  );
};
