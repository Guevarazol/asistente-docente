import React, { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Trash2, Upload, User, UserCheck, X } from 'lucide-react';

export interface TeacherPhotoModalSaveData {
  photoUrl: string;
  name?: string;
  gender?: 'femenino' | 'masculino';
}

interface TeacherPhotoModalProps {
  open: boolean;
  currentPhoto?: string;
  currentName?: string;
  currentGender?: 'femenino' | 'masculino';
  onSave: (data: TeacherPhotoModalSaveData) => void;
  onClose: () => void;
}

/**
 * Resizes and crops an image to a square of max 360x360 and returns a lightweight JPEG data URL.
 */
function processImageToSquare(imgOrVideo: HTMLImageElement | HTMLVideoElement): string {
  const size = 360;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const isVideo = imgOrVideo instanceof HTMLVideoElement;
  const naturalW = isVideo ? (imgOrVideo as HTMLVideoElement).videoWidth : (imgOrVideo as HTMLImageElement).naturalWidth;
  const naturalH = isVideo ? (imgOrVideo as HTMLVideoElement).videoHeight : (imgOrVideo as HTMLImageElement).naturalHeight;

  // Center crop square
  const minDim = Math.min(naturalW, naturalH);
  const sx = (naturalW - minDim) / 2;
  const sy = (naturalH - minDim) / 2;

  ctx.drawImage(imgOrVideo, sx, sy, minDim, minDim, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export const TeacherPhotoModal: React.FC<TeacherPhotoModalProps> = ({
  open,
  currentPhoto,
  currentName,
  currentGender,
  onSave,
  onClose,
}) => {
  const [preview, setPreview] = useState<string>(currentPhoto || '');
  const [name, setName] = useState<string>(currentName || '');
  const [gender, setGender] = useState<'femenino' | 'masculino'>(currentGender || 'femenino');
  const [usingCamera, setUsingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentPhoto || '');
    setName(currentName || '');
    setGender(currentGender || 'femenino');
    setUsingCamera(false);
    setCameraError(null);
  }, [open, currentPhoto, currentName, currentGender]);

  // Clean up camera stream on close
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setUsingCamera(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setCameraError(
        'No se pudo acceder a la cámara. Verifica que tengas una cámara conectada y permisos habilitados.'
      );
      setUsingCamera(false);
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    try {
      const squareDataUrl = processImageToSquare(videoRef.current);
      setPreview(squareDataUrl);
      stopCamera();
      setUsingCamera(false);
    } catch (e) {
      console.error('Error al capturar foto:', e);
    }
  };

  const handleFileUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const squareDataUrl = processImageToSquare(img);
        setPreview(squareDataUrl);
        stopCamera();
        setUsingCamera(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    stopCamera();
    onSave({
      photoUrl: preview,
      name: name.trim(),
      gender,
    });
    onClose();
  };

  const handleRemovePhoto = () => {
    stopCamera();
    setPreview('');
  };

  const handleCancel = () => {
    stopCamera();
    onClose();
  };

  if (!open) return null;

  const titlePrefix = gender === 'masculino' ? 'Profesor' : 'Profesora';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFA92D]/20 text-[#003366] flex items-center justify-center">
              <Camera className="w-4 h-4 text-[#FFA92D]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#003366]">Foto y Perfil del Docente</h3>
              <p className="text-[11px] text-slate-500">
                Se muestra en la portada junto al nombre y logotipo del colegio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera or Avatar Preview */}
        <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
          {usingCamera ? (
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-black shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#FFA92D]/70 rounded-full m-3"></div>
            </div>
          ) : preview ? (
            <div className="flex flex-col items-center">
              <div className="relative group">
                <img
                  src={preview}
                  alt="Foto seleccionada"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-cover rounded-full border-4 border-[#FFA92D] shadow-md bg-white"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  title="Quitar foto"
                  className="absolute top-0 right-0 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FFA92D] block">
                  {titlePrefix}
                </span>
                <span className="text-xs font-bold text-slate-800 block">
                  {name || '[Sin nombre asignado]'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full border-3 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400">
                <User className="w-14 h-14 opacity-30" />
                <span className="text-xs font-semibold mt-1 text-slate-400">Sin foto</span>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FFA92D] block">
                  {titlePrefix}
                </span>
                <span className="text-xs font-bold text-slate-800 block">
                  {name || '[Sin nombre asignado]'}
                </span>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 text-center">
              {cameraError}
            </div>
          )}
        </div>

        {/* Capture or Source Controls */}
        <div className="space-y-2">
          {usingCamera ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={captureCameraFrame}
                className="flex-1 min-h-[44px] rounded-xl bg-[#FFA92D] hover:bg-[#f59e0b] text-[#002244] font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>📸 Tomar Foto Ahora</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setUsingCamera(false);
                }}
                className="px-3.5 min-h-[44px] rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar cámara
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void startCamera()}
                className="min-h-[40px] rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Camera className="w-4 h-4 text-[#FFA92D]" />
                <span>Tomar con Cámara</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] rounded-xl border border-slate-300 hover:bg-slate-100 text-[#003366] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#FFA92D]" />
                <span>Subir de Archivo</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Tratamiento / Sexo del Docente */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tratamiento / Sexo del Docente:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('femenino')}
                className={`min-h-[40px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  gender === 'femenino'
                    ? 'bg-[#003366] text-white border-[#003366] shadow-xs ring-2 ring-[#FFA92D]/40'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-base">👩</span>
                <span>Profesora (Femenino)</span>
              </button>

              <button
                type="button"
                onClick={() => setGender('masculino')}
                className={`min-h-[40px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  gender === 'masculino'
                    ? 'bg-[#003366] text-white border-[#003366] shadow-xs ring-2 ring-[#FFA92D]/40'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-base">👨</span>
                <span>Profesor (Masculino)</span>
              </button>
            </div>
          </div>

          {/* Nombre completo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre de la {titlePrefix.toLowerCase()}:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={gender === 'masculino' ? 'Ej. Prof. Carlos Eduardo Martínez' : 'Ej. Prof. María Elena Ramos'}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Aparecerá directamente abajo de la foto en la portada principal.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
          {preview ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quitar foto</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-[38px] px-3.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[38px] px-4 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FFA92D]" />
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
