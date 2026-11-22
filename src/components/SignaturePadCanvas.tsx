import React, { useEffect, useRef, useState } from 'react';
import { Check, Eraser, PenTool, Undo2, X } from 'lucide-react';

interface StrokePoint {
  x: number;
  y: number;
}

interface StrokePath {
  color: string;
  width: number;
  points: StrokePoint[];
}

interface SignaturePadCanvasProps {
  onSaveSignature: (pngDataUrl: string) => void | Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 300;

const INK_OPTIONS = [
  { id: 'navy', label: 'Azul tinta', color: '#0f2a5c' },
  { id: 'black', label: 'Negro', color: '#111827' },
] as const;

const WIDTH_OPTIONS = [
  { id: 'thin', label: 'Fino', width: 3.2 },
  { id: 'medium', label: 'Medio', width: 4.8 },
  { id: 'bold', label: 'Grueso', width: 6.5 },
] as const;

function drawStrokeOnContext(ctx: CanvasRenderingContext2D, stroke: StrokePath) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length - 1; i++) {
    const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
    const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
  }
  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Exports strokes as a crisp, transparent PNG cropped tightly around the drawn signature
 * so it aligns naturally over printed signature lines.
 */
function exportTrimmedSignaturePng(strokes: StrokePath[]): string | null {
  if (strokes.length === 0) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_WIDTH;
  offscreen.height = CANVAS_HEIGHT;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;

  for (const stroke of strokes) {
    drawStrokeOnContext(ctx, stroke);
  }

  const { data, width, height } = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasInk = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        hasInk = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasInk) return null;

  const pad = 16;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - cropY, maxY - minY + 1 + pad * 2);

  const trimmed = document.createElement('canvas');
  trimmed.width = Math.max(1, cropW);
  trimmed.height = Math.max(1, cropH);
  const trimmedCtx = trimmed.getContext('2d');
  if (!trimmedCtx) return offscreen.toDataURL('image/png');

  trimmedCtx.drawImage(offscreen, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return trimmed.toDataURL('image/png');
}

export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  onSaveSignature,
  onCancel,
  saving = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<StrokePath[]>([]);
  const activeStrokeRef = useRef<StrokePath | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const [inkColor, setInkColor] = useState<string>(INK_OPTIONS[0].color);
  const [strokeWidth, setStrokeWidth] = useState<number>(WIDTH_OPTIONS[1].width);
  const [strokeCount, setStrokeCount] = useState<number>(0);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const stroke of strokesRef.current) {
      drawStrokeOnContext(ctx, stroke);
    }
    if (activeStrokeRef.current) {
      drawStrokeOnContext(ctx, activeStrokeRef.current);
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, []);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / Math.max(rect.width, 1);
    const scaleY = CANVAS_HEIGHT / Math.max(rect.height, 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    const pt = getCanvasPoint(e);
    activeStrokeRef.current = {
      color: inkColor,
      width: strokeWidth,
      points: [pt],
    };
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId || !activeStrokeRef.current) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    const pts = activeStrokeRef.current.points;
    const prev = pts[pts.length - 1];
    // Skip tiny sub-pixel jitter
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1.5) return;
    pts.push(pt);
    redrawCanvas();
  };

  const finishActiveStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    if (activeStrokeRef.current && activeStrokeRef.current.points.length > 0) {
      strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
      setStrokeCount(strokesRef.current.length);
    }
    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    redrawCanvas();
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redrawCanvas();
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    redrawCanvas();
  };

  const handleSave = async () => {
    const pngDataUrl = exportTrimmedSignaturePng(strokesRef.current);
    if (!pngDataUrl) return;
    await onSaveSignature(pngDataUrl);
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-white p-4 space-y-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#003366]">
          <PenTool className="w-4 h-4" />
          <span>Captura de firma a mano alzada</span>
        </div>

        {/* Ink & stroke controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {INK_OPTIONS.map((ink) => (
              <button
                key={ink.id}
                type="button"
                onClick={() => setInkColor(ink.color)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                  inkColor === ink.color
                    ? 'bg-white text-[#003366] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: ink.color }}
                />
                <span>{ink.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {WIDTH_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStrokeWidth(opt.width)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition ${
                  strokeWidth === opt.width
                    ? 'bg-white text-[#003366] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drawing canvas with baseline guide */}
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishActiveStroke}
          onPointerCancel={finishActiveStroke}
          className="w-full h-44 sm:h-48 block touch-none cursor-crosshair bg-transparent relative z-10"
        />
        {/* Baseline visual guide (not exported in final PNG) */}
        <div className="pointer-events-none absolute inset-x-8 bottom-9 border-b border-slate-300/90" />
        {strokeCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-medium">
            Firma aquí con tu dedo, lápiz táctil o ratón
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={strokeCount === 0 || saving}
            onClick={handleUndo}
            className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Deshacer</span>
          </button>
          <button
            type="button"
            disabled={strokeCount === 0 || saving}
            onClick={handleClear}
            className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="min-h-[40px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>
          )}
          <button
            type="button"
            disabled={strokeCount === 0 || saving}
            onClick={() => void handleSave()}
            className="min-h-[40px] px-4 rounded-xl bg-[#003366] hover:bg-[#00254a] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar firma'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
