import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';
import { Eraser, PenLine, Undo2 } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** A PNG of the signature, cropped to the ink, on a transparent background. */
  toDataUrl: () => string | null;
}

type Point = { x: number; y: number };

/**
 * A pad to sign on with a mouse, a finger or a stylus. It is drawn as paper —
 * dark ink on warm white in both themes — because a signature is something
 * that gets printed, and white ink on a dark page prints as nothing.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; className?: string }>(
  function SignaturePad({ onChange, className }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Point[][]>([]);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    const redraw = useCallback(() => {
      const c = canvas.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1614';
      ctx.lineWidth = 2.4;
      for (const stroke of strokes.current) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
        if (stroke.length === 1) {
          ctx.lineTo(stroke[0]!.x + 0.1, stroke[0]!.y + 0.1);
        }
        for (let i = 1; i < stroke.length - 1; i++) {
          const mid = { x: (stroke[i]!.x + stroke[i + 1]!.x) / 2, y: (stroke[i]!.y + stroke[i + 1]!.y) / 2 };
          ctx.quadraticCurveTo(stroke[i]!.x, stroke[i]!.y, mid.x, mid.y);
        }
        if (stroke.length > 1) ctx.lineTo(stroke[stroke.length - 1]!.x, stroke[stroke.length - 1]!.y);
        ctx.stroke();
      }
    }, []);

    const resize = useCallback(() => {
      const c = canvas.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
      redraw();
    }, [redraw]);

    useEffect(() => {
      resize();
      const observer = new ResizeObserver(resize);
      if (canvas.current) observer.observe(canvas.current);
      return () => observer.disconnect();
    }, [resize]);

    const update = (next: boolean) => {
      setEmpty(next);
      onChange?.(next);
    };

    const point = (e: PointerEvent): Point => {
      const rect = canvas.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        strokes.current = [];
        redraw();
        update(true);
      },
      isEmpty: () => strokes.current.every((s) => s.length === 0),
      toDataUrl: () => {
        const c = canvas.current;
        if (!c || strokes.current.length === 0) return null;
        const all = strokes.current.flat();
        const dpr = window.devicePixelRatio || 1;
        const pad = 12;
        const minX = Math.max(0, Math.min(...all.map((p) => p.x)) - pad);
        const minY = Math.max(0, Math.min(...all.map((p) => p.y)) - pad);
        const maxX = Math.min(c.width / dpr, Math.max(...all.map((p) => p.x)) + pad);
        const maxY = Math.min(c.height / dpr, Math.max(...all.map((p) => p.y)) + pad);
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round((maxX - minX) * dpr));
        out.height = Math.max(1, Math.round((maxY - minY) * dpr));
        out.getContext('2d')?.drawImage(c, minX * dpr, minY * dpr, out.width, out.height, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
      },
    }));

    return (
      <div className={className}>
        <div className="relative overflow-hidden rounded-2xl border border-stroke bg-[#fffdf8] shadow-inner">
          <canvas
            ref={canvas}
            aria-label="Signature pad. Draw your signature here."
            className="block h-[180px] w-full cursor-crosshair touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drawing.current = true;
              strokes.current.push([point(e)]);
              redraw();
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              strokes.current[strokes.current.length - 1]!.push(point(e));
              redraw();
            }}
            onPointerUp={() => {
              if (!drawing.current) return;
              drawing.current = false;
              update(false);
            }}
            onPointerCancel={() => (drawing.current = false)}
          />
          <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-[#c9b89c]" />
          <span className="pointer-events-none absolute bottom-3 left-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8957a]">
            Sign above the line
          </span>
          {empty && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] font-semibold text-[#b4a389]">
              <span className="flex items-center gap-2">
                <PenLine className="h-4 w-4" /> Draw your signature here
              </span>
            </span>
          )}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            disabled={empty}
            onClick={() => {
              strokes.current.pop();
              redraw();
              update(strokes.current.length === 0);
            }}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-3 hover:text-ink disabled:opacity-40')}
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={() => {
              strokes.current = [];
              redraw();
              update(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-3 hover:text-danger disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>
    );
  },
);
