import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'gold' | 'ghost' | 'outline' | 'danger' | 'subtle' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'hero';

const variants: Record<Variant, string> = {
  gold: 'gold-gradient text-on-gold shadow-gold hover:brightness-[1.06] active:brightness-95',
  ghost: 'bg-surface border border-stroke text-ink hover:bg-surface-alt',
  outline: 'border border-gold/50 text-gold hover:bg-gold/10',
  danger: 'bg-danger/10 border border-danger/30 text-danger hover:bg-danger/15',
  subtle: 'text-ink-2 hover:text-ink hover:bg-surface-alt',
  success: 'bg-success text-white hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-[52px] px-6 text-[15px] rounded-2xl gap-2.5',
  // Small enough on a phone for two to sit side by side; large from tablet width up.
  hero: 'h-11 px-3 text-[clamp(11.5px,3.4vw,13.5px)] rounded-xl gap-1.5 sm:h-[52px] sm:px-6 sm:text-[15px] sm:rounded-2xl sm:gap-2.5',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
  to?: string;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'gold', size = 'md', loading, icon, iconRight, block, to, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-bold tracking-[-0.01em] transition duration-150',
    'disabled:pointer-events-none disabled:opacity-45',
    variants[variant],
    sizes[size],
    block && 'w-full',
    className,
  );
  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children && <span>{children}</span>}
      {!loading && iconRight}
    </>
  );
  if (to && !disabled) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={classes} {...rest}>
      {content}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  badge,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; badge?: number | boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative grid h-10 w-10 place-items-center rounded-full border border-stroke bg-surface text-ink-2 transition hover:text-ink hover:bg-surface-alt',
        className,
      )}
      {...rest}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white ring-2 ring-canvas">
          {typeof badge === 'number' ? (badge > 99 ? '99+' : badge) : ''}
        </span>
      ) : null}
    </button>
  );
}
