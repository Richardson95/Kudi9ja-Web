import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2, Plus, Save, Trash2, X } from 'lucide-react';
import { OfficerChecklist, useOfficerOptions } from '../../components/admin/OfficersPanel';
import { PageHeader } from '../../components/PageHeader';
import { Notice, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useAction } from '../../hooks/useAction';
import { useBanks, useRefresh } from '../../hooks/queries';
import { adminApi, groupsApi } from '../../lib/api/endpoints';
import {
  buildSchedule,
  eachInstalment,
  instalmentCount,
  instalmentsPhrase,
  processingFee as managementFeeFor,
  transactionFee as transactionFeeFor,
} from '../../lib/finance';
import { useSettings } from '../../state/settings';
import { asDay, fileSize, formatAmountInput, isoDate, naira, parseAmount } from '../../lib/format';
import { GENDERS, LOAN_PURPOSES, NIGERIAN_STATES } from '../../lib/validators';
import { useSession } from '../../state/session';
import type { OfflineGuarantor, RepaymentFrequency } from '../../types/api';

const MAX_BYTES = 12 * 1024 * 1024;
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
    principal: '', tenureMonths: '6', ratePct: '25', processingFee: '', transactionFee: '', purpose: '', disbursedAt: isoDate(new Date()), amountRepaid: '',
    payoutBank: '', payoutAccountNumber: '', notes: '',
  });
  const [frequency, setFrequency] = useState<RepaymentFrequency>('MONTHLY');
  const [guarantors, setGuarantors] = useState<OfflineGuarantor[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [docLabel, setDocLabel] = useState(DOC_LABELS[0]!);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const settings = useSettings();
  // The fees start at today's rules — management fee by amount, the flat
  // transaction fee — and the admin corrects them to what was actually taken.
  const [feesTouched, setFeesTouched] = useState({ management: false, transaction: false });
  const setPrincipal = (v: string) => {
    const amount = parseAmount(v);
    setF((o) => ({
      ...o,
      principal: v,
      processingFee: feesTouched.management ? o.processingFee : amount > 0 ? formatAmountInput(String(Math.round(managementFeeFor(settings, amount)))) : '',
      transactionFee: feesTouched.transaction ? o.transactionFee : amount > 0 ? formatAmountInput(String(transactionFeeFor(settings))) : '',
    }));
  };

  const principal = parseAmount(f.principal);
  const months = Number(f.tenureMonths) || 0;
  const rate = (Number(f.ratePct) || 0) / 100;
  const total = principal * (1 + rate);
  const repaid = parseAmount(f.amountRepaid);
  const schedule = principal > 0 && months > 0 ? buildSchedule(principal, rate, months, new Date(`${f.disbursedAt}T12:00:00`), repaid, undefined, frequency) : [];
  const count = instalmentCount(frequency, months);

  const errors = {
    bvn: f.bvn && !/^\d{11}$/.test(f.bvn) ? 'Eleven digits' : null,
    nin: f.nin && !/^\d{11}$/.test(f.nin) ? 'Eleven digits' : null,
    account: f.payoutAccountNumber && !/^\d{10}$/.test(f.payoutAccountNumber) ? 'Ten digits' : null,
    repaid: repaid > total ? `More than the ${naira(total)} owed` : null,
    fee: parseAmount(f.processingFee) + parseAmount(f.transactionFee) >= principal && principal > 0 ? 'The fees cannot be as much as the loan' : null,
  };
  const valid =
    /^\d{11}$/.test(f.bvn) && f.fullName.trim().split(/\s+/).length >= 2 && principal > 0 && months >= 1 && months <= 60 &&
    rate > 0 && rate <= 3 && !!f.purpose && !!f.disbursedAt && Object.values(errors).every((e) => !e) &&
    guarantors.every((g) => g.fullName.trim());

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
        bvn: f.bvn,
        fullName: f.fullName.trim(),
        email: opt(f.email),
        phone: opt(f.phone),
        principal,
        tenureMonths: months,
        repaymentFrequency: frequency,
        flatRate: rate,
        processingFee: parseAmount(f.processingFee) || undefined,
        transactionFee: parseAmount(f.transactionFee) || undefined,
        purpose: f.purpose,
        disbursedAt: new Date(`${f.disbursedAt}T12:00:00`).toISOString(),
        amountRepaid: repaid || undefined,
        nin: opt(f.nin),
        dateOfBirth: opt(f.dateOfBirth),
        gender: opt(f.gender),
        address: opt(f.address),
        state: opt(f.state),
        occupation: opt(f.occupation),
        businessName: opt(f.businessName),
        businessAddress: opt(f.businessAddress),
        monthlyIncome: parseAmount(f.monthlyIncome) || undefined,
        payoutBank: opt(f.payoutBank),
        payoutAccountNumber: opt(f.payoutAccountNumber),
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
    }, (l) => (l.claimed ? `${l.fullName} already has an account — the loan is on it now` : 'Loan customer added'));
    if (created) {
      await refresh.admin();
      navigate(groupId ? `/admin/groups/${groupId}` : `/admin/lending/offline/${created.id}`, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={groupId ? `/admin/groups/${groupId}` : '/admin/customers'}
        backLabel={g ? `Group ${g.number}` : 'Customers'}
        eyebrow={g ? `Group ${g.number} · ${g.name}` : undefined}
        title={g ? 'Add a borrower to the group' : 'Add a loan customer'}
        subtitle="For a loan given outside the app. They can sign up later and find it waiting."
      />
      {g && !g.canManage && <Notice tone="danger">Only {g.officerName}, an owner or an administrator can add borrowers to this group.</Notice>}
      <Notice tone="neutral">
        The BVN is what joins this to their account when they sign up, so check it carefully. Everything else can be corrected later until they do.
      </Notice>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Borrower">
            <Grid>
              <Input label="BVN *" inputMode="numeric" maxLength={11} value={f.bvn} onChange={(e) => set('bvn')(e.target.value.replace(/\D/g, ''))} error={errors.bvn} />
              <Input label="Full name *" value={f.fullName} onChange={(e) => set('fullName')(e.target.value)} />
              <Input label="Email" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} />
              <Input label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone')(e.target.value)} />
              <Input label="NIN" inputMode="numeric" maxLength={11} value={f.nin} onChange={(e) => set('nin')(e.target.value.replace(/\D/g, ''))} error={errors.nin} />
              <Input label="Date of birth" type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth')(e.target.value)} />
              <Select label="Gender" placeholder="—" value={f.gender} onChange={(e) => set('gender')(e.target.value)} options={GENDERS} />
              <Input label="Occupation" value={f.occupation} onChange={(e) => set('occupation')(e.target.value)} />
            </Grid>
            <Grid>
              <Input label="Home address" value={f.address} onChange={(e) => set('address')(e.target.value)} />
              <Select label="State" placeholder="—" value={f.state} onChange={(e) => set('state')(e.target.value)} options={NIGERIAN_STATES} />
            </Grid>
          </Section>

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
                <Segmented<RepaymentFrequency>
                  value={frequency}
                  onChange={setFrequency}
                  options={[
                    { value: 'MONTHLY', label: 'Monthly' },
                    { value: 'WEEKLY', label: 'Weekly' },
                  ]}
                />
                {months > 0 && <p className="mt-1.5 text-[12px] text-ink-3">{instalmentsPhrase(frequency, months)}</p>}
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
                label="Transaction fee charged (₦)"
                inputMode="numeric"
                value={f.transactionFee}
                onChange={(e) => {
                  setFeesTouched((t) => ({ ...t, transaction: true }));
                  set('transactionFee')(formatAmountInput(e.target.value));
                }}
                hint="Clear it if none was taken."
              />
              <Input label="Date paid out *" type="date" max={isoDate(new Date())} value={f.disbursedAt} onChange={(e) => set('disbursedAt')(e.target.value)} />
              <Input label="Already repaid (₦)" inputMode="numeric" value={f.amountRepaid} onChange={(e) => set('amountRepaid')(formatAmountInput(e.target.value))} error={errors.repaid} />
            </Grid>
          </Section>

          <Section title="Payout account">
            <Grid>
              <Select label="Bank" placeholder="—" value={f.payoutBank} onChange={(e) => set('payoutBank')(e.target.value)} options={banks.data ?? []} />
              <Input label="Account number" inputMode="numeric" maxLength={10} value={f.payoutAccountNumber} onChange={(e) => set('payoutAccountNumber')(e.target.value.replace(/\D/g, ''))} error={errors.account} />
            </Grid>
          </Section>

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
                ['Transaction fee', `- ${naira(parseAmount(f.transactionFee))}`],
                { label: 'Paid out to the borrower', value: naira(Math.max(principal - parseAmount(f.processingFee) - parseAmount(f.transactionFee), 0)), tone: 'gold' },
                ['Interest', naira(principal * rate)],
                ['Total to repay', naira(total)],
                [eachInstalment(frequency), naira(count ? total / count : 0)],
                { label: 'Already repaid', value: naira(repaid), tone: 'success' },
                { label: 'Outstanding', value: naira(Math.max(total - repaid, 0)), bold: true },
                schedule.length ? ['Last payment due', asDay(schedule[schedule.length - 1]!.dueDate)] : null,
              ]}
            />
            <Button block size="lg" loading={busy} disabled={!valid} icon={<Save className="h-4 w-4" />} onClick={() => void submit()}>
              {g ? `Add to Group ${g.number}` : 'Save loan customer'}
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
