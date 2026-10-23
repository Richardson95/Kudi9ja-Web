import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Pill, Segmented } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { AmountInput, FieldLabel, NumberField } from '../../../components/ui/Inputs';
import { eachInstalment, feeBasis, feeRateLabel, instalmentDue, instalmentsPhrase, loanLength, loanPreview } from '../../../lib/finance';
import { asDay, months as monthsLabel, naira, parseAmount, rateOf } from '../../../lib/format';
import { useBorrowerSettings } from '../../../hooks/queries';
import type { RepaymentFrequency } from '../../../types/api';

/** What a loan would cost, before applying. Uses the rate card in force today. */
export default function LoanCalculator() {
  const { settings: s, groupPricing } = useBorrowerSettings();
  const offered = (['WEEKLY', 'MONTHLY'] as RepaymentFrequency[]).filter((f) =>
    f === 'WEEKLY' ? s.lending.weeklyAllowed !== false : s.lending.monthlyAllowed !== false,
  );
  const [amount, setAmount] = useState('200,000');
  const [term, setTerm] = useState(Math.min(6, s.lending.maxTenureMonths));
  const [picked, setFrequency] = useState<RepaymentFrequency>('MONTHLY');
  const frequency: RepaymentFrequency = offered.includes(picked) ? picked : (offered[0] ?? 'MONTHLY');
  const principal = parseAmount(amount);
  const p = loanPreview(s, principal, term, frequency);
  const outOfRange = principal > 0 && (principal < s.lending.minAmount || principal > s.lending.maxAmount);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader back="/app/loans" backLabel="Loans" title="Loan calculator" subtitle={groupPricing ? 'Priced on your loan group terms. Flat interest: you know the full cost on day one.' : 'Flat interest: you know the full cost on day one.'} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-6 p-6">
          <AmountInput value={amount} onChange={setAmount} label="How much?" error={outOfRange} />
          {outOfRange && (
            <p className="text-center text-[13px] font-semibold text-danger">
              Loans run from {naira(s.lending.minAmount)} to {naira(s.lending.maxAmount)}.
            </p>
          )}
          <div>
            <div className="mb-2 flex justify-between">
              <FieldLabel>Over</FieldLabel>
              <span className="text-sm font-extrabold text-gold">{loanLength(frequency, term)}</span>
            </div>
            <NumberField label="Months" value={term} min={1} max={s.lending.maxTenureMonths} onChange={setTerm} />
            {frequency === 'WEEKLY' && term > 0 && (
              <p className="mt-1.5 text-[12px] text-ink-3">
                {monthsLabel(term)} is {loanLength(frequency, term)}.
              </p>
            )}
          </div>
          <div>
            <FieldLabel>Repay</FieldLabel>
            <Segmented<RepaymentFrequency>
              value={frequency}
              onChange={setFrequency}
              options={offered.map((f) => ({ value: f, label: f === 'WEEKLY' ? 'Weekly' : 'Monthly' }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: s.lending.maxTenureMonths }, (_, i) => i + 1).map((m) => (
              <Pill key={m} tone={m === term ? 'gold' : 'neutral'}>
                {m}m · {rateOf(loanPreview(s, 1, m).rate)}
              </Pill>
            ))}
          </div>
        </Card>
        <Card gradient glow className="space-y-5 p-6">
          <div>
            <p className="text-[13px] text-ink-3">{eachInstalment(frequency)}</p>
            <p className="num text-4xl font-extrabold">{naira(p.each)}</p>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {naira(p.base)} + {naira(p.instalmentFee)} transaction fee ({feeRateLabel(p.feeRate)} of each repayment) · {instalmentsPhrase(frequency, term)}
            </p>
          </div>
          <DetailRows
            rows={[
              ['Flat rate', rateOf(p.rate)],
              ['Interest', naira(p.interest)],
              ['Management fee', `${naira(p.fee)} (${feeBasis(s, principal)})`],
              { label: 'You receive', value: naira(p.net), tone: 'success' },
              ['Loan and interest', naira(p.loanTotal)],
              [`Transaction fees (${feeRateLabel(p.feeRate)} of each repayment)`, naira(p.fees)],
              ['First payment', asDay(instalmentDue(frequency, new Date(), 1))],
              { label: 'Total to repay', value: naira(p.total), bold: true },
            ]}
          />
          <p className="text-[12px] text-ink-3">
            You can pay off early at any time; you pay what is still owed, interest included. Once a loan reaches your wallet it
            cannot be cancelled.
          </p>
          <Button block to="/app/loans/apply" disabled={!s.switches.lendingEnabled}>
            Apply for this loan
          </Button>
        </Card>
      </div>
    </div>
  );
}
