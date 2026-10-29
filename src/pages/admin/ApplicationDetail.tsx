import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ClipboardList, SlidersHorizontal, X } from 'lucide-react';
import { DocumentGrid, type DocItem } from '../../components/admin/Documents';
import { OfficersPanel } from '../../components/admin/OfficersPanel';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, Notice, Pill } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../components/ui/Card';
import { NumberInput, Textarea } from '../../components/ui/Field';
import { useDialogs } from '../../components/ui/Dialogs';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys, useRefresh } from '../../hooks/queries';
import { adminApi } from '../../lib/api/endpoints';
import { asDay, asDayTime, naira } from '../../lib/format';
import { eachInstalment, feeRateLabel, instalmentsPhrase, loanLengthDetail, loanPreview, loanRateFor, perInstalment } from '../../lib/finance';
import { applicationTone, can } from '../../lib/labels';
import { useSession } from '../../state/session';
import { useSettings } from '../../state/settings';
import type { AdminApplicationDetail, PublicSettings } from '../../types/api';

const pct = (fraction: number) => Math.round(fraction * 10000) / 100;

export default function ApplicationDetail() {
  const { id = '' } = useParams();
  const { adminRole, stage, isAdmin } = useSession();
  const s = useSettings();
  const app = useQuery({ queryKey: keys.admin.application(id), queryFn: () => adminApi.loanApplication(id), enabled: stage === 'unlocked' && isAdmin });
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { busy, run } = useAction();
  const [changing, setChanging] = useState(false);

  if (app.isLoading) return <PageSpinner />;
  const a = app.data;
  if (!a) return <EmptyState icon={<ClipboardList />} title="Application not found" />;
  // A member of a loan group is priced on the group terms.
  const terms = a.groupPricing ? { ...s, lending: s.groupLending } : s;
  const offer = a.offer;
  // Changed terms are what it is priced on once sent: agreed, or waiting for the customer.
  const months = offer ? offer.months : a.tenureMonths;
  const p = loanPreview(terms, a.amount, months, a.repaymentFrequency, undefined, offer);
  const agreed = !!offer?.agreedAt && a.status === 'PENDING';
  const act = can.actOnLoans(adminRole);
  const decide = act && a.status === 'PENDING';
  const open = act && (a.status === 'PENDING' || a.status === 'OFFERED');

  const docs: DocItem[] = [
    a.bankStatement && {
      key: 'st',
      label: 'Bank statement',
      url: a.bankStatement.url,
      contentType: a.bankStatement.contentType,
      sizeBytes: a.bankStatement.sizeBytes,
      note: a.statementPassword ? `Password: ${a.statementPassword}` : undefined,
    },
    a.selfie && { key: 'sf', label: 'Selfie', url: a.selfie.url, contentType: a.selfie.contentType, sizeBytes: a.selfie.sizeBytes },
    ...a.businessPhotos.map((d, i) => ({ key: `bp${i}`, label: d.label || `Business photo ${i + 1}`, url: d.url, contentType: d.contentType, sizeBytes: d.sizeBytes })),
  ].filter(Boolean) as DocItem[];

  const approve = async () => {
    const ok = await dialogs.confirm({
      title: `Approve ${naira(a.amount)} for ${a.customerName}?`,
      message: `${agreed ? 'On the changed terms they agreed to. ' : ''}${naira(p.net)} goes into their Kudi9ja wallet now, after the ${naira(p.fee)} management fee. They repay ${naira(p.each)} ${perInstalment(p.frequency)} (${naira(p.base)} + ${naira(p.instalmentFee)} transaction fee) — ${instalmentsPhrase(p.frequency, months)}, ${naira(p.total)} in all. The exact count is fixed today. If they have no loan officer yet, you become it.`,
      confirmLabel: 'Approve and pay out',
    });
    if (ok && (await run(() => adminApi.approveApplication(id), 'Approved — the money is in their wallet'))) {
      await app.refetch();
      await refresh.admin();
    }
  };
  const reject = async () => {
    const reason = await dialogs.reason({ title: 'Decline this application', message: 'The customer reads this reason.', confirmLabel: 'Decline', danger: true });
    if (reason && (await run(() => adminApi.rejectApplication(id, reason), 'Declined'))) {
      await app.refetch();
      await refresh.admin();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back="/admin/lending"
        backLabel="Lending"
        eyebrow="Loan application"
        title={`${naira(a.amount)} for ${a.customerName}`}
        subtitle={`Sent ${asDayTime(a.submittedAt)}`}
        actions={
          <>
            <Pill tone={applicationTone(a.status)}>{a.statusLabel}</Pill>
            {open && (
              <>
                <Button variant="danger" disabled={busy} icon={<X className="h-4 w-4" />} onClick={() => void reject()}>
                  Decline
                </Button>
                <Button variant="ghost" disabled={busy} icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setChanging(true)}>
                  {a.status === 'OFFERED' ? 'Change the offer' : 'Change terms'}
                </Button>
              </>
            )}
            {decide && (
              <Button variant="success" loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => void approve()}>
                Approve
              </Button>
            )}
          </>
        }
      />
      {a.rejectionReason && <Notice tone="danger" title="Declined">{a.rejectionReason}</Notice>}
      {offer && a.status === 'OFFERED' && (
        <Notice tone="info" title="Waiting for the customer">
          Changed terms were sent {asDayTime(offer.offeredAt)}{offer.offeredBy ? ` by ${offer.offeredBy}` : ''}. It comes back here to approve once they agree; if they turn them down, it closes.
        </Notice>
      )}
      {agreed && (
        <Notice tone="success" title="The customer agreed to the changed terms">
          Agreed {asDayTime(offer!.agreedAt!)}. Approving lends on these terms.
        </Notice>
      )}
      {offer && a.status === 'TERMS_DECLINED' && (
        <Notice tone="info" title="The customer turned down the changed terms">
          Nothing was lent and the application is closed.
        </Notice>
      )}
      {changing && (
        <ChangeTerms
          a={a}
          terms={terms}
          onClose={() => setChanging(false)}
          onSent={async () => {
            setChanging(false);
            await app.refetch();
            await refresh.admin();
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionHeader title="The loan" />
          <DetailRows
            rows={[
              ['Amount', naira(a.amount)],
              ['Term', loanLengthDetail(p.frequency, months)],
              offer && offer.months !== a.tenureMonths ? ['Asked for', loanLengthDetail(p.frequency, a.tenureMonths)] : null,
              ['Priced on', offer ? `Changed terms${offer.agreedAt ? ', agreed' : a.status === 'OFFERED' ? ', waiting for the customer' : ''}` : a.groupPricing ? 'Loan group terms' : 'Standard terms'],
              ['Repaid', instalmentsPhrase(p.frequency, months)],
              ['Purpose', a.purpose],
              [offer ? 'Rate' : 'Rate today', `${pct(p.rate)}% flat`],
              [eachInstalment(p.frequency), `${naira(p.each)} (${naira(p.base)} + ${naira(p.instalmentFee)} fee)`],
              [`Transaction fees (${feeRateLabel(p.feeRate)} of each repayment)`, naira(p.fees)],
              ['Total to repay', naira(p.total)],
              ['Management fee', naira(p.fee)],
              { label: 'Paid out', value: naira(p.net), bold: true },
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="The business" action="Customer profile" actionTo={`/admin/customers/${a.userId}`} />
          <DetailRows
            rows={[
              ['Name', a.businessName],
              ['Address', a.businessAddress],
              ['Monthly income', naira(a.monthlyIncome)],
              ['Customer', `${a.customerName} · ${a.customerRef}`],
              a.reviewedAt ? ['Decided', `${asDay(a.reviewedAt)} by ${a.reviewedBy ?? '—'}`] : null,
            ]}
          />
        </Card>
        <OfficersPanel target={{ customerId: a.userId }} />
      </div>

      <Card>
        <SectionHeader title={a.guarantors.length > 1 ? 'Guarantors' : 'Guarantor'} />
        <div className="grid gap-4 md:grid-cols-2">
          {a.guarantors.map((g, i) => (
            <DetailRows
              key={i}
              rows={[
                ['Name', g.fullName],
                ['Relationship', g.relationship],
                ['Phone', g.phone],
                ['BVN', g.bvn],
                ['Address', `${g.address}, ${g.localGovernment}, ${g.state}`],
                ['Landmark', g.landmark],
                g.occupation ? ['Occupation', g.occupation] : null,
                g.email ? ['Email', g.email] : null,
              ]}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Documents" />
        <DocumentGrid items={docs} />
      </Card>
    </div>
  );
}

/**
 * Change the rate, management fee, transaction fee or months, and send them
 * to the customer to agree to or turn down. Starts from what it is priced on
 * now; the rate follows the rate card for a new length until it is typed.
 */
function ChangeTerms({ a, terms, onClose, onSent }: { a: AdminApplicationDetail; terms: PublicSettings; onClose: () => void; onSent: () => Promise<void> }) {
  const { busy, run } = useAction();
  const start = a.offer ?? {
    months: a.tenureMonths,
    flatRate: loanRateFor(terms, a.tenureMonths),
    managementFee: loanPreview(terms, a.amount, a.tenureMonths, a.repaymentFrequency).fee,
    repaymentFeeRate: terms.lending.repaymentFeeRate ?? 0,
  };
  const [months, setMonths] = useState<number | null>(start.months);
  const [rate, setRate] = useState<number | null>(pct(start.flatRate));
  const [rateTyped, setRateTyped] = useState(false);
  const [fee, setFee] = useState<number | null>(start.managementFee);
  const [txFee, setTxFee] = useState<number | null>(pct(start.repaymentFeeRate));
  const [note, setNote] = useState(a.offer?.note ?? '');

  const max = terms.lending.maxTenureMonths;
  const valid = months != null && months >= 1 && months <= max && rate != null && rate >= 0 && rate <= 100
    && fee != null && fee >= 0 && fee < a.amount && txFee != null && txFee >= 0 && txFee <= 20;
  const changed = months !== start.months || rate !== pct(start.flatRate) || fee !== start.managementFee || txFee !== pct(start.repaymentFeeRate);
  const p = valid
    ? loanPreview(terms, a.amount, months!, a.repaymentFrequency, undefined, { flatRate: rate! / 100, managementFee: fee!, repaymentFeeRate: txFee! / 100 })
    : null;

  const send = async () => {
    if (!valid) return;
    const ok = await run(
      () => adminApi.offerApplicationTerms(a.id, { months: months!, interestRatePct: rate!, managementFee: fee!, transactionFeePct: txFee!, note: note.trim() || undefined }),
      'Sent to the customer to agree',
    );
    if (ok) await onSent();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Change the terms"
      description={`${a.customerName} is sent these to agree to or turn down. Nothing is lent until they agree, and it comes back here for approval.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!valid || !changed} onClick={() => void send()}>Send to customer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberInput
            label="Months"
            hint={`1 to ${max}`}
            decimals={0}
            value={months}
            onChange={(n) => {
              setMonths(n);
              if (!rateTyped && n && n >= 1 && n <= max) setRate(pct(loanRateFor(terms, n)));
            }}
          />
          <NumberInput label="Interest rate" hint="Flat, for the whole loan" suffix="%" value={rate} onChange={(n) => { setRate(n); setRateTyped(true); }} />
          <NumberInput label="Management fee" hint="Taken from the payout" suffix="₦" value={fee} onChange={setFee} />
          <NumberInput label="Transaction fee" hint="On each repayment" suffix="%" value={txFee} onChange={setTxFee} />
        </div>
        <Textarea label="Note to the customer (optional)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        {p && (
          <DetailRows
            rows={[
              [eachInstalment(p.frequency), `${naira(p.each)} (${naira(p.base)} + ${naira(p.instalmentFee)} fee)`],
              ['Repaid', instalmentsPhrase(p.frequency, months!)],
              ['Total to repay', naira(p.total)],
              { label: 'Paid out', value: naira(p.net), bold: true },
            ]}
          />
        )}
        {valid && !changed && <p className="text-[12.5px] text-ink-3">Change at least one of the four to send an offer.</p>}
      </div>
    </Modal>
  );
}
