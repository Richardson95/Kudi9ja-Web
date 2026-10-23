import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Pill } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { AmountInput, FieldLabel, RangeSlider } from '../../../components/ui/Inputs';
import { addMonths, feeBasis, loanPreview } from '../../../lib/finance';
import { asDay, months as monthsLabel, naira, parseAmount, rateOf } from '../../../lib/format';
import { useSettings } from '../../../state/settings';

/** What a loan would cost, before applying. Uses the rate card in force today. */
export default function LoanCalculator() {
  const s = useSettings();
  const [amount, setAmount] = useState('200,000');
  const [term, setTerm] = useState(Math.min(6, s.lending.maxTenureMonths));
  const principal = parseAmount(amount);
  const p = loanPreview(s, principal, term);
  const outOfRange = principal > 0 && (principal < s.lending.minAmount || principal > s.lending.maxAmount);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader back="/app/loans" backLabel="Loans" title="Loan calculator" subtitle="Flat interest: you know the full cost on day one." />
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
              <span className="text-sm font-extrabold text-gold">{monthsLabel(term)}</span>
            </div>
            <RangeSlider label="Months" value={term} min={1} max={s.lending.maxTenureMonths} onChange={setTerm} />
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
            <p className="text-[13px] text-ink-3">Each month</p>
            <p className="num text-4xl font-extrabold">{naira(p.monthly)}</p>
          </div>
          <DetailRows
            rows={[
              ['Flat rate', rateOf(p.rate)],
              ['Interest', naira(p.interest)],
              ['Management fee', `${naira(p.fee)} (${feeBasis(s, principal)})`],
              ['Transaction fee', naira(p.transactionFee)],
              { label: 'You receive', value: naira(p.net), tone: 'success' },
              ['First payment', asDay(addMonths(new Date(), 1))],
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
