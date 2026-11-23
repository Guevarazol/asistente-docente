import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Timer,
} from 'lucide-react';

interface ModuleLockBannerProps {
  isLocked: boolean;
  moduleName: string;
  onLock: () => void;
  onUnlockRequest: () => void;
  autoLockMinutes?: number;
}

export const ModuleLockBanner: React.FC<ModuleLockBannerProps> = ({
  isLocked,
  moduleName,
  onLock,
  onUnlockRequest,
  autoLockMinutes = 5,
}) => {
  return (
    <div className="no-print space-y-2">
      {isLocked ? (
        /* BANNER CUANDO ESTÁ BLOQUEADO (SOLO LECTURA SEGURO) */
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Módulo Bloqueado contra Modificaciones
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold uppercase">
                  Solo Lectura
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Los campos y registros de <strong>{moduleName}</strong> están protegidos contra alteraciones si te ausentas de la computadora o dejas la sesión abierta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={onUnlockRequest}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] active:scale-[0.98] text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 transition"
            >
              <Unlock className="w-4 h-4 text-[#FFA92D]" />
              <span>Seguir Editando (Desbloquear con PIN)</span>
            </button>
          </div>
        </div>
      ) : (
        /* BARRA DE SEGURIDAD CUANDO ESTÁ DESBLOQUEADO (EN EDICIÓN) */
        <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11.5px]">
              Modo Edición activo en <strong>{moduleName}</strong>. Cuando termines de digitar, protege tus datos:
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <span className="text-[10px] text-slate-400 hidden xl:inline">
              Atajo: <kbd className="px-1.5 py-0.5 bg-slate-200 rounded font-mono text-[9px] text-slate-700 font-bold">Alt + L</kbd>
            </span>
            <button
              type="button"
              onClick={onLock}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-300 border border-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Bloquea todos los campos de este módulo para que nadie pueda editarlos si te ausentas"
            >
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Bloquear Datos contra Modificaciones</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
