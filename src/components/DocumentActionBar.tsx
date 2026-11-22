import React, { useState } from 'react';
import {
  CopyPlus,
  Download,
  FileText,
  Printer,
  Save,
  Share2,
  Check,
  Loader2,
} from 'lucide-react';
import type { PageOrientation, PageSize } from '../types/casm';
import {
  downloadPdfFromElement,
  sharePdfOnWhatsApp,
  triggerPrintDocument,
} from '../utils/exportEngine';

interface DocumentActionBarProps {
  previewRef: React.RefObject<HTMLDivElement | null>;
  fileBaseName: string;
  whatsappMessage: string;
  orientation: PageOrientation;
  pageSize: PageSize;
  onDownloadWord?: () => Promise<void>;
  onSaveHistory: () => Promise<void>;
  onDuplicate: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export const DocumentActionBar: React.FC<DocumentActionBarProps> = ({
  previewRef,
  fileBaseName,
  whatsappMessage,
  orientation,
  pageSize,
  onDownloadWord,
  onSaveHistory,
  onDuplicate,
  disabled = false,
  disabledReason,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showTempStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handlePdf = async () => {
    if (!previewRef.current) return;
    setBusyAction('pdf');
    try {
      await downloadPdfFromElement(previewRef.current, `${fileBaseName}.pdf`, {
        orientation,
        pageSize,
      });
      showTempStatus('PDF descargado correctamente.');
    } catch {
      showTempStatus('No se pudo generar el PDF. Intenta imprimir como PDF.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleWord = async () => {
    if (!onDownloadWord) return;
    setBusyAction('word');
    try {
      await onDownloadWord();
      showTempStatus('Archivo Word (.docx) descargado.');
    } catch {
      showTempStatus('Error al generar el archivo Word.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleWhatsApp = async () => {
    if (!previewRef.current) return;
    setBusyAction('whatsapp');
    try {
      const mode = await sharePdfOnWhatsApp(
        previewRef.current,
        `${fileBaseName}.pdf`,
        whatsappMessage,
        { orientation, pageSize }
      );
      showTempStatus(
        mode === 'shared_native'
          ? 'Documento listo para compartir.'
          : 'PDF descargado y WhatsApp abierto con el mensaje prellenado.'
      );
    } catch {
      showTempStatus('No se pudo preparar el envío por WhatsApp.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSave = async () => {
    setBusyAction('save');
    try {
      await onSaveHistory();
      showTempStatus('Guardado en el historial local.');
    } catch {
      showTempStatus('No se pudo guardar en el historial.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="no-print bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || busyAction !== null}
          onClick={() => void handlePdf()}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#003366] hover:bg-[#00254a] disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          {busyAction === 'pdf' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>Descargar PDF</span>
        </button>

        {onDownloadWord && (
          <button
            type="button"
            disabled={disabled || busyAction !== null}
            onClick={() => void handleWord()}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {busyAction === 'word' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span>Descargar Word</span>
          </button>
        )}

        <button
          type="button"
          disabled={disabled || busyAction !== null}
          onClick={() => triggerPrintDocument(orientation, pageSize)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-45 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir</span>
        </button>

        <button
          type="button"
          disabled={disabled || busyAction !== null}
          onClick={() => void handleWhatsApp()}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          {busyAction === 'whatsapp' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span>Enviar por WhatsApp</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => void handleSave()}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#003366]/30 bg-[#003366]/5 hover:bg-[#003366]/10 text-[#003366] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          {busyAction === 'save' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Guardar en historial</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => {
            onDuplicate();
            showTempStatus('Documento duplicado como nuevo borrador.');
          }}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <CopyPlus className="w-4 h-4" />
          <span>Duplicar</span>
        </button>
      </div>

      {disabled && disabledReason && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {disabledReason}
        </p>
      )}

      {statusMessage && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
