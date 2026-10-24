import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, FilePlus2, Plus, Save, Trash2, X } from 'lucide-react';
import { OfficerChecklist, useOfficerOptions } from '../../components/admin/OfficersPanel';
import { METHODS } from '../../components/admin/RecordRepayment';
import { PageHeader } from '../../components/PageHeader';
import { Notice, Pill, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useAction } from '../../hooks/useAction';
import { keys, useBanks, useRefresh } from '../../hooks/queries';
import { adminApi, groupsApi } from '../../lib/api/endpoints';
import {
  buildSchedule,
  eachInstalment,
  instalmentCount,
  processingFee as managementFeeFor,
  feeRateLabel,
  repaymentFeeRate as repaymentFeeRateFor,
} from '../../lib/finance';
import { useSettings } from '../../state/settings';
import { asDay, fileSize, formatAmountInput, isoDate, naira, parseAmount } from '../../lib/format';
import { GENDERS, LOAN_PURPOSES, NIGERIAN_STATES } from '../../lib/validators';
import { useSession } from '../../state/session';
import type { OfflineGuarantor, RepaymentFrequency, RepaymentMethod } from '../../types/api';

const MAX_BYTES = 12 * 1024 * 1024;

/** One repayment made before the loan was entered, as the admin types it. */
interface PastPayment {
  paidOn: string;
  amount: string;
  method: RepaymentMethod;
}
const DOC_LABELS = ['Loan agreement', 'Bank statement', 'ID card', 'Passport photo', 'Utility bill', 'Business photo', 'Guarantor form', 'Other'];

interface PendingDoc {
  file: File;
  label: string;
}

/**
 * Enters a loan written outside the app, with everything known about the
 * borrower. They appear among customers as "not signed up"; when they sign up
 * with the same BVN, the loan, its file and its officers attach to their account.
 */
