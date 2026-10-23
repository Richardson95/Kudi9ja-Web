import { cn } from '../../lib/cn';
import { formatNumber } from '../../lib/format';
import { Avatar } from '../ui/Bits';
import { Skeleton } from '../ui/Spinner';
import { useOfficerOptions } from './OfficersPanel';

/** Choose exactly one person from the team — everyone with active panel access. */
export function OfficerPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const options = useOfficerOptions();
  if (options.isLoading) return <Skeleton className="h-28 w-full" />;
  const list = options.data ?? [];
  if (!list.length) return <p className="text-[13px] text-ink-3">Nobody on the team can be a loan officer yet. Add someone on the Team page.</p>;
  return (
    <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup">
      {list.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
              value === o.id ? 'border-gold bg-gold/10' : 'border-stroke hover:border-gold/40',
            )}
          >
            <Avatar name={o.name} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{o.name}</span>
              <span className="block truncate text-[11.5px] text-ink-3">
                {o.roleLabel} · {formatNumber(o.borrowers)} borrower{o.borrowers === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
