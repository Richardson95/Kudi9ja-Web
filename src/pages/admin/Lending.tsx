import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ClipboardList, FileX2, NotebookPen, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, Pill, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Skeleton } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { useAdminApplications, useAdminLoans, useImportedLoans, useRefresh } from '../../hooks/queries';
import { adminApi } from '../../lib/api/endpoints';
import { asDay, naira, relative } from '../../lib/format';
import { applicationTone, can, loanTone } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { LoanApplicationStatus, LoanStatus } from '../../types/api';
import { termPhrase } from '../../lib/finance';

type Tab = 'applications' | 'book' | 'offline';

export default function Lending() {
  const [tab, setTab] = useState<Tab>('applications');
  const pending = useAdminApplications('PENDING');
  const { adminRole } = useSession();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lending"
        subtitle="Applications to decide, the loan book, and loans written outside the app."
        actions={
          can.actOnLoans(adminRole) && (
            <Button to="/admin/lending/offline/new" icon={<UserPlus className="h-4 w-4" />}>
              Add loan customer
            </Button>
          )
        }
      />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'applications', label: 'Applications', count: pending.data?.totalItems },
          { value: 'book', label: 'Loan book' },
          { value: 'offline', label: 'Offline loans' },
        ]}
      />
      {tab === 'applications' && <Applications />}
      {tab === 'book' && <Book />}
      {tab === 'offline' && <Offline />}
    </div>
  );
}

function Applications() {
  const [status, setStatus] = useState<LoanApplicationStatus | 'ALL'>('PENDING');
  const list = useAdminApplications(status === 'ALL' ? undefined : status);
  return (
    <div className="space-y-4">
      <Segmented<LoanApplicationStatus | 'ALL'>
        size="sm"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'PENDING', label: 'To decide' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Declined' },
          { value: 'CANCELLED', label: 'Withdrawn' },
          { value: 'ALL', label: 'All' },
        ]}
      />
      <Card padded={false}>
        {list.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : list.data?.items.length ? (
          <ul className="divide-y divide-stroke">
            {list.data.items.map((a) => (
              <li key={a.id}>
                <Link to={`/admin/lending/applications/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-alt/50">
                  <ClipboardList className="h-5 w-5 text-gold" />
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-bold">
                      {a.customerName} <span className="ml-1 font-mono text-[12px] text-ink-3">{a.customerRef}</span>
                    </p>
                    <p className="text-[12.5px] text-ink-3">
                      {a.purpose} · {a.businessName} · {termPhrase(a.tenureMonths, a.repaymentFrequency)} · sent {relative(a.submittedAt)}
                      {a.reviewedBy ? ` · by ${a.reviewedBy}` : ''}
                    </p>
                  </div>
                  <p className="num font-extrabold">{naira(a.amount)}</p>
                  <Pill tone={applicationTone(a.status)}>{a.statusLabel}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<ClipboardList />} title="Nothing here" />
        )}
      </Card>
    </div>
  );
}

function Book() {
  const [status, setStatus] = useState<LoanStatus | 'ALL'>('ACTIVE');
  const list = useAdminLoans(status === 'ALL' ? undefined : status);
  const { adminRole } = useSession();
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { busy, run } = useAction();
  const act = can.actOnLoans(adminRole);
  return (
    <div className="space-y-4">
      <Segmented<LoanStatus | 'ALL'>
        size="sm"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'ACTIVE', label: 'Active' },
          { value: 'OVERDUE', label: 'Overdue' },
          { value: 'REPAID', label: 'Repaid' },
          { value: 'WRITTEN_OFF', label: 'Written off' },
          { value: 'ALL', label: 'All' },
        ]}
      />
      <Card padded={false} className="overflow-x-auto">
        {list.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : list.data?.items.length ? (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-stroke text-[12px] uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-3 font-semibold">Borrower</th>
                <th className="px-4 py-3 font-semibold">Loan</th>
                <th className="px-4 py-3 text-right font-semibold">Repaid</th>
                <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {list.data.items.map((l) => (
                <tr key={l.loanId} className="hover:bg-surface-alt/50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/customers/${l.customerId}`} className="font-bold hover:text-gold">{l.customerName}</Link>
                    <span className="block font-mono text-[12px] text-ink-3">{l.customerRef}</span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px]">
                    {naira(l.principal)} · {termPhrase(l.tenureMonths, l.repaymentFrequency)} · {l.purpose}
                    <span className="block text-ink-3">due {asDay(l.dueDate)}</span>
                  </td>
                  <td className="num px-4 py-3 text-right text-success">{naira(l.amountRepaid)}</td>
                  <td className="num px-4 py-3 text-right font-bold">{naira(l.outstanding)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={loanTone(l.status)}>{l.daysOverdue > 0 ? `${l.daysOverdue} days late` : l.statusLabel}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {act && (l.status === 'ACTIVE' || l.status === 'OVERDUE') && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="subtle" disabled={busy} icon={<BellRing className="h-4 w-4" />} onClick={() => void run(async () => {
                          await adminApi.remindBorrower(l.loanId);
                        }, 'Reminder sent')}>
                          Remind
                        </Button>
                        {l.status === 'OVERDUE' && (
                          <Button size="sm" variant="subtle" disabled={busy} icon={<FileX2 className="h-4 w-4" />} onClick={async () => {
                            const reason = await dialogs.reason({
                              title: 'Write off this loan',
                              message: `${naira(l.outstanding)} stops being collected through the app. This is recorded and cannot be undone here.`,
                              confirmLabel: 'Write off',
                              danger: true,
                            });
                            if (reason) await run(async () => {
                              await adminApi.writeOffLoan(l.loanId, reason);
                              await refresh.admin();
                            }, 'Written off');
                          }}>
                            Write off
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={<ClipboardList />} title="No loans here" />
        )}
      </Card>
    </div>
  );
}

function Offline() {
  const list = useImportedLoans();
  const items = list.data ?? [];
  return (
    <Card padded={false}>
      {list.isLoading ? (
        <Skeleton className="m-4 h-24" />
      ) : items.length ? (
        <ul className="divide-y divide-stroke">
          {items.map((l) => (
            <li key={l.id}>
              <Link to={`/admin/lending/offline/${l.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-alt/50">
                <NotebookPen className="h-5 w-5 text-gold" />
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-bold">{l.fullName}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {naira(l.principal)} · {termPhrase(l.tenureMonths, l.repaymentFrequency, l.installmentCount)} · {l.purpose} · entered {l.importedAt ? asDay(l.importedAt) : ''} by {l.importedBy ?? 'the team'}
                  </p>
                </div>
                <p className="num text-sm font-bold">{naira(l.outstanding)} owed</p>
                <Pill tone={l.claimed ? 'success' : 'info'}>{l.claimed ? 'Signed up' : 'Not signed up'}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<NotebookPen />}
          title="No offline loans"
          message="Enter a loan written on paper, with the borrower's details and documents. When they sign up with the same BVN, it attaches to their account."
          action={<Button to="/admin/lending/offline/new">Add loan customer</Button>}
        />
      )}
    </Card>
  );
}
