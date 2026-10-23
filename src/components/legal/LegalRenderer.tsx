import { Fragment, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { LegalBlock, LegalDocument, LegalSection } from '../../types/api';

/** The server sends the body as the sections array (or, defensively, wrapped). */
export function sectionsOf(doc: LegalDocument): LegalSection[] {
  const body = doc.body as unknown;
  if (Array.isArray(body)) return body as LegalSection[];
  if (body && typeof body === 'object' && Array.isArray((body as { sections?: unknown }).sections)) {
    return (body as { sections: LegalSection[] }).sections;
  }
  if (typeof body === 'string') return [{ title: doc.title, blocks: [{ type: 'text', text: body }] }];
  return [];
}

/** **bold** spans, which is the only markup the documents use. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-bold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="text-[14.5px] leading-[1.75] text-ink-2">{inline(block.text)}</p>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={cn('space-y-2 pl-5 text-[14.5px] leading-[1.7] text-ink-2', block.ordered ? 'list-decimal' : 'list-disc marker:text-gold')}>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </Tag>
      );
    }
    case 'note': {
      const tone = block.tone ?? 'neutral';
      const Icon = tone === 'caution' ? AlertTriangle : tone === 'positive' ? CheckCircle2 : Info;
      return (
        <div
          className={cn(
            'flex gap-3 rounded-2xl border p-4',
            tone === 'caution' ? 'border-gold/30 bg-gold/[0.07]' : tone === 'positive' ? 'border-success/30 bg-success/[0.07]' : 'border-info/25 bg-info/[0.06]',
          )}
        >
          <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', tone === 'caution' ? 'text-gold' : tone === 'positive' ? 'text-success' : 'text-info')} />
          <div className="text-[14px] leading-relaxed text-ink-2">
            {block.title && <p className="mb-1 font-extrabold text-ink">{block.title}</p>}
            {inline(block.text)}
          </div>
        </div>
      );
    }
    case 'definitions':
      return (
        <dl className="divide-y divide-stroke overflow-hidden rounded-2xl border border-stroke">
          {block.entries.map((e, i) => (
            <div key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="text-[13.5px] font-bold">{e.term}</dt>
              <dd className="text-[14px] leading-relaxed text-ink-2">{inline(e.meaning)}</dd>
            </div>
          ))}
        </dl>
      );
    case 'example':
      return (
        <div className="overflow-hidden rounded-2xl border border-gold/25">
          {block.title && <p className="border-b border-gold/20 bg-gold/[0.07] px-4 py-2.5 text-[13px] font-extrabold text-gold">{block.title}</p>}
          <div className="divide-y divide-stroke">
            {block.rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13.5px]">
                <span className="text-ink-2">{r.label}</span>
                <span className="num text-right font-bold">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function LegalBody({ doc, compact }: { doc: LegalDocument; compact?: boolean }) {
  const sections = sectionsOf(doc);
  return (
    <div className={cn('space-y-10', compact && 'space-y-8')}>
      {sections.map((section, i) => (
        <section key={i} id={`section-${i + 1}`} className="scroll-mt-24">
          <h2 className="mb-4 flex items-baseline gap-3 text-[18px] font-extrabold tracking-[-0.015em]">
            <span className="num text-[13px] font-extrabold text-gold">{String(i + 1).padStart(2, '0')}</span>
            {section.title}
          </h2>
          <div className="space-y-4">
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LegalContents({ doc }: { doc: LegalDocument }) {
  return (
    <ol className="space-y-1">
      {sectionsOf(doc).map((s, i) => (
        <li key={i}>
          <a href={`#section-${i + 1}`} className="flex gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] text-ink-3 transition hover:bg-surface-alt hover:text-ink">
            <span className="num font-bold text-gold">{i + 1}</span>
            <span className="leading-snug">{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
