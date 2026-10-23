import { AlarmClock, ArrowDownLeft, ArrowUpRight, ClipboardList, CreditCard, HandCoins, MessagesSquare, PiggyBank, TrendingUp, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { IconBadge, StatTile } from '../../components/ui/Bits';
import { Card, SectionHeader } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAdminApplications, useOverview } from '../../hooks/queries';
import { useSupportSummary } from '../../hooks/support';
import { formatNumber, naira, nairaShort, relative } from '../../lib/format';
import { auditStyle } from '../../lib/labels';
import { useProfile } from '../../state/session';
import { firstName } from '../../lib/format';

export default function Overview() {
  const overview = useOverview();
  const applications = useAdminApplications('PENDING');
  const support = useSupportSummary();
  const profile = useProfile();
  if (overview.isLoading) return <PageSpinner />;
  const o = overview.data;
  if (!o) return null;
  const s = support.data;

  const queues = [
    { to: '/admin/payments', icon: <ArrowUpRight />, label: 'Withdrawals to approve', count: o.queues.pendingWithdrawals, value: o.queues.pendingWithdrawalValue, late: o.queues.withdrawalsBreachingSla },
    { to: '/admin/lending', icon: <ClipboardList />, label: 'Loan applications', count: applications.data?.totalItems ?? 0 },
    { to: '/admin/support', icon: <MessagesSquare />, label: 'Conversations waiting', count: s?.open ?? 0, late: s?.overdue ?? 0 },
    { to: '/admin/payments', icon: <ArrowDownLeft />, label: 'Older receipt claims', count: o.queues.pendingPayIns, value: o.queues.pendingPayInValue, late: o.queues.payInsBreachingSla },
  ].filter((q) => q.count > 0 || q.label !== 'Older receipt claims');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overview" title={`Good to see you, ${firstName(profile.fullName)}`} subtitle={`Updated ${relative(o.generatedAt)}`} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {queues.map((q) => (
          <Link key={q.label} to={q.to} className="rounded-2xl border border-stroke bg-surface p-4 transition hover:-translate-y-px hover:border-gold/40">
            <div className="flex items-center justify-between">
              <IconBadge size={38} tone={q.count ? 'gold' : 'neutral'}>{q.icon}</IconBadge>
              {!!q.late && (
                <span className="flex items-center gap-1 text-[12px] font-bold text-danger">
                  <AlarmClock className="h-3.5 w-3.5" /> {formatNumber(q.late)} late
                </span>
              )}
            </div>
            <p className="num mt-3 text-3xl font-extrabold">{formatNumber(q.count)}</p>
            <p className="text-[13px] text-ink-2">{q.label}</p>
            {q.value !== undefined && <p className="num text-[12px] text-ink-3">{naira(q.value)}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Customer money held" value={nairaShort(o.customerFundsHeld)} icon={<Wallet />} footnote="Wallet balances" />
        <StatTile label="Saved" value={nairaShort(o.book.totalSaved)} icon={<PiggyBank />} tone="info" footnote={`${formatNumber(o.book.activePlans)} active plans`} />
        <StatTile label="Lent" value={nairaShort(o.book.totalLent)} icon={<CreditCard />} footnote={`${formatNumber(o.book.activeLoans)} active · ${formatNumber(o.book.repaidLoans)} repaid`} />
        <Link to="/admin/repayments" className="block rounded-2xl transition hover:-translate-y-px">
          <StatTile
            className="h-full transition hover:border-gold/35"
            label="Repaid by customers"
            value={nairaShort(o.book.totalRepaid)}
            icon={<HandCoins />}
            tone="success"
            footnote={`${formatNumber(o.book.repayments)} repayments · ${nairaShort(o.book.repaidThisMonth)} this month`}
          />
        </Link>
        <StatTile label="Overdue" value={nairaShort(o.book.totalOverdue)} icon={<AlarmClock />} tone={o.book.overdueLoans ? 'danger' : 'neutral'} footnote={`${formatNumber(o.book.overdueLoans)} loans`} />
        <StatTile label="Interest charged" value={nairaShort(o.book.totalInterestCharged)} icon={<TrendingUp />} tone="success" />
        <StatTile label="Fees charged" value={nairaShort(o.book.totalFeesCharged)} icon={<TrendingUp />} tone="success" />
        <StatTile label="Interest paid out" value={nairaShort(o.book.totalInterestPaid)} icon={<PiggyBank />} />
        <StatTile label="Customers" value={formatNumber(o.people.customers)} icon={<Users />} footnote={`${formatNumber(o.people.newThisWeek)} new this week · ${formatNumber(o.people.frozenCustomers)} frozen`} />
      </div>

      <Card padded={false}>
        <div className="p-5 pb-3">
          <SectionHeader title="Recent activity" action="Audit log" actionTo="/admin/audit" className="mb-0" />
        </div>
        <ul className="divide-y divide-stroke">
          {o.recentActivity.slice(0, 12).map((a) => {
            const st = auditStyle[a.category];
            const Icon = st.icon;
            return (
              <li key={a.id} className="flex gap-3 px-5 py-3">
                <IconBadge size={34} tone={st.tone}>
                  <Icon />
                </IconBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.action}</p>
                  <p className="text-[12.5px] text-ink-3">{a.detail}</p>
                </div>
                <div className="shrink-0 text-right text-[11.5px] text-ink-3">
                  <p>{relative(a.date)}</p>
                  <p>{a.actor}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
