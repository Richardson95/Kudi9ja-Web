import { useState, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Landmark,
  ReceiptText,
  Users,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { IconBadge, Notice, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { adminApi } from '../../lib/api/endpoints';
import { downloadExcel, downloadPdf } from '../../lib/exports';
import { isoDate } from '../../lib/format';
import { can } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { ExportReportName } from '../../types/api';

const REPORTS: { name: ExportReportName; title: string; body: string; icon: ReactNode; dated: string }[] = [
  { name: 'customers', title: 'Customers', body: 'Everyone with an account: contact details, status, loan group, lead officer and wallet balance.', icon: <Users />, dated: 'joined' },
  { name: 'loans', title: 'Loans', body: 'Every loan: amount, term, weekly or monthly, fees, paid out, total to repay, repaid and outstanding.', icon: <HandCoins />, dated: 'paid out' },
  { name: 'repayments', title: 'Loan repayments', body: 'Every repayment, from the wallet, through Paystack, or recorded by hand.', icon: <ReceiptText />, dated: 'paid' },
  { name: 'transactions', title: 'Wallet transactions', body: 'The full ledger: every naira in and out of every wallet, with the balance after.', icon: <Landmark />, dated: 'happened' },
  { name: 'paystack', title: 'Paystack payments', body: 'Pay-ins and repayments through Paystack, with channel, fee and status.', icon: <ArrowDownLeft />, dated: 'started' },
  { name: 'withdrawals', title: 'Withdrawals', body: 'Every withdrawal request, who decided it, and whether it was paid out.', icon: <ArrowUpRight />, dated: 'requested' },
  { name: 'applications', title: 'Loan applications', body: 'Every application, its decision, and the reason given when declined.', icon: <ClipboardList />, dated: 'submitted' },
];

type Range = 'all' | 'month' | 'lastMonth' | 'year' | 'custom';

function rangeDates(range: Range, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  switch (range) {
    case 'month':
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
    case 'lastMonth':
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case 'year':
      return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: isoDate(now) };
    case 'custom':
      return { from: from || undefined, to: to || undefined };
    default:
      return {};
  }
}

/**
 * Reports to download as Excel or PDF. The server gathers the rows (and logs
 * who took them); the file is built here in the browser.
 */
export default function Reports() {
  const { adminRole } = useSession();
  const toast = useToast();
  const allowed = can.exportReports(adminRole);
  const [range, setRange] = useState<Range>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const period = rangeDates(range, from, to);
  const badRange = range === 'custom' && !!from && !!to && from > to;

  const download = async (name: ExportReportName, format: 'excel' | 'pdf') => {
    setBusy(`${name}-${format}`);
    try {
      const report = await adminApi.exportReport(name, period.from, period.to);
      if (!report.rows.length) {
        toast.info(`Nothing in ${report.title.toLowerCase()} for ${report.period.toLowerCase()}.`);
        return;
      }
      await (format === 'excel' ? downloadExcel(report) : downloadPdf(report));
      toast.success(`${report.title} downloaded · ${report.rows.length} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The report could not be downloaded. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Download for Excel, or as a PDF to print or share. Every download is recorded in the audit log." />

      {!allowed && <Notice tone="info">Only owners and administrators can download reports. They hold customers' personal data.</Notice>}

      <Card className="space-y-4">
        <p className="text-sm font-bold">Period</p>
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: 'month', label: 'This month' },
            { value: 'lastMonth', label: 'Last month' },
            { value: 'year', label: 'This year' },
            { value: 'all', label: 'All time' },
            { value: 'custom', label: 'Choose dates' },
          ]}
        />
        {range === 'custom' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} error={badRange ? 'Ends before it starts' : null} />
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.name} className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <IconBadge>{r.icon}</IconBadge>
              <div className="min-w-0">
                <p className="font-bold">{r.title}</p>
                <p className="text-[12.5px] text-ink-3">{r.body}</p>
                <p className="mt-1 text-[11.5px] text-ink-3">Dated by when it {r.dated}.</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!allowed || badRange || (!!busy && busy !== `${r.name}-excel`)}
                loading={busy === `${r.name}-excel`}
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={() => void download(r.name, 'excel')}
              >
                Excel
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!allowed || badRange || (!!busy && busy !== `${r.name}-pdf`)}
                loading={busy === `${r.name}-pdf`}
                icon={<FileText className="h-4 w-4" />}
                onClick={() => void download(r.name, 'pdf')}
              >
                PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
