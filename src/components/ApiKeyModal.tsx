import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Key, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { checkGeminiKeyStatus, saveGeminiApiKey } from '../services/aiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [currentModel, setCurrentModel] = useState('gemini-2.5-flash');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkGeminiKeyStatus().then((res) => {
        setHasExistingKey(res.hasKey);
        setCurrentModel(res.model || 'gemini-2.5-flash');
      });
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setStatusMsg({ type: 'error', text: 'Por favor ingresa una clave de API válida.' });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      await saveGeminiApiKey(apiKey.trim(), currentModel);
      setStatusMsg({ type: 'success', text: '¡Clave de Gemini API guardada y activada correctamente!' });
      setHasExistingKey(true);
      setApiKey('');
      onKeySaved?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar la clave.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-[#FFA92D]">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#003366]">Configuración de Gemini API</h3>
              <p className="text-[11px] text-slate-500">Conexión requerida para funciones de IA</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado actual */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
            hasExistingKey
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {hasExistingKey ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Clave configurada:</strong> La IA está activa y lista para usar.
              </span>
            </>
          ) : (
            <>
              <Key className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Clave pendiente:</strong> Ingresa tu clave para habilitar la generación con IA.
              </span>
            </>
          )}
        </div>

        {/* Instrucciones y enlace para obtener clave */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-700">¿Cómo obtener tu clave gratuita?</p>
          <ol className="list-decimal pl-4 space-y-1 text-[11.5px]">
            <li>Inicia sesión con tu cuenta de Google.</li>
            <li>Haz clic en el enlace inferior a Google AI Studio.</li>
            <li>Pulsa en <strong>«Create API key»</strong> y cópiala.</li>
          </ol>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003366] hover:underline pt-1"
          >
            <span>Obtener clave gratis en Google AI Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {hasExistingKey ? 'Reemplazar clave API' : 'Pega tu clave de API (AIzaSy...)'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
          </div>

          {statusMsg && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-medium ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !apiKey.trim()}
              className="px-5 py-2 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 shadow-xs cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Guardar y Activar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