export default function NewOfflineLoan() {
  const navigate = useNavigate();
  const toast = useToast();
  const refresh = useRefresh();
  const banks = useBanks();
  const officers = useOfficerOptions();
  const { profile } = useSession();
  const [params] = useSearchParams();
  const groupId = params.get('group') ?? undefined;
  const group = useQuery({ queryKey: ['admin', 'groups', groupId ?? ''], queryFn: () => groupsApi.detail(groupId!), enabled: !!groupId });
  const g = group.data?.group;
  const { busy, run } = useAction();

  const [f, setF] = useState({
    bvn: '', fullName: '', email: '', phone: '', nin: '', dateOfBirth: '', gender: '', address: '', state: '', occupation: '',
    businessName: '', businessAddress: '', monthlyIncome: '',
    principal: '', tenureMonths: '6', ratePct: '25', processingFee: '', payoutFee: '', feePct: '', purpose: '', disbursedAt: isoDate(new Date()),
    payoutBank: '', payoutAccountNumber: '', notes: '',
  });
  const [payments, setPayments] = useState<PastPayment[]>([]);

  // Another loan for somebody already on the system — opened from their
  // profile, or found by the BVN typed here. It goes on their account, and who
  // they are stays as their account has it.
  const customerId = params.get('customer') ?? undefined;
  const known = useQuery({ queryKey: keys.admin.customer(customerId ?? ''), queryFn: () => adminApi.customer(customerId!), enabled: !!customerId });
  const lookup = useQuery({
    queryKey: ['admin', 'bvn-lookup', f.bvn],
    queryFn: () => adminApi.lookupBvn(f.bvn),
    enabled: !customerId && /^\d{11}$/.test(f.bvn),
  });
  const existing = customerId
    ? known.data
      ? {
          id: known.data.id,
          fullName: known.data.fullName,
          customerRef: known.data.customerRef,
          running: known.data.financials.activeLoans + known.data.financials.overdueLoans > 0,
        }
      : null
    : lookup.data?.found && lookup.data.customerId
      ? { id: lookup.data.customerId, fullName: lookup.data.fullName ?? '', customerRef: lookup.data.customerRef ?? '', running: lookup.data.hasRunningLoan }
      : null;
  const [chosen, setChosen] = useState<RepaymentFrequency | null>('MONTHLY');
  const frequency: RepaymentFrequency = chosen ?? 'MONTHLY';
  const [guarantors, setGuarantors] = useState<OfflineGuarantor[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [docLabel, setDocLabel] = useState(DOC_LABELS[0]!);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const base = useSettings();
  // Entered into a group: the group's terms start the fee boxes.
  const settings = g ? { ...base, lending: base.groupLending } : base;
  const offered = (['WEEKLY', 'MONTHLY'] as RepaymentFrequency[]).filter((f) =>
    f === 'WEEKLY' ? settings.lending.weeklyAllowed !== false : settings.lending.monthlyAllowed !== false,
  );
  // The fees start at today's rules — management fee by amount, the flat
  // transaction fee — and the admin corrects them to what was actually taken.
  const [feesTouched, setFeesTouched] = useState({ management: false, transaction: false });
  const setPrincipal = (v: string) => {
    const amount = parseAmount(v);
    setF((o) => ({
      ...o,
      principal: v,
      processingFee: feesTouched.management ? o.processingFee : amount > 0 ? formatAmountInput(String(Math.round(managementFeeFor(settings, amount)))) : '',
    }));
  };

  const principal = parseAmount(f.principal);
  const months = Number(f.tenureMonths) || 0;
  const rate = (Number(f.ratePct) || 0) / 100;
  const feeRate = !feesTouched.transaction ? repaymentFeeRateFor(settings) : (Number(f.feePct) || 0) / 100;
  const repaid = payments.reduce((sum, p) => sum + parseAmount(p.amount), 0);
  const payoutDay = new Date(`${f.disbursedAt}T12:00:00`);
  const schedule = principal > 0 && months > 0 ? buildSchedule(principal, rate, months, payoutDay, repaid, undefined, frequency, { feeRate }) : [];
  const count = schedule.length || instalmentCount(frequency, months, payoutDay);
  const loanTotal = schedule.reduce((sum, r) => sum + r.base, 0);
  const fees = schedule.reduce((sum, r) => sum + r.fee, 0);
  const owed = loanTotal + fees;
  const outstanding = Math.max(owed - repaid, 0);
  const today = isoDate(new Date());
  const lastPaid = payments.reduce((last, p) => (p.paidOn > last ? p.paidOn : last), '');
  const closed = owed > 0 && outstanding <= 0.005;
  const paymentError = (p: PastPayment) =>
    !p.paidOn ? 'Enter the day' : p.paidOn > today ? 'Not yet come' : p.paidOn < f.disbursedAt ? 'Before the payout' : parseAmount(p.amount) <= 0 ? 'Enter the amount' : null;

  // Both come off the payout: the management fee, and an older loan's flat fee.
  const takenAtPayout = parseAmount(f.processingFee) + parseAmount(f.payoutFee);

  const errors = {
    bvn: !existing?.id && f.bvn && !/^\d{11}$/.test(f.bvn) ? 'Eleven digits' : null,
    nin: f.nin && !/^\d{11}$/.test(f.nin) ? 'Eleven digits' : null,
    account: f.payoutAccountNumber && !/^\d{10}$/.test(f.payoutAccountNumber) ? 'Ten digits' : null,
    repaid: repaid > owed + 0.005 && owed > 0 ? `More than the ${naira(owed)} owed` : null,
    fee: takenAtPayout >= principal && principal > 0 ? 'The fees cannot be as much as the loan' : null,
    feePct: feeRate < 0 || feeRate > 0.2 ? 'Between 0% and 20%' : null,
    payments: payments.some((p) => paymentError(p)) ? 'Check the repayments' : null,
    running: existing?.running && !closed && owed > 0 ? 'Already has a running loan' : null,
  };
  const who = existing ? true : /^\d{11}$/.test(f.bvn) && f.fullName.trim().split(/\s+/).length >= 2;
  const valid =
    who && (!customerId || !!existing) && principal > 0 && months >= 1 && months <= 60 &&
    rate > 0 && rate <= 3 && !!chosen && !!f.purpose && !!f.disbursedAt && f.disbursedAt <= today && Object.values(errors).every((e) => !e) &&
    guarantors.every((g) => g.fullName.trim());

  const setPayment = (i: number, patch: Partial<PastPayment>) => setPayments((all) => all.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  // Every instalment already due, as paid on its day — then correct the ones that were not.
  const fillFromSchedule = () => {
    const plan = principal > 0 && months > 0 ? buildSchedule(principal, rate, months, payoutDay, 0, undefined, frequency, { feeRate }) : [];
    setPayments(
      plan
        .filter((r) => isoDate(r.dueDate) <= today)
        .map((r) => ({ paidOn: isoDate(r.dueDate), amount: formatAmountInput(String(Math.round(r.amount))), method: 'CASH' as RepaymentMethod })),
    );
  };

  const addDocs = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 12MB.`);
        continue;
      }
      setDocs((d) => [...d, { file, label: docLabel }]);
    }
  };

  const submit = async () => {
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    const created = await run(async () => {
      const loan = await adminApi.importLoan({
        ...(existing ? { customerId: existing.id } : { bvn: f.bvn, fullName: f.fullName.trim() }),
        email: existing ? undefined : opt(f.email),
        phone: existing ? undefined : opt(f.phone),
        principal,
        tenureMonths: months,
        repaymentFrequency: frequency,
        repaymentFeeRate: feeRate,
        flatRate: rate,
        processingFee: parseAmount(f.processingFee) || undefined,
        transactionFee: parseAmount(f.payoutFee) || undefined,
        purpose: f.purpose,
        disbursedAt: new Date(`${f.disbursedAt}T12:00:00`).toISOString(),
        // Midday, so no time zone moves the day.
        repayments: payments.map((p) => ({ amount: parseAmount(p.amount), paidAt: new Date(`${p.paidOn}T12:00:00`).toISOString(), method: p.method })),
        ...(existing
          ? {}
          : {
              nin: opt(f.nin),
              dateOfBirth: opt(f.dateOfBirth),
              gender: opt(f.gender),
              address: opt(f.address),
              state: opt(f.state),
              payoutBank: opt(f.payoutBank),
              payoutAccountNumber: opt(f.payoutAccountNumber),
            }),
        occupation: opt(f.occupation),
        businessName: opt(f.businessName),
        businessAddress: opt(f.businessAddress),
        monthlyIncome: parseAmount(f.monthlyIncome) || undefined,
        notes: opt(f.notes),
        guarantors: guarantors.map((g) => Object.fromEntries(Object.entries(g).filter(([, v]) => typeof v === 'string' && v.trim())) as unknown as OfflineGuarantor),
        officerIds: picked,
        groupId,
      });
      let failed = 0;
      for (const d of docs) {
        try {
          await adminApi.attachToImport(loan.id, d.file, d.label);
        } catch {
          failed++;
        }
      }
      if (failed) toast.error(`${failed} document${failed > 1 ? 's' : ''} did not upload. Add ${failed > 1 ? 'them' : 'it'} again from the loan file.`);
      return loan;
    }, () => (existing ? `Loan added to ${existing.fullName}'s account` : 'Loan customer added'));
    if (created) {
      await refresh.admin();
      navigate(
        groupId ? `/admin/groups/${groupId}` : existing ? `/admin/customers/${existing.id}` : `/admin/lending/offline/${created.id}`,
        { replace: true },
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={groupId ? `/admin/groups/${groupId}` : customerId ? `/admin/customers/${customerId}` : '/admin/customers'}
        backLabel={g ? `Group ${g.number}` : customerId ? (known.data?.fullName ?? 'Customer') : 'Customers'}
        eyebrow={g ? `Group ${g.number} · ${g.name}` : undefined}
        title={g ? 'Add a borrower to the group' : customerId ? `Add a loan for ${known.data?.fullName ?? 'this customer'}` : 'Add a loan customer'}
        subtitle={
          customerId
            ? 'A loan given outside the app — one already repaid, or the one running now. Enter each loan on its own.'
            : 'For a loan given outside the app, running or already repaid. They can sign up later and find it waiting.'
        }
      />
      {g && !g.canManage && <Notice tone="danger">Only {g.officerName}, an owner or an administrator can add borrowers to this group.</Notice>}
      {existing ? (
        <Notice tone="info" title={`${existing.fullName} · ${existing.customerRef}`}>
          {customerId ? 'This loan goes on their account.' : 'That BVN is already a customer, so this loan goes on their account instead of opening a new one.'} Their
          details stay as their account has them.{' '}
          {existing.running
            ? 'They have a running loan already, and a customer has one running loan at a time — so this one must be entered with its repayments up to the full amount, as closed.'
            : ''}{' '}
          <Link to={`/admin/customers/${existing.id}`} className="font-bold underline">Open their profile</Link>
        </Notice>
      ) : (
        <Notice tone="neutral">
          The BVN is what joins this to their account when they sign up, so check it carefully. Everything else can be corrected later until they do. A
          customer with several loans is entered once: add the others from their profile.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!customerId && (
            <Section title="Borrower">
              <Grid>
                <Input label="BVN *" inputMode="numeric" maxLength={11} value={f.bvn} onChange={(e) => set('bvn')(e.target.value.replace(/\D/g, ''))} error={errors.bvn} />
                {!existing && <Input label="Full name *" value={f.fullName} onChange={(e) => set('fullName')(e.target.value)} />}
              </Grid>
              {!existing && (
                <Grid>
                  <Input label="Email" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} />
                  <Input label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone')(e.target.value)} />
                  <Input label="NIN" inputMode="numeric" maxLength={11} value={f.nin} onChange={(e) => set('nin')(e.target.value.replace(/\D/g, ''))} error={errors.nin} />
                  <Input label="Date of birth" type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth')(e.target.value)} />
                  <Select label="Gender" placeholder="—" value={f.gender} onChange={(e) => set('gender')(e.target.value)} options={GENDERS} />
                  <Input label="Occupation" value={f.occupation} onChange={(e) => set('occupation')(e.target.value)} />
                  <Input label="Home address" value={f.address} onChange={(e) => set('address')(e.target.value)} />
                  <Select label="State" placeholder="—" value={f.state} onChange={(e) => set('state')(e.target.value)} options={NIGERIAN_STATES} />
                </Grid>
              )}
            </Section>
          )}

          <Section title="Business">
            <Grid>
              <Input label="Business name" value={f.businessName} onChange={(e) => set('businessName')(e.target.value)} />
              <Input label="Monthly income (₦)" inputMode="numeric" value={f.monthlyIncome} onChange={(e) => set('monthlyIncome')(formatAmountInput(e.target.value))} />
            </Grid>
            <Input label="Business address" value={f.businessAddress} onChange={(e) => set('businessAddress')(e.target.value)} />
          </Section>

          <Section title="The loan">
            <Grid>
              <Input label="Amount lent (₦) *" inputMode="numeric" value={f.principal} onChange={(e) => setPrincipal(formatAmountInput(e.target.value))} />
              <Select label="Purpose *" placeholder="Choose" value={f.purpose} onChange={(e) => set('purpose')(e.target.value)} options={LOAN_PURPOSES} />
              <Input label="Months to repay *" type="number" min={1} max={60} value={f.tenureMonths} onChange={(e) => set('tenureMonths')(e.target.value)} />
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Repaid *</span>
                <Segmented<RepaymentFrequency | ''>
                  value={chosen ?? ''}
                  onChange={(v) => v && setChosen(v)}
                  options={offered.map((f) => ({ value: f, label: f === 'WEEKLY' ? 'Weekly' : 'Monthly' }))}
                />
                <p className="mt-1.5 text-[12px] text-ink-3">
                  {chosen ? (months > 0 ? `${count} ${chosen === 'WEEKLY' ? `weekly payments over ${count} weeks (${months} month${months === 1 ? '' : 's'})` : 'monthly payments'}` : '') : 'Choose weekly or monthly.'}
                </p>
              </div>
              <Input label="Flat interest, % of the loan *" type="number" min={0} step="0.5" value={f.ratePct} onChange={(e) => set('ratePct')(e.target.value)} hint="Charged once over the whole term" />
              <Input
                label="Management fee charged (₦)"
                inputMode="numeric"
                value={f.processingFee}
                onChange={(e) => {
                  setFeesTouched((t) => ({ ...t, management: true }));
                  set('processingFee')(formatAmountInput(e.target.value));
                }}
                error={errors.fee}
                hint="What was actually taken. Starts at today's rule."
              />
              <Input
                label="Flat fee taken at payout (₦)"
                inputMode="numeric"
                value={f.payoutFee}
                onChange={(e) => set('payoutFee')(formatAmountInput(e.target.value))}
                hint="Older loans only, like the old ₦2,000 fee. Leave empty if none. Set the fee on each repayment below to 0 if that loan had none."
              />
              <Input
                label="Transaction fee on each repayment (%)"
                type="number"
                min={0}
                max={20}
                step="0.5"
                value={!feesTouched.transaction ? String(Math.round(repaymentFeeRateFor(settings) * 10000) / 100) : f.feePct}
                onChange={(e) => {
                  setFeesTouched((t) => ({ ...t, transaction: true }));
                  set('feePct')(e.target.value);
                }}
                error={errors.feePct}
                hint="Added to every instalment, rounded up to the naira. Starts at today's rate; type 0 if none was charged."
              />
              <Input label="Date paid out *" type="date" max={today} value={f.disbursedAt} onChange={(e) => set('disbursedAt')(e.target.value)} />
            </Grid>
          </Section>

          <Section
            title={`Repayments made (${payments.length})`}
            action={
              <div className="flex flex-wrap gap-2">
                {payments.length === 0 && schedule.length > 0 && (
                  <Button size="sm" variant="ghost" icon={<CalendarCheck className="h-4 w-4" />} onClick={fillFromSchedule}>
                    Fill in from the schedule
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setPayments((all) => [...all, { paidOn: '', amount: '', method: all[all.length - 1]?.method ?? 'CASH' }])}
                >
                  Add repayment
                </Button>
              </div>
            }
          >
            <p className="text-[13px] text-ink-2">
              Each payment on the day it was made. A loan whose payments reach the full {owed > 0 ? naira(owed) : 'amount'} is closed on the day of the last
              one; otherwise it is running. {payments.length === 0 && 'None added: nothing has been repaid yet.'}
            </p>
            {payments.length > 0 && (
              <ul className="space-y-2">
                {payments.map((p, i) => {
                  const err = paymentError(p);
                  return (
                    <li key={i} className="grid items-start gap-3 rounded-xl border border-stroke p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto]">
                      <span className="pt-3 text-[13px] font-bold text-ink-3">#{i + 1}</span>
                      <Input label="Day paid *" type="date" min={f.disbursedAt} max={today} value={p.paidOn} onChange={(e) => setPayment(i, { paidOn: e.target.value })} error={err && err !== 'Enter the amount' ? err : null} />
                      <Input label="Amount (₦) *" inputMode="numeric" value={p.amount} onChange={(e) => setPayment(i, { amount: formatAmountInput(e.target.value) })} error={err === 'Enter the amount' ? err : null} />
                      <Select label="How" value={p.method} onChange={(e) => setPayment(i, { method: e.target.value as RepaymentMethod })} options={METHODS} />
                      <button type="button" onClick={() => setPayments((all) => all.filter((_, j) => j !== i))} className="pt-9 text-ink-3 hover:text-danger" aria-label="Remove repayment">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {errors.repaid && <p className="text-[13px] font-semibold text-danger">The repayments add up to {naira(repaid)}, more than the {naira(owed)} owed.</p>}
            {errors.running && (
              <p className="text-[13px] font-semibold text-danger">
                {existing?.fullName} already has a running loan, so this one has to be entered as closed: add its repayments up to {naira(owed)}.
              </p>
            )}
          </Section>

          {!existing && (
            <Section title="Payout account">
              <Grid>
                <Select label="Bank" placeholder="—" value={f.payoutBank} onChange={(e) => set('payoutBank')(e.target.value)} options={banks.data ?? []} />
                <Input label="Account number" inputMode="numeric" maxLength={10} value={f.payoutAccountNumber} onChange={(e) => set('payoutAccountNumber')(e.target.value.replace(/\D/g, ''))} error={errors.account} />
              </Grid>
            </Section>
          )}

          <Section
            title={`Guarantors (${guarantors.length} of 4)`}
            action={guarantors.length < 4 ? <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setGuarantors((g) => [...g, { fullName: '' }])}>Add guarantor</Button> : undefined}
          >
            {guarantors.length === 0 && <p className="text-[13px] text-ink-3">None added.</p>}
            {guarantors.map((g, i) => {
              const sg = (k: keyof OfflineGuarantor) => (v: string) => setGuarantors((all) => all.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <div key={i} className="space-y-3 rounded-xl border border-stroke p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Guarantor {i + 1}</p>
                    <button type="button" onClick={() => setGuarantors((all) => all.filter((_, j) => j !== i))} className="text-ink-3 hover:text-danger" aria-label="Remove guarantor">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Grid>
                    <Input label="Full name *" value={g.fullName} onChange={(e) => sg('fullName')(e.target.value)} />
                    <Input label="Phone" value={g.phone ?? ''} onChange={(e) => sg('phone')(e.target.value)} />
                    <Input label="Relationship" value={g.relationship ?? ''} onChange={(e) => sg('relationship')(e.target.value)} />
                    <Input label="BVN" inputMode="numeric" maxLength={11} value={g.bvn ?? ''} onChange={(e) => sg('bvn')(e.target.value.replace(/\D/g, ''))} />
                    <Input label="Address" value={g.address ?? ''} onChange={(e) => sg('address')(e.target.value)} />
                    <Select label="State" placeholder="—" value={g.state ?? ''} onChange={(e) => sg('state')(e.target.value)} options={NIGERIAN_STATES} />
                    <Input label="Local government" value={g.localGovernment ?? ''} onChange={(e) => sg('localGovernment')(e.target.value)} />
                    <Input label="Landmark" value={g.landmark ?? ''} onChange={(e) => sg('landmark')(e.target.value)} />
                    <Input label="Occupation" value={g.occupation ?? ''} onChange={(e) => sg('occupation')(e.target.value)} />
                    <Input label="Email" type="email" value={g.email ?? ''} onChange={(e) => sg('email')(e.target.value)} />
                  </Grid>
                </div>
              );
            })}
          </Section>

          <Section title="Documents">
            <div className="flex flex-wrap items-end gap-3">
              <Select label="What is it?" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} options={DOC_LABELS} />
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-gold/50 px-4 text-sm font-bold text-gold hover:bg-gold/10">
                <FilePlus2 className="h-4 w-4" /> Choose files
                <input type="file" multiple className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => {
                  addDocs(e.target.files);
                  e.target.value = '';
                }} />
              </label>
            </div>
            {docs.length > 0 && (
              <ul className="space-y-2">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-stroke px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      <b>{d.label}</b> · {d.file.name} · {fileSize(d.file.size)}
                    </span>
                    <button type="button" onClick={() => setDocs((all) => all.filter((_, j) => j !== i))} className="text-ink-3 hover:text-danger" aria-label="Remove">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[12px] text-ink-3">Photos, PDFs, Word or Excel, up to 12MB each. Uploaded when you save; more can be added from the loan file later.</p>
          </Section>

          <Section title="Notes">
            <Textarea value={f.notes} onChange={(e) => set('notes')(e.target.value)} rows={3} maxLength={2000} placeholder="Anything the team should know" />
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeader title={g ? 'Other loan officers (optional)' : 'Loan officers'} />
            {g && <p className="mb-3 text-[13px] text-ink-2">{g.officerName} runs this group and leads on every borrower in it.</p>}
            <OfficerChecklist options={officers.data ?? []} picked={picked} onChange={setPicked} loading={officers.isLoading} />
            <p className="mt-3 text-[12px] text-ink-3">
              {g ? 'Anyone chosen here supports the group officer.' : picked.length ? 'The first one chosen leads.' : `None chosen: you (${profile?.fullName ?? 'whoever saves this'}) become the loan officer.`}
            </p>
          </Card>

          <Card gradient className="sticky top-6 space-y-4">
            <SectionHeader title="Summary" />
            <DetailRows
              rows={[
                ['Lent', naira(principal)],
                ['Management fee', `- ${naira(parseAmount(f.processingFee))}`],
                parseAmount(f.payoutFee) > 0 ? ['Flat fee at payout', `- ${naira(parseAmount(f.payoutFee))}`] : null,
                { label: 'Paid out to the borrower', value: naira(Math.max(principal - takenAtPayout, 0)), tone: 'gold' },
                ['Interest', naira(Math.max(loanTotal - principal, 0))],
                ['Loan and interest', naira(loanTotal)],
                [`Transaction fees (${feeRateLabel(feeRate)} of each repayment)`, naira(fees)],
                ['Total to repay', naira(owed)],
                [eachInstalment(frequency), schedule[0] ? `${naira(schedule[0].amount)} (${naira(schedule[0].base)} + ${naira(schedule[0].fee)} fee)` : naira(0)],
                { label: `Repaid (${payments.length} payment${payments.length === 1 ? '' : 's'})`, value: naira(repaid), tone: 'success' },
                { label: 'Outstanding', value: naira(outstanding), bold: true },
                schedule.length ? ['Last payment due', asDay(schedule[schedule.length - 1]!.dueDate)] : null,
              ]}
            />
            {owed > 0 && (
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-ink-3">This loan</span>
                {closed ? (
                  <Pill tone="success">Closed{lastPaid ? ` on ${asDay(`${lastPaid}T12:00:00`)}` : ''}</Pill>
                ) : (
                  <Pill tone="info">Running</Pill>
                )}
              </div>
            )}
            <Button block size="lg" loading={busy} disabled={!valid} icon={<Save className="h-4 w-4" />} onClick={() => void submit()}>
              {g ? `Add to Group ${g.number}` : existing ? 'Save this loan' : 'Save loan customer'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
