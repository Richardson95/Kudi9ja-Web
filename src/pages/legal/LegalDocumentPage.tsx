import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { BrandLogo } from '../../components/Brand';
import { LegalBody, LegalContents } from '../../components/legal/LegalRenderer';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';
import { useLegalDocument } from '../../hooks/queries';
import { asDay } from '../../lib/format';
import type { LegalKind } from '../../types/api';
import NotFound from '../public/NotFound';

export default function LegalDocumentPage({ embedded }: { embedded?: boolean }) {
  const { kind } = useParams();
  const valid = kind === 'terms' || kind === 'privacy' || kind === 'lending';
  const { data: doc, isLoading } = useLegalDocument((valid ? kind : 'terms') as LegalKind);
  if (!valid) return <NotFound embedded={embedded} />;

  const content = isLoading || !doc ? (
    <PageSpinner label="Opening the document…" />
  ) : (
    <>
      <PageHeader
        title={doc.title}
        subtitle={`Version ${doc.version} · in force from ${asDay(doc.effectiveFrom)} · ${doc.readMinutes} min read`}
        back={embedded ? '/app/legal' : '/legal'}
        backLabel="All documents"
        actions={
          <Button variant="ghost" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Print or save
          </Button>
        }
      />
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="eyebrow mb-2 px-2">Contents</p>
            <LegalContents doc={doc} />
          </div>
        </aside>
        <article className="max-w-3xl">
          <p className="mb-8 rounded-2xl border border-stroke bg-surface p-5 text-[15px] leading-relaxed text-ink-2">{doc.summary}</p>
          <LegalBody doc={doc} />
        </article>
      </div>
    </>
  );

  if (embedded) return content;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandLogo height={36} to="/" />
        <Link to="/signin" className="text-[13.5px] font-bold text-gold hover:underline">
          Sign in
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-4 sm:px-8">{content}</main>
    </div>
  );
}
