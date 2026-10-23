import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, CreditCard, Wallet as WalletIcon, Zap } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState, Notice, Pill, ProgressRing } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../../components/ui/Card';
import { useDialogs } from '../../../components/ui/Dialogs';
import { AmountInput } from '../../../components/ui/Inputs';
import { Modal } from '../../../components/ui/Modal';
import { PageSpinner } from '../../../components/ui/Spinner';
import { useAction } from '../../../hooks/useAction';
import { useLoan, useRefresh, useWallet } from '../../../hooks/queries';
import { loansApi } from '../../../lib/api/endpoints';
import { cn } from '../../../lib/cn';
import { asDay, formatAmountInput, naira, parseAmount } from '../../../lib/format';
import { instalmentLabel, instalmentTone, isLoanOpen, loanTone } from '../../../lib/labels';

/**
 * One loan. Repaying through Paystack goes to checkout and comes off the
 * balance the moment Paystack confirms it; paying from the wallet comes off
 * at once. No receipts, no waiting for approval.
 */
export default function LoanDetail() {
  const { id = '' } = useParams();
  const loan = useLoan(id);
  const wallet = useWallet();
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { busy, run } = useAction();
  const [fromWallet, setFromWallet] = useState(false);
  const [amount, setAmount] = useState('');

  if (loan.isLoading) return <PageSpinner />;
  if (!loan.data) return <EmptyState icon={<CreditCard />} title="Loan not found" action={<Button to="/app/loans">Back to loans</Button>} />;
  const l = loan.data;
  const open = isLoanOpen(l.status);
  const next = l.nextInstallment;
  const value = parseAmount(amount);
  const balance = wallet.data?.balance ?? 0;
  const payLink = (n?: number) => `/app/wallet/add?loan=${l.id}${n ? `&amount=${Math.ceil(n)}` : ''}`;

  const payFromWallet = async () => {
    const pin = await dialogs.pin({ title: 'Repay from your wallet', amountLabel: 'Paying', amount: value, details: [['Loan', l.purpose]] });
    if (!pin) return;
    const done = await run(() => loansApi.repay(id, value, pin), (r) => r.message);
    if (done) {
      setFromWallet(false);
      setAmount('');
      await refresh.loans();
    }
  };

  const settle = async () => {
    const ok = await dialogs.confirm({
      title: 'Pay off the whole loan?',
      message: `${naira(l.earlySettlementAmount)} from your wallet clears it — everything still owed, interest included.`,
      confirmLabel: 'Continue',
    });
    if (!ok) return;
    const pin = await dialogs.pin({ title: 'Settle the loan', amountLabel: 'Paying', amount: l.earlySettlementAmount });
    if (!pin) return;
    if (await run(() => loansApi.settle(id, pin), (r) => r.message)) await refresh.loans();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader back="/app/loans" backLabel="Loans" eyebrow="Loan" title={l.purpose} actions={<Pill tone={loanTone(l.status)}>{l.statusLabel}</Pill>} />

      {l.status === 'OVERDUE' && (
        <Notice tone="danger" title="This loan is overdue">
          Pay what is due as soon as you can. If something has changed, tell your loan officer or write to us from Help & complaints — we would rather agree a plan.
        </Notice>
      )}

      <Card gradient glow className="p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <ProgressRing value={l.repaymentProgress} size={150} tone={l.status === 'REPAID' ? 'success' : l.status === 'OVERDUE' ? 'danger' : 'gold'}>
            <div className="text-center">
              <p className="num text-2xl font-extrabold">{Math.round(l.repaymentProgress * 100)}%</p>
              <p className="text-[11px] text-ink-3">repaid</p>
            </div>
          </ProgressRing>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[13px] text-ink-3">{open ? 'Still owed' : 'Loan closed'}</p>
            <p className="num text-4xl font-extrabold">{naira(l.outstanding)}</p>
            {next && open && (
              <p className="mt-1 text-sm text-ink-2">
                Next: <span className="font-bold">{naira(next.outstanding)}</span> due {asDay(next.dueDate)}
                {next.daysUntilDue < 0 ? ` (${Math.abs(next.daysUntilDue)} days late)` : ''}
              </p>
            )}
            {open && (
              <div className="mt-5 flex flex-wrap justify-center gap-2.5 sm:justify-start">
                <Button to={payLink(next?.outstanding)} icon={<CreditCard className="h-4 w-4" />}>
                  Pay {next ? naira(next.outstanding) : ''} with Paystack
                </Button>
                <Button variant="ghost" icon={<WalletIcon className="h-4 w-4" />} onClick={() => {
                  setAmount(next ? formatAmountInput(String(Math.ceil(next.outstanding))) : '');
                  setFromWallet(true);
                }}>
                  From wallet
                </Button>
                <Button variant="ghost" icon={<Zap className="h-4 w-4" />} loading={busy} onClick={() => void settle()}>
                  Pay off early
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <SectionHeader title="The loan" />
          <DetailRows
            rows={[
              ['Borrowed', naira(l.principal)],
              ['Flat rate', l.flatRateLabel],
              ['Management fee', naira(l.processingFee)],
              l.transactionFee ? ['Transaction fee', naira(l.transactionFee)] : null,
              ['Paid to your wallet', naira(l.netDisbursed)],
              ['Disbursed', asDay(l.disbursedAt)],
              ['Monthly repayment', naira(l.monthlyRepayment)],
              ['Total interest', naira(l.totalInterest)],
              { label: 'Total to repay', value: naira(l.totalRepayable), bold: true },
              { label: 'Repaid so far', value: naira(l.amountRepaid), tone: 'success' },
              l.rebateGranted ? { label: 'Rebate', value: naira(l.rebateGranted), tone: 'success' } : null,
              l.settledAt ? ['Closed', asDay(l.settledAt)] : null,
            ]}
          />
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-3">
            <SectionHeader title="Repayment schedule" className="mb-0" />
          </div>
          <ul className="divide-y divide-stroke">
            {l.schedule.map((r) => (
              <li key={r.number} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-extrabold',
                    r.status === 'PAID' ? 'bg-success/15 text-success' : r.status === 'OVERDUE' ? 'bg-danger/15 text-danger' : 'bg-surface-alt text-ink-2',
                  )}
                >
                  {r.status === 'PAID' ? <BadgeCheck className="h-4 w-4" /> : r.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{asDay(r.dueDate)}</p>
                  {r.amountPaid > 0 && r.status !== 'PAID' && <p className="text-[12px] text-ink-3">{naira(r.amountPaid)} paid</p>}
                </div>
                <p className="num text-sm font-bold">{naira(r.amount)}</p>
                <Pill tone={instalmentTone(r.status)}>{instalmentLabel(r.status)}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={fromWallet}
        onClose={() => setFromWallet(false)}
        title="Repay from your wallet"
        description={`Wallet balance: ${naira(balance)}. It comes off what you owe at once.`}
        footer={
          <Button block loading={busy} disabled={value <= 0 || value > balance || value > l.outstanding} onClick={() => void payFromWallet()}>
            Pay {value > 0 ? naira(value) : ''}
          </Button>
        }
      >
        <AmountInput value={amount} onChange={setAmount} autoFocus />
        {value > balance && (
          <p className="mt-3 text-center text-[13px] text-danger">
            Your wallet is short. <Link to={payLink(value)} className="font-bold underline">Pay with Paystack instead</Link>.
          </p>
        )}
      </Modal>
    </div>
  );
}
