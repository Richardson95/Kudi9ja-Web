import { useEffect, useRef, type ReactNode } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '../../lib/cn';

export function PasscodeDots({ length, filled, error, size = 15 }: { length: number; filled: number; error?: boolean; size?: number }) {
  return (
    <div className={cn('flex items-center justify-center gap-3.5', error && 'animate-shake')} aria-hidden="true">
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full border-2 transition-all duration-150',
            error ? 'border-danger bg-danger' : i < filled ? 'scale-110 border-gold bg-gold' : 'border-surface-high bg-transparent',
          )}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

/**
 * The numeric keypad, plus the physical keyboard: digits type, Backspace
 * deletes. On a website most people will type, so both work at once.
 */
export function NumericKeypad({
  onDigit,
  onBackspace,
  disabled,
  leftAction,
  captureKeyboard = true,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  leftAction?: ReactNode;
  captureKeyboard?: boolean;
}) {
  const handlers = useRef({ onDigit, onBackspace, disabled });
  handlers.current = { onDigit, onBackspace, disabled };

  useEffect(() => {
    if (!captureKeyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (handlers.current.disabled || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        handlers.current.onDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlers.current.onBackspace();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captureKeyboard]);

  const key = 'grid h-14 place-items-center rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-40';
  return (
    <div className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-2.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" disabled={disabled} onClick={() => onDigit(d)} className={cn(key, 'bg-surface-alt/60 hover:bg-surface-alt')}>
          {d}
        </button>
      ))}
      <div className="grid place-items-center">{leftAction}</div>
      <button type="button" disabled={disabled} onClick={() => onDigit('0')} className={cn(key, 'bg-surface-alt/60 hover:bg-surface-alt')}>
        0
      </button>
      <button type="button" disabled={disabled} onClick={onBackspace} className={cn(key, 'text-ink-2 hover:bg-surface-alt')} aria-label="Delete">
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );
}

/** Six separate boxes for a one-time code, with paste support. */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, length - 1)]?.focus();
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };

  return (
    <div className={cn('flex justify-center gap-2 sm:gap-3', error && 'animate-shake')}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          value={value[i] ?? ''}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            if (!digit) return;
            set((value.slice(0, i) + digit + value.slice(i + 1)).slice(0, length));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (value[i]) set(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) {
                set(value.slice(0, i - 1) + value.slice(i));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            set(e.clipboardData.getData('text'));
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'num h-14 w-11 rounded-xl border bg-surface text-center text-2xl font-extrabold outline-none transition sm:h-16 sm:w-14',
            'focus:border-gold focus:ring-4 focus:ring-gold/15',
            error ? 'border-danger text-danger' : value[i] ? 'border-gold/60' : 'border-stroke',
          )}
        />
      ))}
    </div>
  );
}
