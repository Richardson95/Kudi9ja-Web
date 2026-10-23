import { useState } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import { absoluteUrl } from '../../config';
import { http } from '../../lib/api/client';
import { describeError } from '../../lib/api/errors';
import { cn, downloadFile } from '../../lib/cn';
import { asDay, fileSize } from '../../lib/format';
import { AuthImage } from '../ui/AuthImage';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';

export interface DocItem {
  key: string;
  label: string;
  url: string;
  contentType?: string;
  sizeBytes?: number;
  note?: string;
  date?: string;
  onRemove?: () => void;
}

const isPicture = (type?: string) => !!type && type.startsWith('image/') && type !== 'image/heic';

/** A grid of protected documents: photos preview and open large; anything else downloads. */
export function DocumentGrid({ items, className }: { items: DocItem[]; className?: string }) {
  const [viewing, setViewing] = useState<DocItem | null>(null);
  if (!items.length) return <p className="text-[13px] text-ink-3">No documents.</p>;
  return (
    <>
      <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {items.map((d) => (
          <DocumentTile key={d.key} doc={d} onView={() => setViewing(d)} />
        ))}
      </div>
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.label} size="xl">
        {viewing && <AuthImage url={viewing.url} alt={viewing.label} fit="contain" className="h-[72vh] rounded-xl" />}
      </Modal>
    </>
  );
}

function DocumentTile({ doc, onView }: { doc: DocItem; onView: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const picture = isPicture(doc.contentType);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await http.blob(absoluteUrl(doc.url));
      downloadFile(doc.label.replace(/[^\w.-]+/g, '-'), blob, blob.type);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-stroke bg-surface">
      {picture ? (
        <button type="button" onClick={onView} className="block w-full" aria-label={`Open ${doc.label}`}>
          <AuthImage url={doc.url} alt={doc.label} className="h-40 w-full" />
        </button>
      ) : (
        <button type="button" onClick={() => void download()} className="grid h-40 w-full place-items-center bg-surface-alt/50 text-ink-3 hover:text-gold">
          {busy ? <Spinner className="h-6 w-6" /> : <FileText className="h-10 w-10" />}
        </button>
      )}
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{doc.label}</p>
          <p className="truncate text-[11.5px] text-ink-3">
            {[doc.note, doc.sizeBytes ? fileSize(doc.sizeBytes) : null, doc.date ? asDay(doc.date) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" onClick={() => void download()} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:text-gold" aria-label="Download">
          <Download className="h-4 w-4" />
        </button>
        {doc.onRemove && (
          <button type="button" onClick={doc.onRemove} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:text-danger" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
