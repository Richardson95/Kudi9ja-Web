import { ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { BrandMark } from '../../../components/Brand';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/Bits';
import { downloadFile } from '../../../lib/cn';
import { asDayTime, firstName } from '../../../lib/format';
import { useSettings } from '../../../state/settings';
import type { SessionResponse } from '../../../types/api';
import { signedRecordHtml, type SignedRecord } from './AgreementsStep';

/** The account is open. Keep a copy of what was signed, then go in. */
export function Welcome({ session, record, onContinue }: { session: SessionResponse; record: SignedRecord; onContinue: () => void }) {
  const settings = useSettings();
  const ref = session.profile.customerRef;

  return (
    <div className="night-gradient grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-lg animate-rise text-center">
        <div className="relative mx-auto mb-8 w-fit">
          <span className="absolute inset-0 animate-glow rounded-full bg-success/30 blur-2xl" />
          <span className="relative grid h-24 w-24 animate-pop-in place-items-center rounded-full bg-success text-white">
            <CheckCircle2 className="h-12 w-12" />
          </span>
        </div>
        <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">Welcome to Kudi9ja, {firstName(session.profile.fullName)}</h1>
        <p className="mt-2 text-ink-2">Your account is open and your agreements are signed.</p>

        <Card className="mt-8 text-left" gradient accent="gold">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] text-ink-3">Your customer reference</p>
              <p className="font-mono text-xl font-bold text-gold">{ref}</p>
            </div>
            <CopyButton value={ref} label="Reference copied" />
          </div>
          <DetailRows
            rows={[
              ['Signed', asDayTime(record.signedAt)],
              ...record.documents.map((d) => [d.title, `v${d.version} · accepted`] as const),
            ]}
          />
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
            Your reference is how we match a bank transfer to you. It is not an account number — Kudi9ja issues none.
          </p>
        </Card>

        <div className="mt-6 space-y-3">
          <Button
            variant="ghost"
            block
            icon={<Download className="h-4 w-4" />}
            onClick={() => downloadFile(`Kudi9ja-agreement-${ref}.html`, signedRecordHtml(record, ref, settings.company), 'text/html')}
          >
            Download a copy of what I signed
          </Button>
          <Button size="lg" block onClick={onContinue} iconRight={<ArrowRight className="h-5 w-5" />}>
            Go to my dashboard
          </Button>
        </div>
        <BrandMark size={28} className="mx-auto mt-10 opacity-60" />
      </div>
    </div>
  );
}
