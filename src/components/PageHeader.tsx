import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../lib/cn';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Kudi9ja` : 'Kudi9ja — Easy money.';
  }, [title]);
}

export function PageHeader({
  title,
  subtitle,
  back,
  backLabel = 'Back',
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  usePageTitle(typeof title === 'string' ? title : '');
  return (
    <header className={cn('mb-6 animate-fade-in', className)}>
      {back && (
        <Link
          to={back}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 transition hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5 text-gold">{eyebrow}</p>}
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[30px]">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
