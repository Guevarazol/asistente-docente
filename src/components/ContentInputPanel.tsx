import React, { useRef, useState } from 'react';
import { Camera, FileText, Mic, MicOff, Paperclip, Sparkles, Trash2, AlertCircle } from 'lucide-react';
import type { UploadedAttachment } from '../types/casm';
import { parseUploadedFile } from '../utils/fileReader';

interface ContentInputPanelProps {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  attachments: UploadedAttachment[];
  onAttachmentsChange: (list: UploadedAttachment[]) => void;
  onGenerate: () => void;
  generating: boolean;
  generateButtonLabel?: string;
  errorMessage?: string | null;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const ContentInputPanel: React.FC<ContentInputPanelProps> = ({
  label = 'Contenido base, notas, dictado o archivos',
  placeholder,
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  onGenerate,
  generating,
  generateButtonLabel = 'Generar documento con IA',
  errorMessage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [listening, setListening] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readingFiles, setReadingFiles] = useState(false);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setFileError(null);
    setReadingFiles(true);

    const parsed: UploadedAttachment[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const att = await parseUploadedFile(file);
        parsed.push(att);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `No se pudo leer ${file.name}`);
      }
    }

    if (parsed.length > 0) {
      onAttachmentsChange([...attachments, ...parsed]);
    }
    if (errors.length > 0) {
      setFileError(errors.join(' '));
    }
    setReadingFiles(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const toggleVoiceDictation = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setFileError(
        'Tu navegador no admite dictado por voz. Puedes escribir o subir un archivo/foto.'
      );
      return;
    }

    setFileError(null);
    const rec = new SpeechRec();
    rec.lang = 'es-SV';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (event) => {
      let appended = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          appended += event.results[i][0].transcript + ' ';
        }
      }
      if (appended.trim()) {
        onChange((value ? value.trimEnd() + '\n' : '') + appended.trim());
      }
    };

    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === 'not-allowed') {
        setFileError('Permiso de micrófono denegado. Actívalo en la configuración del navegador.');
      }
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-bold text-[#003366]">{label}</label>
        <div className="flex flex-wrap items-center gap-2">
          {/* Camera capture (allows taking multiple photos on mobile) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => void handleFilesSelected(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={readingFiles}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#003366]" />
            <span>Tomar foto</span>
          </button>

          {/* File upload: PDF, DOCX, XLSX, CSV, TXT, Images */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,image/*"
            onChange={(e) => void handleFilesSelected(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={readingFiles}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Paperclip className="w-4 h-4 text-[#003366]" />
            <span>Subir archivo</span>
          </button>

          {/* Voice Dictation */}
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              listening
                ? 'bg-rose-600 text-white border-rose-600'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#003366]" />}
            <span>{listening ? 'Detener voz' : 'Dictar'}</span>
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366]/25 focus:border-[#003366]"
      />

      <p className="text-[11px] text-slate-500">
        Formatos admitidos: PDF, fotos (puedes tomar varias por documento), Word (.docx), Excel (.xlsx), CSV y TXT.
      </p>

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600">
            Archivos y fotos adjuntas ({attachments.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#003366]/10 text-[#003366] flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{att.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {att.kind === 'image'
                        ? 'Imagen para análisis IA'
                        : att.kind === 'pdf'
                          ? 'PDF directo a IA'
                          : 'Texto extraído listo'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  aria-label={`Quitar ${att.name}`}
                  className="min-w-[36px] min-h-[36px] rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(fileError || errorMessage) && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{fileError || errorMessage}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating || readingFiles || (!value.trim() && attachments.length === 0)}
        className="w-full min-h-[48px] rounded-xl bg-[#003366] hover:bg-[#00254a] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition cursor-pointer"
      >
        <Sparkles className={`w-4 h-4 text-[#FFA92D] ${generating ? 'animate-spin' : ''}`} />
        <span>
          {readingFiles
            ? 'Leyendo archivos adjuntos...'
            : generating
              ? 'Generando documento con Gemini IA...'
              : generateButtonLabel}
        </span>
      </button>
    </div>
  );
};
