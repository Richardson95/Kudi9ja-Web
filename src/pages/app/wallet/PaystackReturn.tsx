import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { IconBadge } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { useRefresh } from '../../../hooks/queries';
import { walletApi } from '../../../lib/api/endpoints';
import { describeError } from '../../../lib/api/errors';
import { asDayTime, naira } from '../../../lib/format';
import type { PaystackPayment } from '../../../types/api';

const POLLS = 6;

/**
 * Where Paystack sends the customer back. Asks the server to confirm with
 * Paystack; a payment still being processed (a bank transfer, say) is asked
 * about again a few times before the page says it will update on its own.
 */
export default function PaystackReturn() {
  const [params] = useSearchParams();
  const refresh = useRefresh();
  const reference = params.get('reference') ?? params.get('trxref') ?? readStored();
  const [payment, setPayment] = useState<PaystackPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let timer: number | undefined;
    const ask = async (attempt: number) => {
      try {
        const p = await walletApi.confirmPaystack(reference);
        if (cancelled) return;
        setPayment(p);
        setTries(attempt);
        if (p.status === 'INITIALIZED' && attempt < POLLS) {
          timer = window.setTimeout(() => void ask(attempt + 1), 4000);
        } else if (p.credited) {
          void refresh.money();
        }
      } catch (e) {
        if (!cancelled) setError(describeError(e));
      }
    };
    void ask(1);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const state = !reference
    ? 'missing'
    : error
      ? 'error'
      : !payment
        ? 'checking'
        : payment.credited
          ? 'done'
          : payment.status === 'INITIALIZED'
            ? tries >= POLLS
              ? 'waiting'
              : 'checking'
            : 'failed';

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Your payment" back="/app/wallet" backLabel="Wallet" />
      <Card className="p-7 text-center">
        {state === 'checking' && (
          <>
            <Spinner className="mx-auto h-10 w-10 text-gold" />
            <p className="mt-5 text-lg font-extrabold">Confirming with Paystack…</p>
            <p className="mt-1 text-sm text-ink-3">This takes a few seconds. Please keep this page open.</p>
          </>
        )}
        {state === 'done' && payment && (
          <>
            <IconBadge tone="success" size={64} className="mx-auto">
              <CheckCircle2 />
            </IconBadge>
            <p className="mt-5 text-lg font-extrabold">Payment received</p>
            <p className="num mt-1 text-3xl font-extrabold text-success">{naira(payment.amount)}</p>
            <p className="mt-2 text-sm text-ink-3">
              {payment.purpose === 'LOAN_REPAYMENT' ? 'Applied to your loan.' : 'Added to your wallet.'}
            </p>
          </>
        )}
        {state === 'waiting' && (
          <>
            <IconBadge tone="gold" size={64} className="mx-auto">
              <Clock />
            </IconBadge>
            <p className="mt-5 text-lg font-extrabold">Still being processed</p>
            <p className="mt-1 text-sm text-ink-3">
              Paystack has not confirmed it yet. Bank transfers can take a few minutes. Your wallet updates by itself when it does,
              and we will notify you.
            </p>
          </>
        )}
        {(state === 'failed' || state === 'error' || state === 'missing') && (
          <>
            <IconBadge tone="danger" size={64} className="mx-auto">
              <XCircle />
            </IconBadge>
            <p className="mt-5 text-lg font-extrabold">
              {state === 'missing' ? 'We could not tell which payment this was' : 'The payment did not go through'}
            </p>
            <p className="mt-1 text-sm text-ink-3">
              {error ?? (state === 'missing' ? 'Check your wallet; if money left your account, contact support with the receipt.' : 'Nothing was taken from your wallet. You can try again.')}
            </p>
          </>
        )}

        {payment && (
          <DetailRows
            className="mt-6 text-left"
            rows={[
              ['Reference', payment.reference],
              ['For', payment.purposeLabel],
              payment.cardLast4 ? ['Paid with', `${payment.cardType ?? 'Card'} •••• ${payment.cardLast4}`] : payment.channel ? ['Paid by', payment.channel] : null,
              ['Started', asDayTime(payment.createdAt)],
              payment.paidAt ? ['Paid', asDayTime(payment.paidAt)] : null,
            ]}
          />
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {state === 'failed' && <Button to="/app/wallet/add">Try again</Button>}
          <Button to="/app/wallet" variant={state === 'failed' ? 'ghost' : 'gold'}>
            Go to wallet
          </Button>
        </div>
      </Card>
    </div>
  );
}

function readStored(): string | null {
  try {
    return sessionStorage.getItem('k9.paystack');
  } catch {
    return null;
  }
}
