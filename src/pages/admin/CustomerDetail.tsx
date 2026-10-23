import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Flag, MessagesSquare, ReceiptText, ShieldCheck, Snowflake, Undo2, UserRound } from 'lucide-react';
import { DocumentGrid, type DocItem } from '../../components/admin/Documents';
import { OfficersPanel } from '../../components/admin/OfficersPanel';
import { RecordRepayment } from '../../components/admin/RecordRepayment';
import { PageHeader } from '../../components/PageHeader';
import { TransactionGroups } from '../../components/TransactionList';
import { Avatar, EmptyState, Notice, Pill, ProgressBar, Segmented, StatTile } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { PageSpinner, Skeleton } from '../../components/ui/Spinner';
import { useSupportQueue } from '../../hooks/support';
import { useAction } from '../../hooks/useAction';
import { keys } from '../../hooks/queries';
import { adminApi, groupsApi } from '../../lib/api/endpoints';
import { asDay, asDayTime, formatNumber, maskLast4, naira, relative } from '../../lib/format';
import { accountTone, applicationTone, can, depositTone, loanTone, paystackTone, payoutLabel, planTone, supportTone } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { AccountStatus, Loan } from '../../types/api';
import { termPhrase } from '../../lib/finance';

type Tab = 'overview' | 'loans' | 'savings' | 'money' | 'documents' | 'support';

/**
 * Everything about one customer — every detail and every document, whether
 * they sent it themselves or an admin added it to a paper loan's file.
 */
