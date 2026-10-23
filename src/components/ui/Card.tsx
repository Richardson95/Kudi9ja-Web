import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  gradient?: boolean;
  glow?: boolean;
  to?: string;
  accent?: 'gold' | 'success' | 'danger' | 'info';
}

const accents = {
  gold: 'border-gold/25',
  success: 'border-success/30',
  danger: 'border-danger/35',
  info: 'border-info/30',
};

/** Space-between classes (space-y-6, sm:space-y-4…) only work on the element whose children they space. */
const isSpacing = (c: string) => /^(?:[a-z]+:)*-?space-[xy]-/.test(c);

export function Card({ padded = true, gradient, glow, to, accent, className, children, onClick, ...rest }: CardProps) {
  // The children sit inside an inner wrapper (above the glow), so spacing
  // classes go there; on the outer box they would space the wrapper alone.
  const own = className?.split(/\s+/).filter(Boolean) ?? [];
  const classes = cn(
    'relative overflow-hidden rounded-2xl border bg-surface shadow-card',
    accent ? accents[accent] : 'border-stroke',
    gradient && 'card-gradient',
    padded && 'p-5',
    (to || onClick) && 'cursor-pointer transition duration-150 hover:-translate-y-px hover:border-gold/35',
    own.filter((c) => !isSpacing(c)).join(' '),
  );
  const inner = (
    <>
      {glow && (
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
      )}
      <div className={cn('relative', own.filter(isSpacing).join(' '))}>{children}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cn(classes, 'block')}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={classes} onClick={onClick} {...rest}>
      {inner}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  actionTo,
  onAction,
  className,
}: {
  title: ReactNode;
  action?: string;
  actionTo?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[15px] font-extrabold tracking-[-0.01em]">{title}</h2>
      {action &&
        (actionTo ? (
          <Link to={actionTo} className="text-[13px] font-bold text-gold hover:underline">
            {action}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className="text-[13px] font-bold text-gold hover:underline">
            {action}
          </button>
        ))}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>;
}

/** A label/value list, separated by hairlines — the app's receipt and terms style. */
export function DetailRows({
  rows,
  className,
}: {
  rows: (readonly [ReactNode, ReactNode] | { label: ReactNode; value: ReactNode; tone?: 'success' | 'danger' | 'gold'; bold?: boolean } | false | null | undefined)[];
  className?: string;
}) {
  const items = rows.filter(Boolean) as (readonly [ReactNode, ReactNode] | { label: ReactNode; value: ReactNode; tone?: 'success' | 'danger' | 'gold'; bold?: boolean })[];
  return (
    <dl className={cn('divide-y divide-stroke', className)}>
      {items.map((row, i) => {
        const r = Array.isArray(row) ? { label: row[0], value: row[1] } : (row as { label: ReactNode; value: ReactNode; tone?: string; bold?: boolean });
        return (
          <div key={i} className="flex items-start justify-between gap-6 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-[13px] text-ink-3">{r.label}</dt>
            <dd
              className={cn(
                'num text-right text-[13.5px] font-semibold',
                'bold' in r && r.bold && 'text-[15px] font-extrabold',
                'tone' in r && r.tone === 'success' && 'text-success',
                'tone' in r && r.tone === 'danger' && 'text-danger',
                'tone' in r && r.tone === 'gold' && 'text-gold',
              )}
            >
              {r.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function NavRow({
  icon,
  title,
  subtitle,
  to,
  onClick,
  trailing,
  danger,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  to?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) {
  const body = (
    <>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', danger ? 'bg-danger/10 text-danger' : 'bg-gold/10 text-gold')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-bold', danger && 'text-danger')}>{title}</span>
        {subtitle && <span className="block truncate text-[12.5px] text-ink-3">{subtitle}</span>}
      </span>
      {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />}
    </>
  );
  const classes = 'flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-surface-alt/60';
  if (to) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}
