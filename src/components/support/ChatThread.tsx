import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { Download, FileText, ImagePlus, Paperclip, SendHorizontal, X } from 'lucide-react';
import { absoluteUrl } from '../../config';
import { http } from '../../lib/api/client';
import { describeError } from '../../lib/api/errors';
import { cn, downloadFile } from '../../lib/cn';
import { asDay, asTime, fileSize } from '../../lib/format';
import type { SupportMessage } from '../../types/api';
import { AuthImage } from '../ui/AuthImage';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.odt';

const isImage = (type?: string) => !!type && type.startsWith('image/') && type !== 'image/heic';

/**
 * One conversation: the messages, newest at the bottom, and the box to write
 * in. Photos show inline and open full size; other files download. A photo
 * can be attached, dropped onto the thread, or pasted straight from the
 * clipboard.
 */
export function ChatThread({
  messages,
  typingName,
  onSend,
  onAttach,
  onTyping,
  disabled,
  disabledNote,
  placeholder = 'Write a message…',
  className,
}: {
  messages: SupportMessage[];
  typingName?: string | null;
  onSend: (body: string) => Promise<unknown>;
  onAttach: (file: File, body?: string) => Promise<unknown>;
  onTyping?: () => void;
  disabled?: boolean;
  disabledNote?: string;
  placeholder?: string;
  className?: string;
}) {
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<SupportMessage | null>(null);

  // Stay pinned to the newest message.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typingName]);

  useEffect(() => {
    if (!file || !isImage(file.type)) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const groups = useMemo(() => {
    const out: { day: string; items: SupportMessage[] }[] = [];
    for (const m of messages) {
      const day = asDay(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error('That file is over 12MB. Send a smaller one.');
      return;
    }
    setFile(f);
    textarea.current?.focus();
  };

  const send = async () => {
    const body = draft.trim();
    if ((!body && !file) || sending || disabled) return;
    setSending(true);
    try {
      if (file) await onAttach(file, body || undefined);
      else await onSend(body);
      setDraft('');
      setFile(null);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setSending(false);
      textarea.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const onChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (onTyping && value && now - lastTyping.current > 3000) {
      lastTyping.current = now;
      onTyping();
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      pick(item);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={cn('relative flex min-h-0 flex-col', className)}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={disabled ? undefined : onDrop}
    >
      <div ref={scroller} className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {groups.map((g) => (
          <div key={g.day} className="space-y-2.5">
            <div className="flex justify-center">
              <span className="rounded-full bg-surface-alt px-3 py-1 text-[11px] font-semibold text-ink-3">{g.day}</span>
            </div>
            {g.items.map((m) => (
              <Bubble key={m.id} m={m} onView={() => setViewing(m)} />
            ))}
          </div>
        ))}
        {typingName && (
          <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
            {typingName} is typing…
          </div>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-gold bg-canvas/80 text-sm font-bold text-gold">
          Drop a photo or document to send it
        </div>
      )}

      <div className="border-t border-stroke bg-surface/80 p-3 backdrop-blur sm:p-4">
        {disabled ? (
          <p className="py-2 text-center text-[13px] text-ink-3">{disabledNote ?? 'You cannot reply here.'}</p>
        ) : (
          <>
            {file && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-stroke bg-surface-alt/60 p-2.5">
                {preview ? (
                  <img src={preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-lg bg-gold/10 text-gold">
                    <FileText className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{file.name || 'Pasted image'}</p>
                  <p className="text-[12px] text-ink-3">{fileSize(file.size)} · add a message or just send</p>
                </div>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => setFile(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (fileInput.current) {
                    fileInput.current.accept = 'image/jpeg,image/png,image/webp,image/heic';
                    fileInput.current.click();
                  }
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-stroke text-ink-2 transition hover:border-gold/40 hover:text-gold"
                aria-label="Send a photo"
                title="Send a photo"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInput.current) {
                    fileInput.current.accept = ACCEPT;
                    fileInput.current.click();
                  }
                }}
                className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-stroke text-ink-2 transition hover:border-gold/40 hover:text-gold sm:grid"
                aria-label="Attach a document"
                title="Attach a document"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                ref={textarea}
                rows={1}
                value={draft}
                maxLength={4000}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKey}
                onPaste={onPaste}
                placeholder={placeholder}
                className="scrollbar-thin max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-stroke bg-surface px-3.5 py-2.5 text-[14px] outline-none transition placeholder:text-ink-3 focus:border-gold/60 [field-sizing:content]"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!draft.trim() && !file)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl gold-gradient text-on-gold shadow-gold transition disabled:opacity-40"
                aria-label="Send"
              >
                {sending ? <Spinner className="h-4 w-4" /> : <SendHorizontal className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-2 hidden text-[11.5px] text-ink-3 sm:block">
              Enter to send · Shift + Enter for a new line · paste or drop a photo to attach it
            </p>
          </>
        )}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.attachmentName} size="xl">
        {viewing?.attachmentUrl && (
          <AuthImage url={viewing.attachmentUrl} alt={viewing.attachmentName ?? 'Photo'} fit="contain" className="h-[70vh] rounded-xl" />
        )}
      </Modal>
    </div>
  );
}

function Bubble({ m, onView }: { m: SupportMessage; onView: () => void }) {
  if (m.author === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <p className="max-w-md rounded-xl border border-stroke bg-surface-alt/50 px-3.5 py-2 text-center text-[12.5px] text-ink-2">
          {m.body}
          <span className="ml-1.5 text-ink-3">· {asTime(m.createdAt)}</span>
        </p>
      </div>
    );
  }
  return (
    <div className={cn('flex animate-rise flex-col', m.mine ? 'items-end' : 'items-start')}>
      {!m.mine && <span className="mb-1 px-1 text-[11.5px] font-semibold text-ink-3">{m.authorName}</span>}
      <div
        className={cn(
          'max-w-[85%] overflow-hidden rounded-2xl sm:max-w-[70%]',
          m.mine ? 'rounded-br-md gold-gradient text-on-gold' : 'rounded-bl-md border border-stroke bg-surface',
        )}
      >
        {m.attachmentUrl && isImage(m.attachmentType) && (
          <button type="button" onClick={onView} className="block w-full" aria-label={`Open ${m.attachmentName ?? 'photo'}`}>
            <AuthImage url={m.attachmentUrl} alt={m.attachmentName ?? 'Photo'} className="h-56 w-72 max-w-full" />
          </button>
        )}
        {m.attachmentUrl && !isImage(m.attachmentType) && <FileChip m={m} />}
        {m.body && <p className="whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14px] leading-relaxed">{m.body}</p>}
      </div>
      <span className="mt-1 px-1 text-[11px] text-ink-3">{asTime(m.createdAt)}</span>
    </div>
  );
}

function FileChip({ m }: { m: SupportMessage }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (!m.attachmentUrl) return;
    setBusy(true);
    try {
      const blob = await http.blob(absoluteUrl(m.attachmentUrl));
      downloadFile(m.attachmentName ?? 'attachment', blob, blob.type);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void download()}
      className={cn('flex w-72 max-w-full items-center gap-3 px-3.5 py-3 text-left', m.mine ? '' : 'hover:bg-surface-alt/60')}
    >
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', m.mine ? 'bg-black/10' : 'bg-gold/10 text-gold')}>
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{m.attachmentName}</span>
        <span className="block text-[11.5px] opacity-70">{m.attachmentSize ? fileSize(m.attachmentSize) : 'File'}</span>
      </span>
      {busy ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4 opacity-70" />}
    </button>
  );
}

