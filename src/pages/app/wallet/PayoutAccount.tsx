import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, MailCheck } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { Notice } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { useDialogs } from '../../../components/ui/Dialogs';
import { Input, Select } from '../../../components/ui/Field';
import { OtpInput } from '../../../components/ui/PinPad';
import { useAction } from '../../../hooks/useAction';
import { useBanks } from '../../../hooks/queries';
import { meApi } from '../../../lib/api/endpoints';
import { maskEmail } from '../../../lib/format';
import { useProfile, useSession } from '../../../state/session';

/**
 * The one account withdrawals can go to. Changing it takes a code sent to
 * the customer's email and their PIN, and the server checks the name on the
 * new account against theirs.
 */
export default function PayoutAccount() {
  const profile = useProfile();
  const { setProfile } = useSession();
  const banks = useBanks();
  const dialogs = useDialogs();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');

  const valid = !!bank && /^\d{10}$/.test(account);

  const sendCode = async () => {
    const sent = await run(() => meApi.payoutCode());
    if (sent) setCodeSent(true);
  };

  const save = async () => {
    const pin = await dialogs.pin({
      title: 'Confirm the new account',
      amountLabel: 'Withdrawals will go to',
      details: [
        ['Bank', bank],
        ['Account', account],
      ],
    });
    if (!pin) return;
    const updated = await run(() => meApi.changePayout({ bank, accountNumber: account, code, pin }), 'Payout account updated');
    if (updated) {
      setProfile(updated);
      navigate(-1);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader back="/app/wallet" backLabel="Wallet" title="Payout account" subtitle="Where your withdrawals are sent." />

      {profile.hasPayoutAccount && (
        <Card>
          <p className="eyebrow mb-3 text-ink-3">Current account</p>
          <DetailRows
            rows={[
              ['Bank', profile.payoutBank ?? '—'],
              ['Account number', profile.payoutAccountNumber ?? '—'],
              ['Account name', profile.payoutAccountName ?? profile.fullName],
            ]}
          />
        </Card>
      )}

      <Card className="space-y-4 p-6">
        <p className="text-sm font-bold">{profile.hasPayoutAccount ? 'Change to a new account' : 'Add your account'}</p>
        <Select
          label="Bank"
          placeholder="Choose your bank"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          options={banks.data ?? []}
          icon={<Landmark className="h-4 w-4" />}
        />
        <Input
          label="Account number"
          inputMode="numeric"
          maxLength={10}
          value={account}
          onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
          placeholder="10 digits"
        />
        <Notice tone="neutral">The account must be in your own name: {profile.fullName}. We check it with the bank.</Notice>

        {!codeSent ? (
          <Button block disabled={!valid} loading={busy} onClick={sendCode} icon={<MailCheck className="h-4 w-4" />}>
            Send me a code
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-[13px] text-ink-3">Enter the code we sent to {maskEmail(profile.email)}</p>
            <OtpInput value={code} onChange={setCode} autoFocus />
            <Button block disabled={!valid || code.length < 6} loading={busy} onClick={save}>
              Save account
            </Button>
            <button type="button" onClick={sendCode} className="mx-auto block text-[13px] font-bold text-gold hover:underline">
              Send a new code
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
