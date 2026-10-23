import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { Notice, Segmented } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { useDialogs } from '../../../components/ui/Dialogs';
import { Input, Select } from '../../../components/ui/Field';
import { AmountInput, FieldLabel, FileDrop, NumberField } from '../../../components/ui/Inputs';
import { PageSpinner } from '../../../components/ui/Spinner';
import { useToast } from '../../../components/ui/Toast';
import { useAction } from '../../../hooks/useAction';
import { useBorrowerSettings, useEligibility, useRefresh } from '../../../hooks/queries';
import { loansApi } from '../../../lib/api/endpoints';
import { cn } from '../../../lib/cn';
import { eachInstalment, feeRateLabel, instalmentsPhrase, loanPreview } from '../../../lib/finance';
import { formatAmountInput, months as monthsLabel, naira, parseAmount, rateOf } from '../../../lib/format';
import { LOAN_PURPOSES, NIGERIAN_STATES } from '../../../lib/validators';
import type { Guarantor, LoanQuote, RepaymentFrequency } from '../../../types/api';

const STEPS = ['Loan', 'Business', 'Guarantor', 'Documents', 'Review'] as const;
const PHONE = /^0[7-9][01]\d{8}$/;

const emptyGuarantor: Guarantor = {
  fullName: '',
  phone: '',
  address: '',
  state: '',
  localGovernment: '',
  landmark: '',
  relationship: '',
  bvn: '',
  occupation: '',
  email: '',
};

