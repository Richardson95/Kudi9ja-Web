import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlarmClock, ArrowLeft, CheckCircle2, Hand, MessagesSquare, RotateCcw, Search, ShieldAlert, UserRound } from 'lucide-react';
import { usePageTitle } from '../../components/PageHeader';
import { ChatThread } from '../../components/support/ChatThread';
import { EmptyState, IconBadge, Pill, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { DetailRows } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Input } from '../../components/ui/Field';
import { Skeleton, Spinner } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { supportKeys, useSupportQueue, useSupportSummary, useSupportThread, useTyping } from '../../hooks/support';
import { adminSupportApi } from '../../lib/api/endpoints';
import { cn } from '../../lib/cn';
import { asDayTime, relative } from '../../lib/format';
import { can, supportTone } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { SupportConversation, SupportStatus, SupportThread } from '../../types/api';

type Filter = SupportStatus | 'ALL';

/**
 * The team's inbox. Waiting-on-us first; the conversation in the middle;
 * who the customer is and what was promised them on the right. Messages
 * arrive live.
 */
export default function AdminSupport() {
  usePageTitle('Support');
  const { id } = useParams();
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [query, setQuery] = useState('');
  const queue = useSupportQueue(filter, query.trim());
  const summary = useSupportSummary();
  const s = summary.data;

  return (
    <div className="grid h-full xl:grid-cols-[360px_1fr]">
      <aside className={cn('flex min-h-0 flex-col border-r border-stroke bg-surface/40', id && 'hidden xl:flex')}>
        <div className="space-y-3 border-b border-stroke p-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-lg font-extrabold">Support</h1>
            {!!s?.overdue && (
              <span className="flex items-center gap-1 text-[12px] font-bold text-danger">
                <AlarmClock className="h-3.5 w-3.5" /> {s.overdue} overdue
              </span>
            )}
          </div>
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'OPEN', label: 'Waiting on us', count: s?.open },
              { value: 'AWAITING_CUSTOMER', label: 'Replied', count: s?.awaitingCustomer },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'ALL', label: 'All' },
            ]}
          />
          <Input
            placeholder="Name, reference or subject"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {queue.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : queue.data?.items.length ? (
            <ul className="divide-y divide-stroke">
              {queue.data.items.map((c) => (
                <QueueRow key={c.id} c={c} active={c.id === id} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={<MessagesSquare />} title="Nothing here" message="No conversations match." />
          )}
        </div>
      </aside>

      <section className={cn('min-h-0', !id && 'hidden xl:block')}>
        {id ? (
          <Conversation id={id} />
        ) : (
          <div className="grid h-full place-items-center p-8">
            <EmptyState icon={<MessagesSquare />} title="Choose a conversation" message="Customers' messages appear here the moment they are sent." />
          </div>
        )}
      </section>
    </div>
  );
}

function QueueRow({ c, active }: { c: SupportConversation; active: boolean }) {
  return (
    <li>
      <Link to={`/admin/support/${c.id}`} className={cn('flex gap-3 px-4 py-3.5 transition hover:bg-surface-alt/60', active && 'bg-gold/[0.07]')}>
        <IconBadge size={38} tone={c.kind === 'COMPLAINT' ? 'danger' : 'info'}>
          {c.kind === 'COMPLAINT' ? <ShieldAlert /> : <MessagesSquare />}
        </IconBadge>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('truncate text-sm', c.unread ? 'font-extrabold' : 'font-semibold')}>{c.customerName}</p>
            <span className="shrink-0 text-[11px] text-ink-3">{relative(c.lastMessageAt)}</span>
          </div>
          <p className="truncate text-[12.5px] font-semibold text-ink-2">{c.subject}</p>
          <p className="truncate text-[12px] text-ink-3">{c.lastMessagePreview}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill tone={supportTone(c.status)}>{c.statusLabel}</Pill>
            {c.overdue && <Pill tone="danger">Overdue</Pill>}
            {!c.assignedToName && c.status !== 'RESOLVED' && <Pill tone="neutral">Unassigned</Pill>}
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
  const thread = useSupportThread('staff', id);
  const typingName = useTyping(id);
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { adminRole } = useSession();
  const canAct = can.manageCustomers(adminRole);
  const { busy, run } = useAction();

  if (thread.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner className="h-6 w-6 text-gold" />
      </div>
    );
  }
  if (!thread.data) return <EmptyState icon={<MessagesSquare />} title="Conversation not found" />;
  const c = thread.data.conversation;

  const setConversation = (updated: SupportConversation) => {
    qc.setQueryData<SupportThread>(supportKeys.thread('staff', id), (old) => (old ? { ...old, conversation: updated } : old));
    void qc.invalidateQueries({ queryKey: supportKeys.list('staff') });
    void qc.invalidateQueries({ queryKey: supportKeys.summary });
  };
  const add = (m: SupportThread['messages'][number]) =>
    qc.setQueryData<SupportThread>(supportKeys.thread('staff', id), (old) =>
      old && !old.messages.some((x) => x.id === m.id) ? { ...old, messages: [...old.messages, m] } : old,
    );

  const resolve = async () => {
    const note = await dialogs.reason({
      title: c.kind === 'COMPLAINT' ? 'Resolve this complaint' : 'Mark as answered',
      message: 'The customer sees this note. If they reply, the conversation reopens.',
      placeholder: 'What was done',
      confirmLabel: 'Resolve',
      minLength: 0,
    });
    if (note === null) return;
    await run(async () => setConversation(await adminSupportApi.resolve(id, note || undefined)), 'Resolved');
  };

  return (
    <div className="grid h-full min-h-0 2xl:grid-cols-[1fr_320px]">
      <div className="flex min-h-0 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-stroke bg-surface/60 px-4 py-3 backdrop-blur sm:px-6">
          <Link to="/admin/support" className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-alt xl:hidden" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{c.subject}</p>
            <p className="text-[12px] text-ink-3">
              {c.customerName} · {c.customerRef} · {c.reference}
            </p>
          </div>
          <Pill tone={supportTone(c.status)}>{c.statusLabel}</Pill>
          {canAct && !c.assignedToId && c.status !== 'RESOLVED' && (
            <Button size="sm" variant="ghost" loading={busy} icon={<Hand className="h-4 w-4" />}
              onClick={() => void run(async () => setConversation(await adminSupportApi.assign(id)), 'It is yours')}>
              Take it
            </Button>
          )}
          {canAct && c.status !== 'RESOLVED' && (
            <Button size="sm" variant="success" loading={busy} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => void resolve()}>
              Resolve
            </Button>
          )}
          {canAct && c.status === 'RESOLVED' && (
            <Button size="sm" variant="ghost" loading={busy} icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => void run(async () => setConversation(await adminSupportApi.reopen(id)), 'Reopened')}>
              Reopen
            </Button>
          )}
        </header>
        <ChatThread
          className="flex-1"
          messages={thread.data.messages}
          typingName={typingName}
          onSend={async (body) => add(await adminSupportApi.send(id, body))}
          onAttach={async (file, body) => add(await adminSupportApi.attach(id, file, body))}
          onTyping={() => void adminSupportApi.typing(id).catch(() => undefined)}
          disabled={!canAct}
          disabledNote="Your role can read conversations but not reply."
          placeholder={`Reply to ${c.customerName?.split(' ')[0] ?? 'the customer'}…`}
        />
      </div>

      <aside className="scrollbar-thin hidden min-h-0 space-y-5 overflow-y-auto border-l border-stroke p-5 2xl:block">
        <div>
          <p className="eyebrow mb-3 text-ink-3">Customer</p>
          <Link to={`/admin/customers/${c.customerId}`} className="flex items-center gap-3 rounded-xl border border-stroke p-3 hover:border-gold/40">
            <IconBadge size={38}><UserRound /></IconBadge>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{c.customerName}</p>
              <p className="text-[12px] text-ink-3">{c.customerRef} · open profile</p>
            </div>
          </Link>
        </div>
        <div>
          <p className="eyebrow mb-3 text-ink-3">{c.kindLabel}</p>
          <DetailRows
            rows={[
              ['Topic', c.category],
              ['Opened', asDayTime(c.createdAt)],
              ['With', c.assignedToName ?? 'Nobody yet'],
              c.acknowledgeBy ? { label: 'Reply due', value: c.acknowledgedAt ? `Replied ${asDayTime(c.acknowledgedAt)}` : asDayTime(c.acknowledgeBy), tone: !c.acknowledgedAt && c.overdue ? 'danger' : undefined } : null,
              c.resolveBy ? { label: 'Resolve by', value: asDayTime(c.resolveBy), tone: c.overdue ? 'danger' : undefined } : null,
              c.resolvedAt ? ['Resolved', asDayTime(c.resolvedAt)] : null,
              c.resolvedBy ? ['By', c.resolvedBy] : null,
            ]}
          />
          {c.resolutionNote && <p className="mt-3 rounded-xl bg-surface-alt/60 p-3 text-[12.5px] text-ink-2">{c.resolutionNote}</p>}
        </div>
      </aside>
    </div>
  );
}
