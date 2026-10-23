import { ArrowRight, Gavel, Handshake, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/Brand';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { IconBadge } from '../../components/ui/Bits';
import { Skeleton } from '../../components/ui/Spinner';
import { useLegalDocuments } from '../../hooks/queries';
import { asDay } from '../../lib/format';
import { useSettings } from '../../state/settings';
import type { LegalKind } from '../../types/api';

const ORDER: { kind: LegalKind; icon: typeof Gavel }[] = [
  { kind: 'terms', icon: Gavel },
  { kind: 'privacy', icon: ShieldCheck },
  { kind: 'lending', icon: Handshake },
];

export default function LegalIndex({ embedded }: { embedded?: boolean }) {
  const s = useSettings();
  const { data, isLoading } = useLegalDocuments();
  const base = embedded ? '/app/legal' : '/legal';

  const content = (
    <>
      <PageHeader
        title="Legal"
        subtitle="The agreements you have with us. Every rate, fee and limit quoted in them is the one Kudi9ja is applying today."
        back={embedded ? '/app/profile' : undefined}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map(({ kind, icon: Icon }) => {
          const doc = data?.[kind];
          return (
            <Card key={kind} to={`${base}/${kind}`} className="flex flex-col">
              <IconBadge>
                <Icon />
              </IconBadge>
              {doc ? (
                <>
                  <h2 className="mt-4 text-lg font-extrabold">{doc.title}</h2>
                  <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-ink-2">{doc.summary}</p>
                  <p className="mt-4 text-[12px] text-ink-3">
                    v{doc.version} · {asDay(doc.effectiveFrom)} · {doc.readMinutes} min read
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-gold">
                    Read it <ArrowRight className="h-4 w-4" />
                  </span>
                </>
              ) : (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  {!isLoading && <p className="text-[12.5px] text-ink-3">Could not load this document.</p>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <Card className="mt-6">
        <p className="eyebrow">The company behind Kudi9ja</p>
        <p className="mt-2 font-bold">{s.company.legalName}</p>
        <p className="text-[13.5px] text-ink-2">{s.company.rcNumber} · Lagos, Nigeria</p>
        <div className="mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
          <a href={`mailto:${s.company.legalEmail}`} className="text-ink-2 hover:text-gold">
            <span className="block font-bold text-ink">{s.company.legalEmail}</span>Terms and agreements
          </a>
          <a href={`mailto:${s.company.privacyEmail}`} className="text-ink-2 hover:text-gold">
            <span className="block font-bold text-ink">{s.company.privacyEmail}</span>Privacy and your data
          </a>
          <a href={`mailto:${s.company.supportEmail}`} className="text-ink-2 hover:text-gold">
            <span className="block font-bold text-ink">{s.company.supportEmail}</span>General support
          </a>
        </div>
      </Card>
    </>
  );

  if (embedded) return content;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandLogo height={36} to="/" />
        <Link to="/signin" className="text-[13.5px] font-bold text-gold hover:underline">
          Sign in
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-4 sm:px-8">{content}</main>
    </div>
  );
}
