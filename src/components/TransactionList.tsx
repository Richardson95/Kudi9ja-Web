import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';
import { asDay, naira, relative } from '../lib/format';
import { txIcon, txTone } from '../lib/labels';
import type { Transaction } from '../types/api';
import { IconBadge, Pill } from './ui/Bits';

export function TransactionRow({ tx, hidden, linkTo }: { tx: Transaction; hidden?: boolean; linkTo?: string | null }) {
  const Icon = txIcon[tx.kind];
  const body = (
    <>
      <IconBadge tone={txTone(tx.kind, tx.credit)} size={40}>
        <Icon />
      </IconBadge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{tx.description}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[12px] text-ink-3">{relative(tx.occurredAt)}</span>
          {tx.status !== 'SUCCESSFUL' && (
            <Pill tone={tx.status === 'PENDING' ? 'gold' : 'danger'}>{tx.status === 'PENDING' ? 'Pending' : 'Reversed'}</Pill>
          )}
        </div>
      </div>
      <p
        className={cn(
          'num shrink-0 text-[14.5px] font-extrabold',
          tx.status === 'REVERSED' && 'text-ink-3 line-through',
          tx.status !== 'REVERSED' && (tx.credit ? 'text-success' : 'text-ink'),
        )}
      >
        {hidden ? '••••' : `${tx.credit ? '+' : '-'}${naira(tx.amount)}`}
      </p>
    </>
  );
  const classes = 'flex items-center gap-3.5 px-4 py-3 transition hover:bg-surface-alt/50';
  const to = linkTo === undefined ? `/app/transactions/${tx.id}` : linkTo;
  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** Grouped by day — Today, Yesterday, then dates — the way the app's wallet reads. */
export function TransactionGroups({ items, hidden, linkFor }: { items: Transaction[]; hidden?: boolean; linkFor?: (tx: Transaction) => string | null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = new Map<string, Transaction[]>();
  for (const tx of items) {
    const d = new Date(tx.occurredAt);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
    const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : asDay(d);
    const list = groups.get(label) ?? [];
    list.push(tx);
    groups.set(label, list);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([label, list]) => (
        <section key={label}>
          <p className="eyebrow mb-2 px-1">{label}</p>
          <div className="divide-y divide-stroke overflow-hidden rounded-2xl border border-stroke bg-surface">
            {list.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} hidden={hidden} linkTo={linkFor ? linkFor(tx) : undefined} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
