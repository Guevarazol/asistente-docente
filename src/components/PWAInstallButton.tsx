import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Laptop,
  Monitor,
  Share2,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed in standalone window, don't clutter the header
  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Instalar Asistente Docente en tu ordenador o dispositivo"
        className="min-h-[36px] px-2 sm:px-2.5 rounded-lg bg-[#FFA92D] hover:bg-[#f59e0b] active:scale-[0.98] text-[#002244] font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-[#002244]" />
        <span className="hidden md:inline">Instalar App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#FFA92D] flex items-center justify-center shrink-0">
                  <Monitor className="w-5 h-5 text-[#003366]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#003366]">
                    Instalar Asistente Docente
                  </h3>
                  <p className="text-xs text-slate-500">
                    Instala la aplicación en tu ordenador local o teléfono para usarla sin conexión.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Install button if browser prompt is available */}
            {isInstallable && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                <div className="text-xs text-amber-900">
                  <strong>Tu navegador permite instalación directa:</strong>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setShowGuide(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#002244] shadow-xs cursor-pointer shrink-0"
                >
                  Instalar ahora
                </button>
              </div>
            )}

            {/* Guide sections */}
            <div className="space-y-3 text-xs">
              {/* Desktop Windows / Mac */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-[#003366] flex items-center gap-1.5 text-sm">
                  <Laptop className="w-4 h-4 text-[#FFA92D]" />
                  <span>En tu Ordenador / PC / Laptop (Windows o Mac)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1">
                  <li>
                    En <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>, busca el ícono de instalación <strong>🖥️ o ⊕</strong> en el extremo derecho de la barra de direcciones.
                  </li>
                  <li>
                    O abre el menú del navegador <strong>(⋮)</strong> &gt; <strong>«Instalar Asistente Docente»</strong> (o <em>«Aplicaciones» &gt; «Instalar este sitio como aplicación»</em>).
                  </li>
                  <li>
                    ¡Listo! Se creará un acceso directo en tu <strong>Escritorio</strong> y menú Inicio, abriendo la app en ventana propia a pantalla completa.
                  </li>
                </ol>
              </div>

              {/* Mobile iPhone / Android */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-[#003366] flex items-center gap-1.5 text-sm">
                  <Smartphone className="w-4 h-4 text-[#FFA92D]" />
                  <span>En Celulares y Tablets</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block mb-1">Android (Chrome):</strong>
                    Toca el menú <strong>(⋮)</strong> &gt; <strong>«Instalar aplicación»</strong> o «Agregar a la pantalla principal».
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-800 block mb-1">iPhone / iPad (Safari):</strong>
                    Toca el botón <strong>Compartir</strong> <Share2 className="w-3 h-3 inline" /> &gt; <strong>«Agregar al inicio»</strong>.
                  </div>
                </div>
              </div>

              {/* Offline standalone HTML alternative */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="font-bold text-emerald-900 flex items-center justify-between">
                  <span>¿Prefieres un archivo único sin servidor?</span>
                  <a
                    href="/CASM_Docente_Prueba.html"
                    download="Asistente_Docente.html"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px]"
                  >
                    <Download className="w-3 h-3" /> Descargar HTML
                  </a>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Puedes descargar la versión en archivo HTML único y guardarla en tu memoria USB o Escritorio. Funciona con solo hacer doble clic, sin internet.
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#002244] cursor-pointer transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="no-print fixed bottom-20 md:bottom-4 left-4 right-4 md:right-auto z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Sin conexión — Tus documentos e historial locales siguen disponibles.</span>
    </div>
  );
};
