import { Calculator, ClipboardList, CreditCard, FileClock, Plus, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState, IconBadge, Notice, Pill, ProgressBar, StatTile } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, SectionHeader } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Spinner';
import { useAction } from '../../../hooks/useAction';
import { useApplications, useEligibility, useLoans, useRefresh } from '../../../hooks/queries';
import { loansApi, officersApi } from '../../../lib/api/endpoints';
import { frequencyWord, loanRateRange, termPhrase } from '../../../lib/finance';
import { asDay, naira } from '../../../lib/format';
import { applicationTone, isLoanOpen, loanTone } from '../../../lib/labels';
import { useDialogs } from '../../../components/ui/Dialogs';
import { useSession } from '../../../state/session';
import { useSettings } from '../../../state/settings';
import type { Loan } from '../../../types/api';

export default function Loans() {
  const s = useSettings();
  const loans = useLoans();
  const applications = useApplications();
  const eligibility = useEligibility();
  const officers = useQuery({ queryKey: ['my-officers'], queryFn: officersApi.mine, enabled: useSession().stage === 'unlocked' });
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { run } = useAction();

  const all = loans.data ?? [];
  const open = all.filter((l) => isLoanOpen(l.status));
  const closed = all.filter((l) => !isLoanOpen(l.status));
  const owed = open.reduce((sum, l) => sum + l.outstanding, 0);
  const pending = (applications.data ?? []).filter((a) => a.status === 'PENDING');
  const e = eligibility.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        subtitle={`Flat rates from ${loanRateRange(s)}, over up to ${s.lending.maxTenureMonths} months.`}
        actions={
          <>
            <Button variant="ghost" to="/app/loans/calculator" icon={<Calculator className="h-4 w-4" />}>
              Calculator
            </Button>
            <Button to="/app/loans/apply" icon={<Plus className="h-4 w-4" />} disabled={!s.switches.lendingEnabled || (e && !e.eligible)}>
              Apply
            </Button>
          </>
        }
      />

      {!s.switches.lendingEnabled && <Notice tone="info">New loans are paused for now. Repayments work as normal.</Notice>}
      {e && !e.eligible && e.reason && s.switches.lendingEnabled && <Notice tone="gold" title="You cannot apply just yet">{e.reason}</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="You owe" value={naira(owed)} icon={<CreditCard />} tone={owed ? 'danger' : 'neutral'} footnote={`${open.length} open`} />
        <StatTile
          label="You can borrow"
          value={e?.eligible ? `Up to ${naira(e.maxAmount)}` : '—'}
          icon={<ShieldCheck />}
          tone="success"
          footnote={e?.eligible ? `${e.minMonths}–${e.maxMonths} months` : 'Not right now'}
        />
        <StatTile className="col-span-2 lg:col-span-1" label="Under review" value={String(pending.length)} icon={<FileClock />} tone="info" footnote="Applications" />
      </div>

      {(officers.data?.length ?? 0) > 0 && (
        <Card>
          <SectionHeader title={officers.data!.length > 1 ? 'Your loan officers' : 'Your loan officer'} />
          <div className="grid gap-3 sm:grid-cols-2">
            {officers.data!.map((o) => (
              <div key={o.email} className="flex items-center gap-3 rounded-xl border border-stroke p-3">
                <IconBadge size={40}>
                  <ShieldCheck />
                </IconBadge>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {o.name} {o.lead && <Pill className="ml-1">Lead</Pill>}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-3">
                    <a href={`mailto:${o.email}`} className="hover:text-gold">{o.email}</a>
                    {o.phone && (
                      <>
                        {' · '}
                        <a href={`tel:${o.phone}`} className="hover:text-gold">{o.phone}</a>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pending.length > 0 && (
        <section>
          <SectionHeader title="Applications" />
          <Card padded={false}>
            <ul className="divide-y divide-stroke">
              {(applications.data ?? []).slice(0, 6).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <IconBadge size={40} tone={applicationTone(a.status)}>
                    <ClipboardList />
                  </IconBadge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {naira(a.amount)} · {termPhrase(a.tenureMonths, a.repaymentFrequency)}
                    </p>
                    <p className="text-[12.5px] text-ink-3">
                      {a.purpose} · sent {asDay(a.submittedAt)}
                      {a.rejectionReason ? ` · ${a.rejectionReason}` : ''}
                    </p>
                  </div>
                  <Pill tone={applicationTone(a.status)}>{a.statusLabel}</Pill>
                  {a.status === 'PENDING' && (
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={async () => {
                        const ok = await dialogs.confirm({
                          title: 'Withdraw this application?',
                          message: 'It stops being reviewed. You can apply again later.',
                          confirmLabel: 'Withdraw',
                          danger: true,
                        });
                        if (ok) await run(async () => {
                          await loansApi.withdrawApplication(a.id);
                          await refresh.loans();
                        }, 'Application withdrawn');
                      }}
                    >
                      Withdraw
                    </Button>
                  )}
                  {a.loanId && <Button size="sm" variant="ghost" to={`/app/loans/${a.loanId}`}>View loan</Button>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <SectionHeader title="Open loans" />
        {loans.isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : open.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {open.map((l) => (
              <LoanCard key={l.id} loan={l} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<CreditCard />}
              title="No open loans"
              message="Apply in minutes. A decision usually comes within a working day."
              action={s.switches.lendingEnabled && e?.eligible ? <Button to="/app/loans/apply">Apply for a loan</Button> : undefined}
            />
          </Card>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <SectionHeader title="Past loans" />
          <div className="grid gap-3 md:grid-cols-2">
            {closed.map((l) => (
              <LoanCard key={l.id} loan={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LoanCard({ loan: l }: { loan: Loan }) {
  return (
    <Card to={`/app/loans/${l.id}`} accent={l.status === 'OVERDUE' ? 'danger' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{l.purpose}</p>
          <p className="text-[12.5px] text-ink-3">
            {naira(l.principal)} · {termPhrase(l.tenureMonths, l.repaymentFrequency)} · {l.flatRateLabel}
          </p>
        </div>
        <Pill tone={loanTone(l.status)}>{l.statusLabel}</Pill>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[12px] text-ink-3">Still owed</p>
          <p className="num text-xl font-extrabold">{naira(l.outstanding)}</p>
        </div>
        {l.nextInstallment && (
          <div className="text-right">
            <p className="text-[12px] text-ink-3">Next due {asDay(l.nextInstallment.dueDate)}</p>
            <p className="num text-sm font-bold">{naira(l.nextInstallment.outstanding)}</p>
          </div>
        )}
      </div>
      <ProgressBar className="mt-3" value={l.repaymentProgress} tone={l.status === 'REPAID' ? 'success' : l.status === 'OVERDUE' ? 'danger' : 'gold'} />
      <p className="mt-1.5 text-[11.5px] text-ink-3">
        {l.installmentsPaid} of {l.installmentCount} {frequencyWord(l.repaymentFrequency)} instalments paid
      </p>
    </Card>
  );
}
