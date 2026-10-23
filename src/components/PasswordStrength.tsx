import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/cn';
import { passwordScore } from '../lib/validators';

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
const COLOURS = ['bg-danger', 'bg-danger', 'bg-gold', 'bg-gold', 'bg-success', 'bg-success'];
const TEXT = ['text-danger', 'text-danger', 'text-gold', 'text-gold', 'text-success', 'text-success'];

export function PasswordStrength({ value, className }: { value: string; className?: string }) {
  const score = passwordScore(value);
  const checks: [string, boolean][] = [
    ['8+ characters', value.length >= 8],
    ['Upper & lowercase', /[A-Z]/.test(value) && /[a-z]/.test(value)],
    ['A number', /[0-9]/.test(value)],
    ['A symbol', /[!@#$%^&*(),.?":{}|<>_\-]/.test(value)],
  ];
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < score ? COLOURS[score] : 'bg-surface-high')} />
        ))}
        <span className={cn('ml-2 w-16 text-right text-[11.5px] font-bold', TEXT[score])}>{value ? LABELS[score] : ''}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {checks.map(([label, ok]) => (
          <span key={label} className={cn('flex items-center gap-1.5 text-[11.5px]', ok ? 'text-ink-2' : 'text-ink-3')}>
            {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Circle className="h-3.5 w-3.5" />}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
