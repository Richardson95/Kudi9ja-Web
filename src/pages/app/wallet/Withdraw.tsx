import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Landmark } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { IconBadge, Notice } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { useDialogs } from '../../../components/ui/Dialogs';
import { AmountInput } from '../../../components/ui/Inputs';
import { useAction } from '../../../hooks/useAction';
import { useRefresh, useWallet } from '../../../hooks/queries';
import { walletApi } from '../../../lib/api/endpoints';
import { formatAmountInput, naira, parseAmount } from '../../../lib/format';
import { useProfile } from '../../../state/session';
import { useSettings } from '../../../state/settings';

/**
 * Money out to the customer's own account. The wallet is debited at once, so
 * the same naira cannot be spent twice while an admin approves it; Paystack
 * then sends it, and a failed transfer comes straight back.
 */
export default function Withdraw() {
  const profile = useProfile();
  const settings = useSettings();
  const wallet = useWallet();
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [amount, setAmount] = useState('');

  const balance = wallet.data?.balance ?? 0;
  const value = parseAmount(amount);
  const min = settings.wallet.minWithdrawalAmount;
  const problem =
    value <= 0 ? null : value < min ? `The smallest withdrawal is ${naira(min)}.` : value > balance ? 'That is more than your balance.' : null;

  if (!profile.hasPayoutAccount || !profile.payoutBank || !profile.payoutAccountNumber) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader back="/app/wallet" backLabel="Wallet" title="Withdraw" />
        <Notice tone="gold" title="Add your bank account first" icon={<Landmark className="h-5 w-5" />}>
          Withdrawals go only to an account in your own name.
          <div className="mt-3">
            <Button size="sm" to="/app/wallet/payout-account">
              Add account
            </Button>
          </div>
        </Notice>
      </div>
    );
  }

  const submit = async () => {
    const pin = await dialogs.pin({
      title: 'Confirm withdrawal',
      amountLabel: 'You are withdrawing',
      amount: value,
      details: [
        ['To', `${profile.payoutBank} ••${profile.payoutAccountNumber!.slice(-4)}`],
        ['Name', profile.payoutAccountName ?? profile.fullName],
      ],
    });
    if (!pin) return;
    const done = await run(() =>
      walletApi.requestWithdrawal({ amount: value, pin, bank: profile.payoutBank!, accountNumber: profile.payoutAccountNumber! }),
    );
    if (done) {
      await refresh.money();
      navigate('/app/wallet', { replace: true });
      setTimeout(() => {
        void dialogs.confirm({
          title: 'Withdrawal requested',
          message: done.message ?? `${naira(value)} has left your balance and will be sent once approved — usually within a working day.`,
          confirmLabel: 'Done',
          cancelLabel: 'Close',
        });
      }, 50);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back="/app/wallet" backLabel="Wallet" title="Withdraw" subtitle="Send money to your bank account." />
      <Card className="space-y-6 p-6">
        <AmountInput value={amount} onChange={setAmount} autoFocus label="How much?" error={!!problem} />
        <div className="flex justify-center">
          <button
            type="button"
            className="text-[13px] font-bold text-gold hover:underline"
            onClick={() => setAmount(formatAmountInput(String(Math.floor(balance))))}
          >
            Available: {naira(balance)} · Use all
          </button>
        </div>
        {problem && <p className="text-center text-[13px] font-semibold text-danger">{problem}</p>}

        <div className="flex items-center gap-3.5 rounded-2xl border border-stroke bg-surface-alt/50 p-4">
          <IconBadge size={40}>
            <Landmark />
          </IconBadge>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{profile.payoutBank}</p>
            <p className="num text-[13px] text-ink-3">
              {profile.payoutAccountNumber} · {profile.payoutAccountName ?? profile.fullName}
            </p>
          </div>
          <Button size="sm" variant="subtle" to="/app/wallet/payout-account">
            Change
          </Button>
        </div>

        {value > 0 && !problem && (
          <DetailRows
            rows={[
              ['Amount', naira(value)],
              ['Fee', 'Free'],
              { label: 'Balance after', value: naira(balance - value), bold: true },
            ]}
          />
        )}

        <Button block size="lg" icon={<ArrowUpRight className="h-4 w-4" />} disabled={value <= 0 || !!problem} loading={busy} onClick={submit}>
          Withdraw
        </Button>
        <p className="text-center text-[12.5px] text-ink-3">
          Debited now. An admin approves it, then it is sent to your bank. If the bank returns it, every naira comes back.
        </p>
      </Card>
    </div>
  );
}
