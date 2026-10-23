import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn, copyText } from '../../lib/cn';
import { formatNumber } from '../../lib/format';
import { useToast } from './Toast';

export type Tone = 'gold' | 'success' | 'danger' | 'info' | 'neutral';

const pillTones: Record<Tone, string> = {
  gold: 'bg-gold/12 text-gold border-gold/25',
  success: 'bg-success/12 text-success border-success/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
  neutral: 'bg-surface-alt text-ink-2 border-stroke',
};

export function Pill({ children, tone = 'gold', icon, className }: { children: ReactNode; tone?: Tone; icon?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[10.5px] font-extrabold uppercase tracking-[0.08em]',
        pillTones[tone],
        className,
      )}
    >
      {icon && <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      {children}
    </span>
  );
}

const badgeTones: Record<Tone, string> = {
  gold: 'bg-gold/12 text-gold',
  success: 'bg-success/12 text-success',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  neutral: 'bg-surface-alt text-ink-2',
};

export function IconBadge({ children, tone = 'gold', size = 44, className }: { children: ReactNode; tone?: Tone; size?: number; className?: string }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-xl [&>svg]:h-[45%] [&>svg]:w-[45%]', badgeTones[tone], className)}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-gold/20 blur-2xl" />
        <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-gold/25 bg-surface text-gold [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-extrabold">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-2">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon,
  tone = 'gold',
  footnote,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-stroke bg-surface p-4 shadow-card', className)}>
      {icon && <span className={cn('mb-3 block [&>svg]:h-[18px] [&>svg]:w-[18px]', badgeTones[tone].split(' ')[1])}>{icon}</span>}
      <p className="num truncate text-xl font-extrabold tracking-[-0.02em]">{value}</p>
      <p className="mt-0.5 text-[12px] text-ink-3">{label}</p>
      {footnote && <p className="mt-1 text-[11px] font-semibold text-ink-3">{footnote}</p>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'gold', className }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = {
    gold: 'gold-gradient',
    success: 'bg-success',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-ink-3',
  }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-high', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 140,
  stroke = 10,
  tone = 'gold',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const colour = tone === 'success' ? 'rgb(var(--success))' : tone === 'danger' ? 'rgb(var(--danger))' : 'rgb(var(--gold))';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-high))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[26px] w-[46px] shrink-0 rounded-full border transition disabled:opacity-40',
        checked ? 'border-gold bg-gold' : 'border-stroke bg-surface-high',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-5 w-5 rounded-full shadow transition-all',
          checked ? 'left-[22px] bg-on-gold' : 'left-[2px] bg-ink-2',
        )}
      />
    </button>
  );
}

/** A row of options, one selected — the app's chip strips and segment controls. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto', className)} role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full border font-bold transition',
              size === 'sm' ? 'h-8 px-3.5 text-[12.5px]' : 'h-10 px-4 text-[13px]',
              on ? 'border-gold bg-gold/12 text-gold' : 'border-stroke bg-surface text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
            {!!o.count && (
              <span className="grid min-w-[20px] place-items-center rounded-full bg-danger px-1.5 text-[10.5px] font-extrabold leading-5 text-white">
                {formatNumber(o.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Two-to-four big choice tiles (gender, frequency, meter type...). */
export function ChoiceTiles<T extends string>({
  value,
  onChange,
  options,
  columns = 3,
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; sub?: ReactNode }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-xl border px-3 py-3 text-[13px] font-bold transition',
              on ? 'border-gold bg-gold/10 text-gold ring-1 ring-gold/40' : 'border-stroke bg-surface text-ink-2 hover:border-ink-3',
            )}
          >
            {o.label}
            {o.sub && <span className={cn('mt-0.5 block text-[11px] font-semibold', on ? 'text-gold/80' : 'text-ink-3')}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function CopyButton({ value, label = 'Copied', onCopied, className }: { value: string; label?: string; onCopied?: () => void; className?: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1600);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(value);
        if (ok) {
          setDone(true);
          toast.success(label);
          onCopied?.();
        } else toast.error('Could not copy. Select it and copy by hand.');
      }}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 text-[12px] font-bold text-gold transition hover:bg-gold/15',
        className,
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    gold: 'border-gold/25 bg-gold/[0.07] [&_.ico]:text-gold',
    success: 'border-success/25 bg-success/[0.07] [&_.ico]:text-success',
    danger: 'border-danger/30 bg-danger/[0.07] [&_.ico]:text-danger',
    info: 'border-info/25 bg-info/[0.07] [&_.ico]:text-info',
    neutral: 'border-stroke bg-surface-alt/50 [&_.ico]:text-ink-2',
  };
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5', tones[tone], className)}>
      {icon && <span className="ico mt-px shrink-0 [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span>}
      <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-2">
        {title && <p className="mb-0.5 text-[13px] font-extrabold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter(Boolean);
  const text = initials.length === 0 ? 'K9' : initials.length === 1 ? initials[0]!.toUpperCase() : (initials[0]! + initials[initials.length - 1]!).toUpperCase();
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full gold-gradient font-extrabold text-on-gold', className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {text}
    </span>
  );
}
