import { useParams } from 'react-router-dom';
import { Download, ReceiptText } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState, IconBadge, Pill } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { PageSpinner } from '../../../components/ui/Spinner';
import { useTransaction } from '../../../hooks/queries';
import { downloadFile } from '../../../lib/cn';
import { asDayTime, naira } from '../../../lib/format';
import { txIcon, txStatusTone, txTone } from '../../../lib/labels';
import { useProfile } from '../../../state/session';
import { useSettings } from '../../../state/settings';

export default function Receipt() {
  const { id = '' } = useParams();
  const tx = useTransaction(id);
  const profile = useProfile();
  const settings = useSettings();

  if (tx.isLoading) return <PageSpinner />;
  if (!tx.data) {
    return (
      <EmptyState
        icon={<ReceiptText />}
        title="Transaction not found"
        message="It may belong to another account."
        action={<Button to="/app/wallet">Back to wallet</Button>}
      />
    );
  }
  const t = tx.data;
  const Icon = txIcon[t.kind];
  const rows: [string, string][] = [
    ['Type', t.kindLabel],
    ['Status', t.statusLabel],
    ['Date', asDayTime(t.occurredAt)],
    ['Reference', t.reference],
    ...(t.counterparty ? ([['Counterparty', t.counterparty]] as [string, string][]) : []),
    ['Balance after', naira(t.balanceAfter)],
    ['Account', `${profile.fullName} · ${profile.customerRef}`],
  ];

  const download = () => {
    const text = [
      `${settings.company.productName} — transaction receipt`,
      settings.company.legalName,
      '',
      `${t.credit ? 'Credit' : 'Debit'}: ${naira(t.amount)}`,
      t.description,
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
    ].join('\n');
    downloadFile(`kudi9ja-receipt-${t.reference}.txt`, text, 'text/plain');
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back="/app/wallet" backLabel="Wallet" title="Receipt" />
      <Card className="p-7">
        <div className="text-center">
          <IconBadge tone={txTone(t.kind, t.credit)} size={60} className="mx-auto">
            <Icon />
          </IconBadge>
          <p className={`num mt-4 text-[34px] font-extrabold ${t.credit ? 'text-success' : ''}`}>
            {t.credit ? '+' : '-'}
            {naira(t.amount)}
          </p>
          <p className="mt-1 text-sm text-ink-2">{t.description}</p>
          <Pill tone={txStatusTone(t.status)} className="mt-3">
            {t.statusLabel}
          </Pill>
        </div>
        <div className="my-6 border-t border-dashed border-stroke" />
        <DetailRows rows={rows} />
        <Button block variant="ghost" className="mt-6" icon={<Download className="h-4 w-4" />} onClick={download}>
          Download receipt
        </Button>
      </Card>
    </div>
  );
}
