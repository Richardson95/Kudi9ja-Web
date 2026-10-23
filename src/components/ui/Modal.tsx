import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Block closing while something is in flight. */
  locked?: boolean;
  className?: string;
}

const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', full: 'sm:max-w-6xl' };

let openCount = 0;

export function Modal({ open, onClose, title, description, children, footer, size = 'md', locked, className }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (!open) return;
    openCount++;
    document.body.style.overflow = 'hidden';
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => {
      const focusable = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([data-close])');
      (focusable ?? panel.current)?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      openCount--;
      if (openCount === 0) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-[3px]" onClick={() => !locked && onClose()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl border border-stroke bg-surface shadow-pop outline-none sm:rounded-3xl',
          widths[size],
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-high sm:hidden" />
        {(title || !locked) && (
          <div className="flex items-start gap-4 px-6 pb-2 pt-5">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-lg font-extrabold tracking-[-0.01em]">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{description}</p>}
            </div>
            {!locked && (
              <button
                type="button"
                data-close
                onClick={onClose}
                className="-mr-2 rounded-full p-2 text-ink-3 transition hover:bg-surface-alt hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
        {footer && <div className="border-t border-stroke bg-surface px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