export default function LoanApply() {
  const { settings: s, groupPricing } = useBorrowerSettings();
  const eligibility = useEligibility();
  const dialogs = useDialogs();
  const toast = useToast();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [step, setStep] = useState(0);

  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState(3);
  // Nothing is chosen until the customer chooses; until then the figures are
  // shown weekly. Where only one is offered, that one is the choice.
  const offered = (['WEEKLY', 'MONTHLY'] as RepaymentFrequency[]).filter((f) =>
    f === 'WEEKLY' ? s.lending.weeklyAllowed !== false : s.lending.monthlyAllowed !== false,
  );
  const [picked, setChosen] = useState<RepaymentFrequency | null>(null);
  const chosen = offered.length === 1 ? offered[0]! : picked && offered.includes(picked) ? picked : null;
  const frequency: RepaymentFrequency = chosen ?? offered[0] ?? 'WEEKLY';
  const [purpose, setPurpose] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [income, setIncome] = useState('');
  const [g, setG] = useState<Guarantor>(emptyGuarantor);
  const [statement, setStatement] = useState<File | null>(null);
  const [statementPassword, setStatementPassword] = useState('');
  const [selfie, setSelfie] = useState<File | null>(null);
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [quote, setQuote] = useState<LoanQuote | null>(null);

  const e = eligibility.data;
  const principal = parseAmount(amount);
  const preview = loanPreview(s, principal, term, frequency);
  // Only trust a quote for exactly what is on screen.
  const q = quote && quote.repaymentFrequency === frequency && quote.months === term ? quote : null;
  const eachLabel = eachInstalment(frequency);
  const each = naira(q?.installmentAmount ?? preview.each);
  const eachBreakdown = `${naira(q?.installmentBase ?? preview.base)} + ${naira(q?.installmentFee ?? preview.instalmentFee)} transaction fee`;
  const feeRate = q?.repaymentFeeRate ?? preview.feeRate;
  const feeLabel = feeRateLabel(feeRate);

  // The server prices the loan; ask it once the figures settle.
  useEffect(() => {
    if (!e?.eligible || principal < e.minAmount || principal > e.maxAmount) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => {
      loansApi.quote(principal, term, frequency).then(setQuote).catch(() => setQuote(null));
    }, 400);
    return () => clearTimeout(t);
  }, [principal, term, frequency, e]);

  if (eligibility.isLoading) return <PageSpinner />;
  if (e && !e.eligible) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back="/app/loans" backLabel="Loans" title="Apply for a loan" />
        <Notice tone="gold" title="You cannot apply just yet">
          {e.reason ?? 'Your account is not eligible for a loan right now.'}
        </Notice>
      </div>
    );
  }

  const set = (k: keyof Guarantor) => (v: string) => setG((old) => ({ ...old, [k]: v }));
  const loanOk = !!e && principal >= e.minAmount && principal <= e.maxAmount && !!purpose && !!chosen;
  const businessOk = businessName.trim().length > 1 && businessAddress.trim().length > 4 && parseAmount(income) > 0;
  const guarantorOk =
    g.fullName.trim().split(/\s+/).length >= 2 &&
    PHONE.test(g.phone) &&
    g.address.trim().length > 4 &&
    !!g.state &&
    g.localGovernment.trim().length > 1 &&
    g.landmark.trim().length > 1 &&
    g.relationship.trim().length > 1 &&
    /^\d{11}$/.test(g.bvn);
  const docsOk = !!statement && !!selfie && photos.every(Boolean);
  const ok = [loanOk, businessOk, guarantorOk, docsOk, true][step];

  const submit = async () => {
    const pin = await dialogs.pin({
      title: 'Send your application',
      amountLabel: 'You are asking for',
      amount: principal,
      details: [
        ['Over', monthsLabel(term)],
        ['Repaid', instalmentsPhrase(frequency, term)],
        [eachLabel, `${each} (${eachBreakdown})`],
        ['Total to repay', naira(q?.totalRepayable ?? preview.total)],
      ],
    });
    if (!pin) return;
    const sent = await run(() =>
      loansApi.apply({
        amount: principal,
        months: term,
        repaymentFrequency: frequency,
        purpose,
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        monthlyIncome: parseAmount(income),
        guarantors: [{ ...g, occupation: g.occupation?.trim() || undefined, email: g.email?.trim() || undefined }],
        statementPassword,
        pin,
        bankStatement: statement!,
        selfie: selfie!,
        businessPhotos: photos as File[],
      }),
    );
    if (sent) {
      await refresh.loans();
      toast.success('Application sent. We will let you know as soon as it is decided.');
      navigate('/app/loans', { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/app/loans" backLabel="Loans" title="Apply for a loan" subtitle="About five minutes. Have your bank statement and three photos of your business ready." />

      <ol className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="text-center">
            <div className={cn('h-1.5 rounded-full', i < step ? 'bg-success' : i === step ? 'gold-gradient' : 'bg-surface-high')} />
            <span className={cn('mt-1.5 block text-[11.5px] font-semibold', i === step ? 'text-gold' : 'text-ink-3')}>{label}</span>
          </li>
        ))}
      </ol>

      <Card className="space-y-5 p-6">
        {step === 0 && (
          <>
            {groupPricing && (
              <Notice tone="gold" title="Group loan terms">
                You are in a loan group, so your loan is priced on the group terms: the rates, fees and limits below.
              </Notice>
            )}
            <AmountInput value={amount} onChange={setAmount} autoFocus label={e ? `Between ${naira(e.minAmount)} and ${naira(e.maxAmount)}` : 'How much?'} />
            <div>
              <div className="mb-2 flex justify-between">
                <FieldLabel>Over</FieldLabel>
                <span className="text-sm font-extrabold text-gold">{monthsLabel(term)}</span>
              </div>
              <NumberField label="Months" value={term} min={e?.minMonths ?? 1} max={e?.maxMonths ?? s.lending.maxTenureMonths} onChange={setTerm} />
            </div>
            <div>
              <FieldLabel>How often will you repay? *</FieldLabel>
              <div className={cn('inline-block rounded-2xl', !chosen && 'ring-2 ring-gold/50')}>
                <Segmented<RepaymentFrequency | ''>
                  value={chosen ?? ''}
                  onChange={(v) => v && setChosen(v)}
                  options={offered.map((f) => ({ value: f, label: f === 'WEEKLY' ? 'Weekly' : 'Monthly' }))}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                {chosen
                  ? `${instalmentsPhrase(frequency, term)}, the first ${frequency === 'WEEKLY' ? 'a week' : 'a month'} after the money reaches your wallet.`
                  : 'Choose weekly or monthly to continue. The figures below are weekly until you do.'}
              </p>
            </div>
            <Select label="What is it for?" placeholder="Choose a purpose" value={purpose} onChange={(ev) => setPurpose(ev.target.value)} options={LOAN_PURPOSES} />
            {principal > 0 && (
              <DetailRows
                rows={[
                  ['Flat rate', q?.flatRateLabel ?? rateOf(preview.rate)],
                  ['Management fee (taken from the loan)', naira(q?.processingFee ?? preview.fee)],
                  { label: 'You receive', value: naira(q?.netDisbursed ?? preview.net), tone: 'success' },
                  ['Loan and interest', naira(q?.loanAndInterest ?? preview.loanTotal)],
                  ['Payments', instalmentsPhrase(frequency, term)],
                  { label: eachLabel, value: each, bold: true },
                  ['Of which loan and interest', naira(q?.installmentBase ?? preview.base)],
                  [`Of which transaction fee (${feeLabel})`, naira(q?.installmentFee ?? preview.instalmentFee)],
                  [`Transaction fees in all`, naira(q?.totalRepaymentFees ?? preview.fees)],
                  { label: 'Total to repay', value: naira(q?.totalRepayable ?? preview.total), bold: true },
                ]}
              />
            )}
            {principal > 0 && (
              <Notice tone="gold">
                Every repayment carries a transaction fee of {feeLabel} of the instalment. It is already included in the {frequencyText(frequency)}{' '}
                amount above and in the total. Only the management fee comes off the money you receive.
              </Notice>
            )}
            {q?.note && <Notice tone="neutral">{q.note}</Notice>}
          </>
        )}

        {step === 1 && (
          <>
            <Input label="Business name" value={businessName} onChange={(ev) => setBusinessName(ev.target.value)} maxLength={160} />
            <Input label="Business address" value={businessAddress} onChange={(ev) => setBusinessAddress(ev.target.value)} maxLength={400} />
            <Input
              label="Monthly income (₦)"
              inputMode="numeric"
              value={income}
              onChange={(ev) => setIncome(formatAmountInput(ev.target.value))}
              hint="Roughly what comes in each month, before expenses."
            />
          </>
        )}

        {step === 2 && (
          <>
            <Notice tone="neutral">Someone who knows you well and would vouch for you. We may call them.</Notice>
            <Grid>
              <Input label="Full name" value={g.fullName} onChange={(ev) => set('fullName')(ev.target.value)} />
              <Input label="Phone" inputMode="tel" maxLength={11} value={g.phone} onChange={(ev) => set('phone')(ev.target.value.replace(/\D/g, ''))}
                error={g.phone && !PHONE.test(g.phone) ? 'An 11-digit Nigerian number' : null} />
              <Input label="Relationship to you" value={g.relationship} onChange={(ev) => set('relationship')(ev.target.value)} placeholder="e.g. Brother, landlord" />
              <Input label="Their BVN" inputMode="numeric" maxLength={11} value={g.bvn} onChange={(ev) => set('bvn')(ev.target.value.replace(/\D/g, ''))}
                error={g.bvn && g.bvn.length !== 11 ? 'Eleven digits' : null} />
            </Grid>
            <Input label="Home address" value={g.address} onChange={(ev) => set('address')(ev.target.value)} />
            <Grid>
              <Select label="State" placeholder="Choose" value={g.state} onChange={(ev) => set('state')(ev.target.value)} options={NIGERIAN_STATES} />
              <Input label="Local government" value={g.localGovernment} onChange={(ev) => set('localGovernment')(ev.target.value)} />
              <Input label="Nearest landmark" value={g.landmark} onChange={(ev) => set('landmark')(ev.target.value)} />
              <Input label="Occupation (optional)" value={g.occupation ?? ''} onChange={(ev) => set('occupation')(ev.target.value)} />
            </Grid>
            <Input label="Email (optional)" type="email" value={g.email ?? ''} onChange={(ev) => set('email')(ev.target.value)} />
          </>
        )}

        {step === 3 && (
          <>
            <FileDrop
              file={statement}
              onFile={setStatement}
              accept="application/pdf,image/*,.xls,.xlsx,.csv"
              title="Bank statement"
              subtitle="The last six months, as your bank sent it"
              onError={toast.error}
              required
            />
            {statement && (
              <Input
                label="Statement password (if it has one)"
                value={statementPassword}
                onChange={(ev) => setStatementPassword(ev.target.value)}
                hint="Banks often lock statements with a password. Only the reviewer sees it."
              />
            )}
            <FileDrop file={selfie} onFile={setSelfie} accept="image/*" title="A photo of you" subtitle="Face clearly visible" aspect="portrait" onError={toast.error} required />
            <div>
              <FieldLabel>Three photos of your business</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <FileDrop
                    key={i}
                    file={p}
                    onFile={(f) => setPhotos((old) => old.map((o, j) => (j === i ? f : o)))}
                    accept="image/*"
                    title={['Outside', 'Inside', 'Stock or work'][i]!}
                    onError={toast.error}
                    required
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <DetailRows
              rows={[
                ['Amount', naira(principal)],
                ['Over', monthsLabel(term)],
                ['Repaid', instalmentsPhrase(frequency, term)],
                ['Purpose', purpose],
                [eachLabel, `${each} (${eachBreakdown})`],
                ['Total to repay', naira(q?.totalRepayable ?? preview.total)],
                ['You receive', naira(q?.netDisbursed ?? preview.net)],
                ['Business', `${businessName} · ${businessAddress}`],
                ['Monthly income', naira(parseAmount(income))],
                ['Guarantor', `${g.fullName} (${g.relationship}) · ${g.phone}`],
                ['Documents', `Statement, your photo, ${photos.length} business photos`],
              ]}
            />
            <Notice tone="neutral">
              Approved loans are paid into your Kudi9ja wallet. Repay through Paystack by card, transfer or USSD, or from your wallet
              — each payment comes off what you owe immediately. By sending, you confirm everything here is true.
            </Notice>
          </>
        )}

        <div className="flex justify-between gap-3 border-t border-stroke pt-5">
          <Button variant="ghost" disabled={step === 0 || busy} icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep((n) => n - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!ok} iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => setStep((n) => n + 1)}>
              Continue
            </Button>
          ) : (
            <Button loading={busy} icon={busy ? undefined : <Send className="h-4 w-4" />} onClick={() => void submit()}>
              Send application
            </Button>
          )}
        </div>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-ink-3">
        <Check className="h-3.5 w-3.5 text-success" /> Your documents are seen only by the people reviewing your application.
      </p>
    </div>
  );
}

const frequencyText = (f: RepaymentFrequency) => (f === 'WEEKLY' ? 'weekly' : 'monthly');

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
