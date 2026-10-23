import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ClipboardList, X } from 'lucide-react';
import { DocumentGrid, type DocItem } from '../../components/admin/Documents';
import { OfficersPanel } from '../../components/admin/OfficersPanel';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, Notice, Pill } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys, useRefresh } from '../../hooks/queries';
import { adminApi } from '../../lib/api/endpoints';
import { asDay, asDayTime, naira } from '../../lib/format';
import { loanPreview } from '../../lib/finance';
import { applicationTone, can } from '../../lib/labels';
import { useSession } from '../../state/session';
import { useSettings } from '../../state/settings';

export default function ApplicationDetail() {
  const { id = '' } = useParams();
  const { adminRole, stage, isAdmin } = useSession();
  const s = useSettings();
  const app = useQuery({ queryKey: keys.admin.application(id), queryFn: () => adminApi.loanApplication(id), enabled: stage === 'unlocked' && isAdmin });
  const dialogs = useDialogs();
  const refresh = useRefresh();
  const { busy, run } = useAction();

  if (app.isLoading) return <PageSpinner />;
  const a = app.data;
  if (!a) return <EmptyState icon={<ClipboardList />} title="Application not found" />;
  const p = loanPreview(s, a.amount, a.tenureMonths);
  const decide = can.actOnLoans(adminRole) && a.status === 'PENDING';

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
      message: `${naira(p.net)} goes into their Kudi9ja wallet now, after the ${naira(p.fee)} management fee and ${naira(p.transactionFee)} transaction fee. They repay ${naira(p.monthly)} a month for ${a.tenureMonths} months. If they have no loan officer yet, you become it.`,
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
            {decide && (
              <>
                <Button variant="danger" disabled={busy} icon={<X className="h-4 w-4" />} onClick={() => void reject()}>
                  Decline
                </Button>
                <Button variant="success" loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => void approve()}>
                  Approve
                </Button>
              </>
            )}
          </>
        }
      />
      {a.rejectionReason && <Notice tone="danger" title="Declined">{a.rejectionReason}</Notice>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionHeader title="The loan" />
          <DetailRows
            rows={[
              ['Amount', naira(a.amount)],
              ['Term', `${a.tenureMonths} months`],
              ['Purpose', a.purpose],
              ['Rate today', `${Math.round(p.rate * 10000) / 100}% flat`],
              ['Monthly', naira(p.monthly)],
              ['Management fee', naira(p.fee)],
              ['Transaction fee', naira(p.transactionFee)],
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
