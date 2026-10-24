import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CalendarDays, CreditCard, FileDown, HandCoins, NotebookPen, Search, Wallet, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, IconBadge, Pill, Segmented, StatTile } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Spinner';
import { useAdminRepayments } from '../../hooks/queries';
import { asDayTime, formatNumber, naira } from '../../lib/format';
import type { AdminRepayment, RepaymentSource } from '../../types/api';

const SOURCES: { value: RepaymentSource | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PAYSTACK', label: 'Paystack' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'RECORDED', label: 'Recorded by hand' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

const sourceStyle: Record<RepaymentSource, { icon: typeof Wallet; tone: 'gold' | 'success' | 'info' | 'neutral' }> = {
  PAYSTACK: { icon: CreditCard, tone: 'success' },
  WALLET: { icon: Wallet, tone: 'gold' },
  BANK_TRANSFER: { icon: Banknote, tone: 'info' },
  RECORDED: { icon: NotebookPen, tone: 'neutral' },
};

/** Every repayment customers have made: through Paystack, from the wallet, or taken by the team and recorded. */
export default function Repayments() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<RepaymentSource | 'ALL'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const filtered = !!(query.trim() || source !== 'ALL' || from || to);
  const list = useAdminRepayments({ page, query: query.trim(), source, from, to });
  const s = list.data?.summary;
  const p = list.data?.page;

  // Any change to the filters starts again from the first page.
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repayments"
        subtitle="Every repayment customers have made, newest first: through Paystack, from their wallet, or taken by the team and recorded by hand."
        actions={
          <Button to="/admin/reports" variant="ghost" icon={<FileDown className="h-4 w-4" />}>
            Download
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label={filtered ? 'Repaid, matching' : 'Repaid in all'}
          value={s ? naira(s.total) : '—'}
          icon={<HandCoins />}
          tone="success"
          footnote={s ? `${formatNumber(s.count)} repayment${s.count === 1 ? '' : 's'}` : ''}
        />
        <StatTile label="Today" value={s ? naira(s.today) : '—'} icon={<CalendarDays />} footnote={s ? `${formatNumber(s.todayCount)} repayments` : ''} />
        <StatTile label="This month" value={s ? naira(s.thisMonth) : '—'} icon={<CalendarDays />} tone="info" footnote={s ? `${formatNumber(s.thisMonthCount)} repayments` : ''} />
        <StatTile
          label="Through Paystack"
          value={s ? naira(s.viaPaystack) : '—'}
          icon={<CreditCard />}
          footnote={s ? `Wallet ${naira(s.fromWallet)} · by hand ${naira(s.recordedByHand)}${s.bankTransfer ? ` · transfer ${naira(s.bankTransfer)}` : ''}` : ''}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          wrapperClassName="min-w-[240px] flex-1"
          placeholder="Search customer, customer number, reference or loan"
          value={query}
          onChange={(e) => filter(setQuery)(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
        <Input wrapperClassName="w-[170px]" label="From" type="date" value={from} max={to || undefined} onChange={(e) => filter(setFrom)(e.target.value)} />
        <Input wrapperClassName="w-[170px]" label="To" type="date" value={to} min={from || undefined} onChange={(e) => filter(setTo)(e.target.value)} />
        {filtered && (
          <Button
            variant="ghost"
            icon={<X className="h-4 w-4" />}
            onClick={() => {
              setQuery('');
              setSource('ALL');
              setFrom('');
              setTo('');
              setPage(0);
            }}
          >
            Clear
          </Button>
        )}
      </div>
      <Segmented<RepaymentSource | 'ALL'> size="sm" value={source} onChange={filter(setSource)} options={SOURCES} />

      <Card padded={false}>
        {list.isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : p?.items.length ? (
          <ul className="divide-y divide-stroke">
            {p.items.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={<HandCoins />} title={filtered ? 'Nothing matches' : 'No repayments yet'} />
        )}
      </Card>

      {p && p.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-3">
            Page {formatNumber(p.page + 1)} of {formatNumber(p.totalPages)} · {formatNumber(p.totalItems)} repayments
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={p.page === 0} onClick={() => setPage(p.page - 1)}>
              Newer
            </Button>
            <Button size="sm" variant="ghost" disabled={!p.hasNext} onClick={() => setPage(p.page + 1)}>
              Older
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ r }: { r: AdminRepayment }) {
  const st = sourceStyle[r.source];
  const Icon = st.icon;
  const loanLink = r.importedLoanId && !r.loanId ? `/admin/lending/offline/${r.importedLoanId}` : null;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <IconBadge size={36} tone={st.tone}>
        <Icon />
      </IconBadge>
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-bold">
          {r.customerId ? (
            <Link to={`/admin/customers/${r.customerId}`} className="hover:text-gold">
              {r.customerName}
            </Link>
          ) : loanLink ? (
            <Link to={loanLink} className="hover:text-gold">
              {r.customerName}
            </Link>
          ) : (
            r.customerName
          )}
          {r.customerRef && <span className="ml-2 font-mono text-[12px] text-ink-3">{r.customerRef}</span>}
        </p>
        <p className="text-[12.5px] text-ink-3">
          {r.loanPurpose ? `${r.loanPurpose} loan · ` : ''}
          {asDayTime(r.paidAt)}
          {r.reference ? ` · ${r.reference}` : ''}
          {r.recordedBy ? ` · recorded by ${r.recordedBy}` : ''}
        </p>
      </div>
      <p className="num text-base font-extrabold text-success">{naira(r.amount)}</p>
      <Pill tone={st.tone}>{r.sourceLabel}</Pill>
    </li>
  );
}
