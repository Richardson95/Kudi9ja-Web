import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const control =
  'w-full rounded-xl border bg-surface px-4 text-[15px] text-ink placeholder:text-ink-3 outline-none transition ' +
  'focus:border-gold focus:ring-4 focus:ring-gold/15 disabled:cursor-not-allowed disabled:opacity-60';

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  className?: string;
  counter?: string;
}

export function FieldShell({ label, hint, error, id, children, className, counter }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || counter) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
              {label}
            </label>
          )}
          {counter && <span className="text-[11px] text-ink-3">{counter}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-relaxed text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  icon?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
  showCount?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, suffix, wrapperClassName, className, id, type = 'text', showCount, maxLength, value, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={fieldId}
      className={wrapperClassName}
      counter={showCount && maxLength ? `${String(value ?? '').length}/${maxLength}` : undefined}
    >
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
        <input
          ref={ref}
          id={fieldId}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={!!error || undefined}
          maxLength={maxLength}
          value={value}
          className={cn(control, 'h-12', icon && 'pl-11', (isPassword || suffix) && 'pr-12', error ? 'border-danger/60' : 'border-stroke', className)}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setReveal((r) => !r)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-3 hover:text-ink"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        ) : (
          suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">{suffix}</span>
        )}
      </div>
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, maxLength, value, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={fieldId}
      counter={maxLength ? `${String(value ?? '').length}/${maxLength}` : undefined}
    >
      <textarea
        ref={ref}
        id={fieldId}
        maxLength={maxLength}
        value={value}
        className={cn(control, 'min-h-[104px] resize-y py-3 leading-relaxed', error ? 'border-danger/60' : 'border-stroke', className)}
        {...rest}
      />
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  placeholder?: string;
  options: (string | { value: string; label: string })[];
  icon?: ReactNode;
}

export function Select({ label, hint, error, id, placeholder, options, icon, className, value, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
        <select
          id={fieldId}
          value={value}
          className={cn(
            control,
            'h-12 cursor-pointer appearance-none pr-10',
            icon && 'pl-11',
            !value && 'text-ink-3',
            error ? 'border-danger/60' : 'border-stroke',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value} className="bg-surface text-ink">
                {opt.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      </div>
    </FieldShell>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <input
        id={fieldId}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.6px] transition peer-focus-visible:ring-4 peer-focus-visible:ring-gold/25',
          checked ? 'border-gold bg-gold text-on-gold' : 'border-surface-high',
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[13px] leading-relaxed text-ink-2">{children}</span>
    </label>
  );
}
