import { useState } from 'react';
import { isoDate, naira, parseAmount } from '../../lib/format';
import { useAction } from '../../hooks/useAction';
import type { RecordRepaymentInput, RepaymentMethod } from '../../types/api';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { AmountInput } from '../ui/Inputs';
import { Modal } from '../ui/Modal';

const METHODS: { value: RepaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer to the company' },
  { value: 'POS', label: 'POS' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * A repayment taken outside the app — cash at the shop, a transfer straight
 * to the company account. Payments through Paystack are applied by
 * themselves and never need this.
 */
export function RecordRepayment({
  open,
  onClose,
  outstanding,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  outstanding: number;
  onSave: (input: RecordRepaymentInput) => Promise<unknown>;
}) {
  const { busy, run } = useAction();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<RepaymentMethod>('CASH');
  const [paidOn, setPaidOn] = useState(isoDate(new Date()));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const value = parseAmount(amount);
  const tooMuch = value > outstanding + 0.005;

  const save = async () => {
    const ok = await run(async () => {
      await onSave({
        amount: value,
        method,
        // Today means now; an earlier day is recorded at midday, so no time zone moves it.
        paidAt: paidOn === isoDate(new Date()) ? undefined : new Date(`${paidOn}T12:00:00`).toISOString(),
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      return true;
    }, 'Repayment recorded');
    if (ok) {
      setAmount('');
      setReference('');
      setNote('');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy}
      title="Record a repayment"
      description="For money received outside the app. Paystack payments are applied automatically and need nothing here."
      footer={
        <Button block loading={busy} disabled={value <= 0 || tooMuch || !paidOn} onClick={() => void save()}>
          Record {value > 0 ? naira(value) : ''}
        </Button>
      }
    >
      <div className="space-y-4">
        <AmountInput value={amount} onChange={setAmount} autoFocus error={tooMuch} />
        <p className={tooMuch ? 'text-center text-[13px] font-semibold text-danger' : 'text-center text-[12.5px] text-ink-3'}>
          {tooMuch ? `More than the ${naira(outstanding)} outstanding.` : `${naira(outstanding)} outstanding`}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="How it was paid" value={method} onChange={(e) => setMethod(e.target.value as RepaymentMethod)} options={METHODS} />
          <Input label="Date received" type="date" max={isoDate(new Date())} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <Input label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Teller or transfer reference" />
        <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
      </div>
    </Modal>
  );
}