export default function CustomerDetail() {
  const { id = '' } = useParams();
  const { adminRole, stage, isAdmin } = useSession();
  const on = stage === 'unlocked' && isAdmin && !!id;
  const [tab, setTab] = useState<Tab>('overview');
  const customer = useQuery({ queryKey: keys.admin.customer(id), queryFn: () => adminApi.customer(id), enabled: on });
  const dialogs = useDialogs();
  const qc = useQueryClient();
  const { busy, run } = useAction();

  if (customer.isLoading) return <PageSpinner />;
  const c = customer.data;
  if (!c) return <EmptyState icon={<UserRound />} title="Customer not found" action={<Button to="/admin/customers">Back</Button>} />;
  const f = c.financials;
  const manage = can.manageCustomers(adminRole);

  const setStatus = async (status: AccountStatus, title: string) => {
    const reason = await dialogs.reason({ title, message: 'Recorded in the audit log, and the customer is told.', placeholder: 'Reason', confirmLabel: title, danger: status !== 'ACTIVE' });
    if (!reason) return;
    await run(async () => {
      qc.setQueryData(keys.admin.customer(id), await adminApi.setCustomerStatus(id, status, reason));
    }, 'Status updated');
  };
  const flag = async () => {
    const reason = await dialogs.reason({ title: 'Flag for review', message: 'Flags the account for the team to look at. The customer can still use it.', confirmLabel: 'Flag' });
    if (reason) await run(async () => {
      qc.setQueryData(keys.admin.customer(id), await adminApi.flagCustomer(id, reason));
    }, 'Flagged');
  };

  return (
    <div className="space-y-6">
      <PageHeader back="/admin/customers" backLabel="Customers" title={c.fullName} subtitle={`${c.customerRef} · joined ${asDay(c.createdAt)}`} />

      <Card gradient className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={c.fullName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={accountTone(c.accountStatus)}>{c.accountStatusLabel}</Pill>
              <Pill tone="gold">{c.kycTierLabel}</Pill>
              {c.isAdmin && <Pill tone="info">Admin · {c.adminRole?.toLowerCase()}</Pill>}
            </div>
            <p className="mt-1 text-[13px] text-ink-3">
              {c.email ?? 'No email yet'} · {c.phone ?? 'No phone'} · last active {c.lastActiveAt ? relative(c.lastActiveAt) : 'never'}
            </p>
            {c.statusNote && <p className="mt-1 text-[12.5px] text-ink-2">Note: {c.statusNote}</p>}
          </div>
          {manage && (
            <div className="flex flex-wrap gap-2">
              {c.accountStatus === 'FROZEN' ? (
                <Button size="sm" variant="ghost" loading={busy} icon={<Undo2 className="h-4 w-4" />} onClick={() => void setStatus('ACTIVE', 'Unfreeze')}>
                  Unfreeze
                </Button>
              ) : (
                <Button size="sm" variant="ghost" loading={busy} icon={<Snowflake className="h-4 w-4" />} onClick={() => void setStatus('FROZEN', 'Freeze')}>
                  Freeze
                </Button>
              )}
              {c.accountStatus !== 'FLAGGED' && (
                <Button size="sm" variant="ghost" loading={busy} icon={<Flag className="h-4 w-4" />} onClick={() => void flag()}>
                  Flag
                </Button>
              )}
              {c.accountStatus === 'FLAGGED' && (
                <Button size="sm" variant="ghost" loading={busy} icon={<ShieldCheck className="h-4 w-4" />} onClick={() => void setStatus('ACTIVE', 'Clear flag')}>
                  Clear flag
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {c.accountStatus === 'PENDING_ACTIVATION' && (
        <Notice tone="info" title="Not activated yet">
          Kudi9ja opened this account for {c.fullName.split(' ')[0]}. Everything works on it — loans, schedules, repayments you record — but
          nobody can sign in yet. They take it over by signing up with the BVN on it ({c.bvnLast4 ? 'ending ' + c.bvnLast4.slice(-4) : 'on file'}),
          keeping this account number and all its history. Until then, correct their details from their loan file.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Wallet" value={naira(f.balance)} footnote={f.pendingWithdrawals ? `${naira(f.pendingWithdrawals)} withdrawing` : undefined} />
        <StatTile label="Saved" value={naira(f.totalSaved)} tone="info" footnote={`${f.activePlans} of ${f.totalPlans} plans active`} />
        <StatTile label="Owes" value={naira(f.totalOwed)} tone={f.overdueLoans ? 'danger' : 'neutral'} footnote={`${f.activeLoans} open · ${f.overdueLoans} overdue`} />
        <StatTile label="Paid in, all time" value={naira(f.totalDeposited)} tone="success" footnote={`${formatNumber(f.transactionCount)} transactions`} />
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Details' },
          { value: 'loans', label: 'Loans' },
          { value: 'savings', label: 'Savings' },
          { value: 'money', label: 'Money in & out' },
          { value: 'documents', label: 'Documents' },
          { value: 'support', label: 'Help & complaints' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionHeader title="Identity" />
            <DetailRows
              rows={[
                ['Full name', c.fullName],
                ['Date of birth', c.dateOfBirth ? asDay(c.dateOfBirth) : '—'],
                ['Gender', c.gender ?? '—'],
                ['BVN', maskLast4(c.bvnLast4)],
                ['NIN', maskLast4(c.ninLast4)],
                ['Email', c.email ? `${c.email}${c.emailVerified ? ' ✓' : ''}` : 'None yet'],
                ['Phone', `${c.phone}${c.phoneVerified ? ' ✓' : ''}`],
                ['Address', c.address ?? '—'],
                ['State', c.state ?? '—'],
              ]}
            />
          </Card>
          <div className="space-y-6">
            <OfficersPanel target={{ customerId: id }} />
            <GroupsCard id={id} />
            <Card>
              <SectionHeader title="Payout account" />
              <DetailRows
                rows={[
                  ['Bank', c.payoutBank ?? '—'],
                  ['Account', c.payoutAccountNumber ?? '—'],
                  ['Name', c.payoutAccountName ?? '—'],
                  ['Checked with the bank', c.payoutVerified ? 'Yes' : 'No'],
                ]}
              />
            </Card>
          </div>
        </div>
      )}
      {tab === 'loans' && <LoansTab id={id} />}
      {tab === 'savings' && <SavingsTab id={id} />}
      {tab === 'money' && <MoneyTab id={id} />}
      {tab === 'documents' && <DocumentsTab id={id} />}
      {tab === 'support' && <SupportTab id={id} />}
    </div>
  );
}

function useCustomerQuery<T>(name: string, id: string, fn: () => Promise<T>) {
  const { stage, isAdmin } = useSession();
  return useQuery({ queryKey: ['admin', 'customer', id, name], queryFn: fn, enabled: stage === 'unlocked' && isAdmin });
}

function LoansTab({ id }: { id: string }) {
  const loans = useCustomerQuery('loans', id, () => adminApi.customerLoans(id));
  const records = useCustomerQuery('loan-records', id, () => adminApi.customerLoanRecords(id));
  const apps = useCustomerQuery('applications', id, () => adminApi.loanApplications(undefined, 0, 200));
  const { adminRole } = useSession();
  const qc = useQueryClient();
  const [recording, setRecording] = useState<Loan | null>(null);
  const mine = (apps.data?.items ?? []).filter((a) => a.userId === id);
  const repayments = records.data?.repayments ?? [];

  return (
    <div className="space-y-6">
      {loans.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : loans.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {loans.data.map((l) => (
            <Card key={l.id} accent={l.status === 'OVERDUE' ? 'danger' : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{l.purpose}</p>
                  <p className="text-[12.5px] text-ink-3">
                    {naira(l.principal)} · {termPhrase(l.tenureMonths, l.repaymentFrequency)} · {l.flatRateLabel} · disbursed {asDay(l.disbursedAt)}
                  </p>
                </div>
                <Pill tone={loanTone(l.status)}>{l.statusLabel}</Pill>
              </div>
              <DetailRows
                className="mt-4"
                rows={[
                  ['Total to repay', naira(l.totalRepayable)],
                  { label: 'Repaid', value: naira(l.amountRepaid), tone: 'success' },
                  { label: 'Outstanding', value: naira(l.outstanding), bold: true },
                  l.nextInstallment ? ['Next due', `${naira(l.nextInstallment.outstanding)} on ${asDay(l.nextInstallment.dueDate)}`] : null,
                ]}
              />
              <ProgressBar className="mt-3" value={l.repaymentProgress} tone={l.status === 'OVERDUE' ? 'danger' : 'gold'} />
              {can.actOnLoans(adminRole) && (l.status === 'ACTIVE' || l.status === 'OVERDUE') && (
                <Button size="sm" variant="ghost" className="mt-4" onClick={() => setRecording(l)}>
                  Record a repayment received outside the app
                </Button>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ReceiptText />} title="No loans" />
        </Card>
      )}

      {repayments.length > 0 && (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader title="Repayments recorded by the team" className="mb-0" />
          </div>
          <ul className="divide-y divide-stroke">
            {repayments.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {naira(r.amount)} · {r.method.replace('_', ' ').toLowerCase()}
                  </p>
                  <p className="text-[12px] text-ink-3">
                    Received {asDay(r.paidAt)} · recorded by {r.recordedBy ?? 'the team'}
                    {r.reference ? ` · ${r.reference}` : ''}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(records.data?.importedLoans.length ?? 0) > 0 && (
        <Card>
          <SectionHeader title="Entered from paper" />
          <ul className="space-y-2">
            {records.data!.importedLoans.map((l) => (
              <li key={l.id}>
                <Link to={`/admin/lending/offline/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-stroke p-3 text-sm hover:border-gold/40">
                  <span>
                    {naira(l.principal)} · {l.purpose} · entered by {l.importedBy ?? 'the team'} {l.importedAt ? asDay(l.importedAt) : ''}
                  </span>
                  <span className="font-bold text-gold">Open file</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {mine.length > 0 && (
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader title="Applications" className="mb-0" />
          </div>
          <ul className="divide-y divide-stroke">
            {mine.map((a) => (
              <li key={a.id}>
                <Link to={`/admin/lending/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-alt/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {naira(a.amount)} · {termPhrase(a.tenureMonths, a.repaymentFrequency)} · {a.purpose}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {a.businessName} · sent {asDay(a.submittedAt)}
                    </p>
                  </div>
                  <Pill tone={applicationTone(a.status)}>{a.statusLabel}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recording && (
        <RecordRepayment
          open
          onClose={() => setRecording(null)}
          outstanding={recording.outstanding}
          onSave={async (input) => {
            await adminApi.recordOnLoan(recording.id, input);
            await qc.invalidateQueries({ queryKey: ['admin', 'customer', id] });
          }}
        />
      )}
    </div>
  );
}

function SavingsTab({ id }: { id: string }) {
  const plans = useCustomerQuery('plans', id, () => adminApi.customerPlans(id));
  if (plans.isLoading) return <Skeleton className="h-32 w-full" />;
  if (!plans.data?.length) return <Card><EmptyState icon={<ReceiptText />} title="No savings plans" /></Card>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {plans.data.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">
              {p.emoji} {p.title}
            </p>
            <Pill tone={planTone(p.status)}>{p.statusLabel}</Pill>
          </div>
          <DetailRows
            className="mt-3"
            rows={[
              ['Type', p.typeLabel],
              ['Principal', naira(p.principal)],
              p.targetAmount ? ['Goal', naira(p.targetAmount)] : null,
              ['Started', asDay(p.startDate)],
              ['Matures', asDay(p.maturityDate)],
              ['Interest / bonus', naira(p.interestPaid + p.bonusEarned)],
            ]}
          />
        </Card>
      ))}
    </div>
  );
}

function MoneyTab({ id }: { id: string }) {
  const tx = useCustomerQuery('transactions', id, () => adminApi.customerTransactions(id));
  const paystack = useCustomerQuery('paystack', id, () => adminApi.paystackPayments(undefined, 0, 50, id));
  const claims = useCustomerQuery('claims', id, () => adminApi.customerPayIns(id));
  const withdrawals = useCustomerQuery('withdrawals', id, () => adminApi.customerWithdrawals(id));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card padded={false}>
        <div className="p-5 pb-3">
          <SectionHeader title="Ledger" className="mb-0" />
        </div>
        {tx.data?.items.length ? <TransactionGroups items={tx.data.items} linkFor={() => null} /> : <p className="px-5 pb-5 text-[13px] text-ink-3">No transactions.</p>}
      </Card>
      <div className="space-y-6">
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader title="Paid in through Paystack" className="mb-0" />
          </div>
          <ul className="divide-y divide-stroke">
            {(paystack.data?.items ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {naira(p.amount)} · {p.purposeLabel}
                  </p>
                  <p className="text-[12px] text-ink-3">
                    {asDayTime(p.paidAt ?? p.createdAt)} · {p.reference}
                    {p.channel ? ` · ${p.channel}` : ''}
                    {p.fees ? ` · fee ${naira(p.fees)}` : ''}
                  </p>
                </div>
                <Pill tone={paystackTone(p.status)}>{p.statusLabel}</Pill>
              </li>
            ))}
            {!paystack.data?.items.length && <li className="px-5 pb-5 text-[13px] text-ink-3">None.</li>}
          </ul>
        </Card>
        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader title="Withdrawals" className="mb-0" />
          </div>
          <ul className="divide-y divide-stroke">
            {(withdrawals.data?.items ?? []).map((w) => {
              const st = payoutLabel(w);
              return (
                <li key={w.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {naira(w.amount)} to {w.bank} ••{w.destinationAccount.slice(-4)}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {asDayTime(w.requestedAt)} · {w.reference}
                      {w.payoutFailure ? ` · ${w.payoutFailure}` : ''}
                    </p>
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </li>
              );
            })}
            {!withdrawals.data?.items.length && <li className="px-5 pb-5 text-[13px] text-ink-3">None.</li>}
          </ul>
        </Card>
        {(claims.data?.items.length ?? 0) > 0 && (
          <Card padded={false}>
            <div className="p-5 pb-3">
              <SectionHeader title="Earlier receipt claims" className="mb-0" />
            </div>
            <ul className="divide-y divide-stroke">
              {claims.data!.items.map((cl) => (
                <li key={cl.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{naira(cl.amount)}</p>
                    <p className="text-[12px] text-ink-3">
                      {asDayTime(cl.claimedAt)} · {cl.reference}
                    </p>
                  </div>
                  <Pill tone={depositTone(cl.status)}>{cl.statusLabel}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ id }: { id: string }) {
  const records = useCustomerQuery('loan-records', id, () => adminApi.customerLoanRecords(id));
  const signatures = useCustomerQuery('signatures', id, () => adminApi.customerSignatures(id));
  const apps = useCustomerQuery('applications', id, () => adminApi.loanApplications(undefined, 0, 200));
  const appIds = useMemo(() => (apps.data?.items ?? []).filter((a) => a.userId === id).map((a) => a.id), [apps.data, id]);
  const details = useQuery({
    queryKey: ['admin', 'customer', id, 'application-docs', appIds],
    queryFn: () => Promise.all(appIds.map((a) => adminApi.loanApplication(a))),
    enabled: appIds.length > 0,
  });

  const items: DocItem[] = [];
  for (const a of details.data ?? []) {
    const note = `Application ${asDay(a.submittedAt)}`;
    if (a.bankStatement) items.push({ key: `${a.id}-st`, label: 'Bank statement', url: a.bankStatement.url, contentType: a.bankStatement.contentType, sizeBytes: a.bankStatement.sizeBytes, note: a.statementPassword ? `${note} · password: ${a.statementPassword}` : note });
    if (a.selfie) items.push({ key: `${a.id}-sf`, label: 'Selfie', url: a.selfie.url, contentType: a.selfie.contentType, sizeBytes: a.selfie.sizeBytes, note });
    a.businessPhotos.forEach((p, i) => items.push({ key: `${a.id}-bp${i}`, label: p.label || `Business photo ${i + 1}`, url: p.url, contentType: p.contentType, sizeBytes: p.sizeBytes, note }));
  }
  for (const d of records.data?.documents ?? []) {
    items.push({ key: d.id, label: d.label, url: d.url, contentType: d.contentType, sizeBytes: d.sizeBytes, note: `Added by ${d.uploadedBy ?? 'the team'}`, date: d.uploadedAt });
  }
  for (const s of signatures.data ?? []) {
    if (s.url) items.push({ key: s.id, label: `Signature — ${s.documents}`, url: s.url, contentType: 'image/png', note: `Signed as “${s.typedName}”`, date: s.signedAt });
  }

  return (
    <Card>
      <SectionHeader title="Every document on file" />
      {records.isLoading || details.isLoading ? <Skeleton className="h-40 w-full" /> : <DocumentGrid items={items} />}
    </Card>
  );
}

function GroupsCard({ id }: { id: string }) {
  const groups = useCustomerQuery('groups', id, () => groupsApi.forCustomer(id));
  if (!groups.data?.length) return null;
  return (
    <Card>
      <SectionHeader title="Loan groups" />
      <ul className="space-y-2">
        {groups.data.map((g) => (
          <li key={g.id}>
            <Link to={`/admin/groups/${g.id}`} className="flex items-center gap-3 rounded-xl border border-stroke p-3 hover:border-gold/40">
              <span className="grid h-9 w-9 place-items-center rounded-lg gold-gradient text-sm font-extrabold text-on-gold">{g.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{g.name}</span>
                <span className="block truncate text-[12px] text-ink-3">
                  {g.area ? `${g.area} · ` : ''}officer {g.officerName}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SupportTab({ id }: { id: string }) {
  const list = useSupportQueue('ALL', '', id);
  return (
    <Card padded={false}>
      {list.data?.items.length ? (
        <ul className="divide-y divide-stroke">
          {list.data.items.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/support/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-alt/50">
                <MessagesSquare className="h-5 w-5 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{c.subject}</p>
                  <p className="text-[12px] text-ink-3">
                    {c.kindLabel} · {c.reference} · {relative(c.lastMessageAt)}
                  </p>
                </div>
                {c.overdue && <Pill tone="danger">Overdue</Pill>}
                <Pill tone={supportTone(c.status)}>{c.statusLabel}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Ban />} title="No conversations" message="This customer has not contacted support." />
      )}
    </Card>
  );
}
