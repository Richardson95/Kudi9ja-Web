import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Check, CreditCard, ReceiptText, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, Notice, Pill, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { AuthImage } from '../../components/ui/AuthImage';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { useAdminPayIns, useAdminPaystack, useAdminWithdrawals, useRefresh } from '../../hooks/queries';
import { adminApi } from '../../lib/api/endpoints';
import { asDayTime, naira, relative } from '../../lib/format';
import { can, depositTone, paystackTone, payoutLabel } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { AdminClaim, AdminWithdrawal, PaystackStatus, WithdrawalStatus } from '../../types/api';

type Tab = 'withdrawals' | 'payins' | 'claims';

export default function Payments() {
  const [tab, setTab] = useState<Tab>('withdrawals');
  const pendingWithdrawals = useAdminWithdrawals('PENDING');
  const claims = useAdminPayIns('PENDING');
  const waitingClaims = claims.data?.totalItems ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Money in arrives through Paystack and is credited by itself. Money out waits for approval, then Paystack sends it." />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'withdrawals', label: 'Withdrawals', count: pendingWithdrawals.data?.totalItems },
          { value: 'payins', label: 'Paystack pay-ins' },
          ...(waitingClaims ? [{ value: 'claims' as const, label: 'Older receipt claims', count: waitingClaims }] : []),
        ]}
      />
      {tab === 'withdrawals' && <Withdrawals />}
      {tab === 'payins' && <PayIns />}
      {tab === 'claims' && <Claims />}
    </div>
  );
}

function Withdrawals() {
  const [status, setStatus] = useState<WithdrawalStatus | 'ALL'>('PENDING');
  const list = useAdminWithdrawals(status);
  const { adminRole } = useSession();
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { busy, run } = useAction();
  const canApprove = can.approvePayments(adminRole);

  const approve = async (w: AdminWithdrawal) => {
    const ok = await dialogs.confirm({
      title: `Send ${naira(w.amount)} to ${w.customerName}?`,
      message: `Paystack transfers it to ${w.bank} ${w.destinationAccount} (${w.destinationName ?? w.customerName}). If the bank refuses it, the full amount goes back to their wallet automatically.`,
      confirmLabel: 'Approve and send',
    });
    if (ok) await run(async () => {
      await adminApi.approveWithdrawal(w.id);
      await refresh.admin();
    }, 'Approved — Paystack is sending it');
  };
  const paidByHand = async (w: AdminWithdrawal) => {
    const reference = await dialogs.reason({
      title: `Already paid ${w.customerName}?`,
      message: `Use this only if ${naira(w.amount)} was already transferred to ${w.bank} ${w.destinationAccount} by hand. It is recorded as paid and Paystack sends nothing.`,
      placeholder: 'Bank transfer reference',
      confirmLabel: 'Record as paid',
      minLength: 3,
      maxLength: 120,
    });
    if (reference) await run(async () => {
      await adminApi.approveWithdrawal(w.id, reference.trim(), undefined, true);
      await refresh.admin();
    }, 'Recorded as paid by hand');
  };
  const decline = async (w: AdminWithdrawal) => {
    const reason = await dialogs.reason({
      title: 'Decline this withdrawal',
      message: `${naira(w.amount)} goes back to ${w.customerName}'s wallet. They are told your reason.`,
      placeholder: 'Reason the customer will read',
      confirmLabel: 'Decline and refund',
      danger: true,
    });
    if (reason) await run(async () => {
      await adminApi.declineWithdrawal(w.id, reason);
      await refresh.admin();
    }, 'Declined and refunded');
  };

  return (
    <div className="space-y-4">
      <Segmented<WithdrawalStatus | 'ALL'>
        size="sm"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'PENDING', label: 'Waiting' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'DECLINED', label: 'Declined' },
          { value: 'ALL', label: 'All' },
        ]}
      />
      <Card padded={false}>
        {list.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : list.data?.items.length ? (
          <ul className="divide-y divide-stroke">
            {list.data.items.map((w) => {
              const st = payoutLabel(w);
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-gold" />
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-bold">
                      <Link to={`/admin/customers/${w.userId}`} className="hover:text-gold">{w.customerName}</Link>
                      <span className="ml-2 font-mono text-[12px] text-ink-3">{w.customerRef}</span>
                    </p>
                    <p className="text-[12.5px] text-ink-3">
                      {w.bank} · {w.destinationAccount} · {w.destinationName ?? 'name not resolved'} · {relative(w.requestedAt)}
                      {w.status === 'PENDING' && w.hoursWaiting >= 24 && <span className="font-bold text-danger"> · waiting {Math.floor(w.hoursWaiting)}h</span>}
                    </p>
                    {(w.payoutFailure || w.note) && <p className="text-[12px] text-ink-2">{w.payoutFailure ?? w.note}</p>}
                    {w.payoutProvider && (
                      <p className="text-[11.5px] text-ink-3">
                        {w.payoutProvider === 'PAYSTACK' ? 'Sent by Paystack' : 'Paid by hand'}
                        {w.transferCode ? ` · ${w.transferCode}` : ''}
                        {w.reviewedBy ? ` · approved by ${w.reviewedBy}` : ''}
                      </p>
                    )}
                  </div>
                  <p className="num text-base font-extrabold">{naira(w.amount)}</p>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  {w.status === 'PENDING' && canApprove && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="success" loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => void approve(w)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} icon={<ReceiptText className="h-4 w-4" />} onClick={() => void paidByHand(w)}>
                        Paid by hand
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} icon={<X className="h-4 w-4" />} onClick={() => void decline(w)}>
                        Decline
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<ArrowUpRight />} title="Nothing here" message={status === 'PENDING' ? 'No withdrawals are waiting.' : undefined} />
        )}
      </Card>
    </div>
  );
}

