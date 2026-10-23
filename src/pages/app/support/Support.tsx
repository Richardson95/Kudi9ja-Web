import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, Headset, MessageSquarePlus, MessagesSquare, ShieldAlert } from 'lucide-react';
import { usePageTitle } from '../../../components/PageHeader';
import { ChatThread } from '../../../components/support/ChatThread';
import { ChoiceTiles, EmptyState, IconBadge, Pill } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Skeleton, Spinner } from '../../../components/ui/Spinner';
import { useAction } from '../../../hooks/useAction';
import { supportKeys, useMyConversations, useSupportThread, useSupportTopics, useTyping } from '../../../hooks/support';
import { supportApi } from '../../../lib/api/endpoints';
import { cn } from '../../../lib/cn';
import { asDayTime, relative } from '../../../lib/format';
import { supportTone } from '../../../lib/labels';
import { useSettings } from '../../../state/settings';
import type { SupportConversation, SupportKind, SupportThread } from '../../../types/api';

/**
 * Help and complaints. The list on the left, the conversation on the right;
 * on a phone, one at a time. Replies from the team arrive live.
 */
export default function Support() {
  usePageTitle('Help & complaints');
  const { id } = useParams();
  const list = useMyConversations();
  const [composing, setComposing] = useState(false);
  const settings = useSettings();

  return (
    <div className="h-full">
      <div className="grid h-full lg:grid-cols-[340px_1fr]">
        <aside className={cn('flex min-h-0 flex-col border-r border-stroke bg-surface/40', id && 'hidden lg:flex')}>
          <div className="flex items-center justify-between gap-3 border-b border-stroke p-4">
            <div>
              <h1 className="text-lg font-extrabold">Help & complaints</h1>
              <p className="text-[12.5px] text-ink-3">Talk to the Kudi9ja team</p>
            </div>
            <Button size="sm" icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => setComposing(true)}>
              New
            </Button>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {list.isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : list.data?.length ? (
              <ul className="divide-y divide-stroke">
                {list.data.map((c) => (
                  <ConversationRow key={c.id} c={c} active={c.id === id} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<MessagesSquare />}
                title="No conversations yet"
                message="Ask a question or make a complaint, and the team will reply here."
                action={<Button onClick={() => setComposing(true)}>Start one</Button>}
              />
            )}
          </div>
          <p className="border-t border-stroke p-4 text-[12px] text-ink-3">
            Prefer email? {settings.company.supportEmail}
            {settings.company.supportPhone ? ` · ${settings.company.supportPhone}` : ''}
          </p>
        </aside>

        <section className={cn('min-h-0', !id && 'hidden lg:block')}>
          {id ? (
            <Conversation id={id} />
          ) : (
            <div className="grid h-full place-items-center p-8">
              <EmptyState
                icon={<Headset />}
                title="We are here to help"
                message="Choose a conversation, or start a new one. Complaints are acknowledged and resolved within the times in our Terms."
                action={<Button onClick={() => setComposing(true)}>Start a conversation</Button>}
              />
            </div>
          )}
        </section>
      </div>

      <NewConversation open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}

function ConversationRow({ c, active }: { c: SupportConversation; active: boolean }) {
  return (
    <li>
      <Link
        to={`/app/support/${c.id}`}
        className={cn('flex gap-3 px-4 py-3.5 transition hover:bg-surface-alt/60', active && 'bg-gold/[0.07]')}
      >
        <IconBadge size={38} tone={c.kind === 'COMPLAINT' ? 'danger' : 'info'}>
          {c.kind === 'COMPLAINT' ? <ShieldAlert /> : <MessagesSquare />}
        </IconBadge>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('truncate text-sm', c.unread ? 'font-extrabold' : 'font-semibold')}>{c.subject}</p>
            <span className="shrink-0 text-[11px] text-ink-3">{relative(c.lastMessageAt)}</span>
          </div>
          <p className="truncate text-[12.5px] text-ink-3">{c.lastMessagePreview}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Pill tone={supportTone(c.status)}>{c.statusLabel}</Pill>
            <span className="text-[11px] text-ink-3">{c.reference}</span>
            {c.unread > 0 && (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[10.5px] font-extrabold text-on-gold">
                {c.unread}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Conversation({ id }: { id: string }) {
  const thread = useSupportThread('customer', id);
  const typingName = useTyping(id);
  const qc = useQueryClient();
  const { busy, run } = useAction();

  if (thread.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner className="h-6 w-6 text-gold" />
      </div>
    );
  }
  if (!thread.data) {
    return <EmptyState icon={<MessagesSquare />} title="Conversation not found" action={<Button to="/app/support">Back</Button>} />;
  }
  const c = thread.data.conversation;

  // Our own message is added straight away; the live stream's copy is ignored as a duplicate.
  const add = (m: SupportThread['messages'][number]) =>
    qc.setQueryData<SupportThread>(supportKeys.thread('customer', id), (old) =>
      old && !old.messages.some((x) => x.id === m.id) ? { ...old, messages: [...old.messages, m] } : old,
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-stroke bg-surface/60 px-4 py-3 backdrop-blur sm:px-6">
        <Link to="/app/support" className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-alt lg:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{c.subject}</p>
          <p className="text-[12px] text-ink-3">
            {c.kindLabel} · {c.category} · {c.reference}
            {c.assignedToName ? ` · with ${c.assignedToName.split(' ')[0]}` : ''}
          </p>
        </div>
        <Pill tone={supportTone(c.status)}>{c.statusLabel}</Pill>
        {c.status !== 'RESOLVED' && (
          <Button
            size="sm"
            variant="ghost"
            loading={busy}
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() =>
              void run(async () => {
                const updated = await supportApi.resolve(id);
                qc.setQueryData<SupportThread>(supportKeys.thread('customer', id), (old) => (old ? { ...old, conversation: updated } : old));
                void qc.invalidateQueries({ queryKey: supportKeys.list('customer') });
              }, 'Marked as sorted')
            }
          >
            It is sorted
          </Button>
        )}
      </header>

      {c.kind === 'COMPLAINT' && c.status !== 'RESOLVED' && c.resolveBy && (
        <div className="flex items-center gap-2 border-b border-stroke bg-gold/[0.06] px-4 py-2 text-[12.5px] text-ink-2 sm:px-6">
          <Clock className="h-4 w-4 text-gold" />
          {c.acknowledgedAt
            ? `We aim to resolve this by ${asDayTime(c.resolveBy)}.`
            : `A reply is due by ${asDayTime(c.acknowledgeBy)}; resolution by ${asDayTime(c.resolveBy)}.`}
        </div>
      )}

      <ChatThread
        className="flex-1"
        messages={thread.data.messages}
        typingName={typingName}
        onSend={async (body) => add(await supportApi.send(id, body))}
        onAttach={async (file, body) => add(await supportApi.attach(id, file, body))}
        onTyping={() => void supportApi.typing(id).catch(() => undefined)}
        placeholder={c.status === 'RESOLVED' ? 'Writing again reopens this conversation…' : 'Write a message…'}
      />
    </div>
  );
}

function NewConversation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const topics = useSupportTopics();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { busy, run } = useAction();
  const [kind, setKind] = useState<SupportKind>('ENQUIRY');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const valid = !!category && subject.trim().length >= 4 && message.trim().length > 0;

  const submit = async () => {
    const thread = await run(() => supportApi.open({ kind, category, subject: subject.trim(), message: message.trim() }));
    if (!thread) return;
    qc.setQueryData(supportKeys.thread('customer', thread.conversation.id), thread);
    void qc.invalidateQueries({ queryKey: supportKeys.list('customer') });
    setSubject('');
    setMessage('');
    setCategory('');
    onClose();
    navigate(`/app/support/${thread.conversation.id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy}
      title="Talk to the Kudi9ja team"
      description="You can send photos and documents once the conversation is open."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!valid} loading={busy}>
            {kind === 'COMPLAINT' ? 'Submit complaint' : 'Send'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ChoiceTiles<SupportKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'ENQUIRY', label: 'A question', sub: 'How something works' },
            { value: 'COMPLAINT', label: 'A complaint', sub: 'Something went wrong' },
          ]}
        />
        <Select
          label="Topic"
          placeholder="Choose a topic"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={topics.data ?? []}
        />
        <Input label="Title" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="e.g. My withdrawal has not arrived" />
        <Textarea
          label="What happened?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="Include dates, amounts and any reference numbers."
        />
        {kind === 'COMPLAINT' && (
          <p className="text-[12.5px] text-ink-3">
            You will get a complaint reference at once, and the times by which we will reply and resolve it.
          </p>
        )}
      </div>
    </Modal>
  );
}
