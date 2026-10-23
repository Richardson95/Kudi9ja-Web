import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FileText, ImagePlus, RefreshCw, UploadCloud, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { fileSize, formatAmountInput, nairaShort } from '../../lib/format';

/** The big centred naira field from the app's money screens. */
export function AmountInput({
  value,
  onChange,
  autoFocus,
  error,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  error?: boolean;
  label?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('text-center', className)}>
      {label && (
        <label htmlFor={id} className="mb-2 block text-[13px] font-semibold text-ink-3">
          {label}
        </label>
      )}
      <div className="flex items-baseline justify-center gap-1">
        <span className={cn('text-3xl font-extrabold', value ? 'text-gold' : 'text-ink-3')}>₦</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(formatAmountInput(e.target.value))}
          className={cn(
            'num w-full max-w-[360px] bg-transparent text-center text-[44px] font-extrabold tracking-[-0.03em] outline-none placeholder:text-surface-high sm:text-5xl',
            error && 'text-danger',
          )}
          style={{ width: `${Math.max(2, value.length + 1)}ch` }}
        />
      </div>
    </div>
  );
}

export function QuickAmounts({ amounts, onPick, className }: { amounts: number[]; onPick: (n: number) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {amounts.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onPick(a)}
          className="rounded-full border border-stroke bg-surface px-3.5 py-1.5 text-[12.5px] font-bold text-ink-2 transition hover:border-gold/50 hover:text-gold"
        >
          {nairaShort(a)}
        </button>
      ))}
    </div>
  );
}

export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const pct = max > min ? ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={Math.min(Math.max(value, min), max)}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gold [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:shadow-[0_0_0_5px_rgb(var(--gold)/0.18)]"
      style={{ background: `linear-gradient(to right, rgb(var(--gold)) ${pct}%, rgb(var(--surface-high)) ${pct}%)` }}
    />
  );
}

function usePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

const MAX_BYTES = 12 * 1024 * 1024;

/** A drop zone for one file — a receipt, a statement, a photograph. */
export function FileDrop({
  file,
  onFile,
  accept,
  title,
  subtitle,
  aspect = 'wide',
  onError,
  required,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  title: string;
  subtitle?: string;
  aspect?: 'wide' | 'portrait';
  onError?: (message: string) => void;
  required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const preview = usePreview(file);

  const take = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      onError?.(`That file is ${fileSize(f.size)}. The limit is 12 MB.`);
      return;
    }
    onFile(f);
  };

  return (
    <div>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => take(e.target.files?.[0] ?? undefined)} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition',
          aspect === 'portrait' ? 'aspect-[3/4]' : file && preview ? 'aspect-[16/10]' : 'min-h-[132px]',
          over ? 'border-gold bg-gold/10' : file ? 'border-gold/40 bg-surface' : 'border-stroke bg-surface hover:border-gold/40',
        )}
      >
        {file && preview ? (
          <>
            <img src={preview} alt={title} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11.5px] font-bold text-white">
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </span>
          </>
        ) : file ? (
          <div className="flex h-full min-h-[132px] items-center gap-4 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/12 text-gold">
              <FileText className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{file.name}</span>
              <span className="block text-[12px] text-ink-3">{fileSize(file.size)} · click to choose another</span>
            </span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
            {aspect === 'portrait' ? <ImagePlus className="h-7 w-7 text-gold" /> : <UploadCloud className="h-7 w-7 text-gold" />}
            <span className="text-[13.5px] font-bold">{title}</span>
            {subtitle && <span className="text-[12px] text-ink-3">{subtitle}</span>}
            {required && <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-gold">Required</span>}
          </div>
        )}
      </div>
      {file && (
        <button type="button" onClick={() => onFile(null)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-3 hover:text-danger">
          <X className="h-3.5 w-3.5" /> Remove
        </button>
      )}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 eyebrow">{children}</p>;
}