function PayIns() {
  const [status, setStatus] = useState<PaystackStatus | 'ALL'>('ALL');
  const list = useAdminPaystack(status);
  const items = list.data?.items ?? [];
  const total = items.filter((p) => p.credited).reduce((s, p) => s + p.amount, 0);
  const fees = items.reduce((s, p) => s + (p.fees ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<PaystackStatus | 'ALL'>
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'SUCCESSFUL', label: 'Credited' },
            { value: 'INITIALIZED', label: 'Not completed' },
            { value: 'FAILED', label: 'Failed' },
            { value: 'ABANDONED', label: 'Abandoned' },
          ]}
        />
        <p className="text-[12.5px] text-ink-3">
          Shown: <span className="num font-bold text-ink">{naira(total)}</span> credited · Paystack fees {naira(fees)}
        </p>
      </div>
      <Notice tone="neutral" icon={<CreditCard className="h-5 w-5" />}>
        Nothing to approve: each payment is verified with Paystack and credited, or applied to the loan, the moment it succeeds.
      </Notice>
      <Card padded={false}>
        {list.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : items.length ? (
          <ul className="divide-y divide-stroke">
            {items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <ArrowDownLeft className="h-5 w-5 shrink-0 text-success" />
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-bold">
                    <Link to={`/admin/customers/${p.userId}`} className="hover:text-gold">{p.customerName}</Link>
                    <span className="ml-2 font-mono text-[12px] text-ink-3">{p.customerRef}</span>
                  </p>
                  <p className="text-[12.5px] text-ink-3">
                    {p.purposeLabel} · {asDayTime(p.paidAt ?? p.createdAt)} · {p.reference}
                    {p.cardLast4 ? ` · ${p.cardType ?? 'card'} ${p.cardLast4}` : p.channel ? ` · ${p.channel}` : ''}
                    {p.fees ? ` · fee ${naira(p.fees)}` : ''}
                  </p>
                  {p.status === 'FAILED' && p.gatewayResponse && <p className="text-[12px] text-danger">{p.gatewayResponse}</p>}
                </div>
                <p className="num text-base font-extrabold">{naira(p.amount)}</p>
                <Pill tone={paystackTone(p.status)}>{p.status === 'INITIALIZED' ? 'Not completed' : p.statusLabel}</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<CreditCard />} title="No payments" />
        )}
      </Card>
    </div>
  );
}

/** Claims made before Paystack, still waiting. Nothing new arrives here. */
function Claims() {
  const list = useAdminPayIns('PENDING');
  const { adminRole } = useSession();
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { busy, run } = useAction();
  const [viewing, setViewing] = useState<AdminClaim | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  const open = async (c: AdminClaim) => {
    setViewing(c);
    setReceipt(null);
    const r = await run(() => adminApi.receiptUrl(c.id));
    if (r) setReceipt(r.url ?? Object.values(r)[0] ?? null);
  };

  return (
    <div className="space-y-4">
      <Notice tone="info">These were sent with a bank receipt before Paystack was switched on. Check each against the bank statement once; no new ones are accepted.</Notice>
      <Card padded={false}>
        <ul className="divide-y divide-stroke">
          {(list.data?.items ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <ReceiptText className="h-5 w-5 text-gold" />
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-bold">{c.customerName}</p>
                <p className="text-[12.5px] text-ink-3">
                  {c.purposeLabel} · {c.reference} · from {c.senderName ?? '—'} {c.senderBank ? `(${c.senderBank})` : ''} · {relative(c.claimedAt)}
                </p>
              </div>
              <p className="num font-extrabold">{naira(c.amount)}</p>
              <Pill tone={depositTone(c.status)}>{c.statusLabel}</Pill>
              <Button size="sm" variant="ghost" onClick={() => void open(c)}>
                Review
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing ? `${naira(viewing.amount)} from ${viewing.customerName}` : ''}
        description={viewing ? `${viewing.reference} · ${asDayTime(viewing.claimedAt)}` : ''}
        footer={
          viewing && can.approvePayments(adminRole) && (
            <>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  const note = await dialogs.reason({ title: 'Reject this claim', message: 'Nothing is credited. The customer is told why.', confirmLabel: 'Reject', danger: true });
                  if (note && (await run(() => adminApi.rejectPayIn(viewing.id, note), 'Rejected'))) {
                    setViewing(null);
                    await refresh.admin();
                  }
                }}
              >
                Reject
              </Button>
              <Button
                variant="success"
                loading={busy}
                onClick={async () => {
                  if (await run(() => adminApi.confirmPayIn(viewing.id), 'Confirmed and credited')) {
                    setViewing(null);
                    await refresh.admin();
                  }
                }}
              >
                Confirm — it is on the statement
              </Button>
            </>
          )
        }
      >
        <AuthImage url={receipt} alt="Receipt" fit="contain" className="h-[60vh] rounded-xl" />
      </Modal>
    </div>
  );
}
