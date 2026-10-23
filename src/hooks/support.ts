import { useEffect, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { http } from '../lib/api/client';
import { adminSupportApi, supportApi } from '../lib/api/endpoints';
import { useSession } from '../state/session';
import type {
  PageResponse,
  SupportConversation,
  SupportMessageEvent,
  SupportStatus,
  SupportThread,
  SupportTypingEvent,
} from '../types/api';

export type SupportScope = 'customer' | 'staff';

export const supportKeys = {
  root: (scope: SupportScope) => ['support', scope] as const,
  list: (scope: SupportScope) => ['support', scope, 'list'] as const,
  thread: (scope: SupportScope, id: string) => ['support', scope, 'thread', id] as const,
  unread: ['support', 'customer', 'unread'] as const,
  summary: ['support', 'staff', 'summary'] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

export const useMyConversations = () =>
  useQuery({
    queryKey: supportKeys.list('customer'),
    queryFn: supportApi.conversations,
    enabled: useSession().stage === 'unlocked',
  });

export const useSupportUnread = () =>
  useQuery({
    queryKey: supportKeys.unread,
    queryFn: supportApi.unread,
    enabled: useSession().stage === 'unlocked',
    refetchInterval: 120_000,
    select: (r) => r.unread,
  });

export const useSupportTopics = () =>
  useQuery({ queryKey: ['support', 'topics'], queryFn: supportApi.topics, staleTime: 60 * 60_000, select: (r) => r.categories });

export const useSupportQueue = (status: SupportStatus | 'ALL', query: string, customerId?: string) => {
  const s = useSession();
  return useQuery({
    queryKey: [...supportKeys.list('staff'), status, query, customerId ?? ''],
    queryFn: () =>
      adminSupportApi.queue({ status: status === 'ALL' ? undefined : status, query: query || undefined, customerId }),
    enabled: s.stage === 'unlocked' && s.isAdmin,
    placeholderData: (prev) => prev,
  });
};

export const useSupportSummary = () => {
  const s = useSession();
  return useQuery({
    queryKey: supportKeys.summary,
    queryFn: adminSupportApi.summary,
    enabled: s.stage === 'unlocked' && s.isAdmin,
    refetchInterval: 120_000,
  });
};

export const useSupportThread = (scope: SupportScope, id: string | undefined) => {
  const s = useSession();
  return useQuery({
    queryKey: supportKeys.thread(scope, id ?? ''),
    queryFn: () => (scope === 'staff' ? adminSupportApi.thread(id!) : supportApi.thread(id!)),
    enabled: s.stage === 'unlocked' && !!id && (scope === 'customer' || s.isAdmin),
  });
};

// ── "Someone is typing" ─────────────────────────────────────────────────────

const typing = new Map<string, { name: string; until: number }>();
const typingListeners = new Set<() => void>();
const notifyTyping = () => typingListeners.forEach((l) => l());

function setTyping(e: SupportTypingEvent) {
  typing.set(e.conversationId, { name: e.name, until: Date.now() + 4500 });
  notifyTyping();
  setTimeout(notifyTyping, 4600);
}

/** The name of whoever is typing in this conversation right now, if anyone. */
export function useTyping(conversationId: string | undefined): string | null {
  return useSyncExternalStore(
    (l) => {
      typingListeners.add(l);
      return () => typingListeners.delete(l);
    },
    () => {
      if (!conversationId) return null;
      const t = typing.get(conversationId);
      return t && t.until > Date.now() ? t.name : null;
    },
  );
}

// ── The live stream ─────────────────────────────────────────────────────────

/**
 * Holds the server's event stream open while the session is unlocked and
 * folds each event into the query cache, so every open view of a
 * conversation — the list, the thread, the badge — updates by itself.
 * Mount once per area (customer layout, admin layout).
 */
export function useSupportLive(scope: SupportScope) {
  const qc = useQueryClient();
  const { stage, isAdmin } = useSession();
  const active = stage === 'unlocked' && (scope === 'customer' || isAdmin);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let delay = 2000;
    let stopped = false;

    const run = async () => {
      while (!stopped) {
        try {
          await http.stream(
            scope === 'staff' ? '/admin/support/stream' : '/support/stream',
            (event, data) => {
              delay = 2000;
              apply(qc, scope, event, data);
            },
            controller.signal,
          );
        } catch {
          if (stopped) return;
        }
        if (stopped) return;
        // The stream ended or failed: catch up on anything missed, then reconnect.
        void qc.invalidateQueries({ queryKey: supportKeys.root(scope) });
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30_000);
      }
    };
    void run();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [active, scope, qc]);
}

function apply(qc: QueryClient, scope: SupportScope, event: string, data: unknown) {
  if (event === 'typing') {
    setTyping(data as SupportTypingEvent);
    return;
  }
  if (event === 'message') {
    const { conversation, message } = data as SupportMessageEvent;
    qc.setQueryData<SupportThread>(supportKeys.thread(scope, conversation.id), (old) =>
      old
        ? {
            conversation,
            messages: old.messages.some((m) => m.id === message.id) ? old.messages : [...old.messages, message],
          }
        : old,
    );
    typing.delete(conversation.id);
    notifyTyping();
    upsertConversation(qc, scope, conversation);
  } else if (event === 'conversation') {
    const conversation = data as SupportConversation;
    qc.setQueryData<SupportThread>(supportKeys.thread(scope, conversation.id), (old) =>
      old ? { ...old, conversation } : old,
    );
    upsertConversation(qc, scope, conversation);
  } else {
    return;
  }
  if (scope === 'customer') void qc.invalidateQueries({ queryKey: supportKeys.unread });
  else void qc.invalidateQueries({ queryKey: supportKeys.summary });
}

function upsertConversation(qc: QueryClient, scope: SupportScope, c: SupportConversation) {
  if (scope === 'customer') {
    qc.setQueryData<SupportConversation[]>(supportKeys.list('customer'), (old) =>
      old ? sortByLatest([c, ...old.filter((o) => o.id !== c.id)]) : old,
    );
    return;
  }
  // The queue is filtered several ways; patch every cached page that has it,
  // and refetch the rest so a new conversation appears where it belongs.
  let found = false;
  qc.setQueriesData<PageResponse<SupportConversation>>({ queryKey: supportKeys.list('staff') }, (old) => {
    if (!old || !old.items.some((o) => o.id === c.id)) return old;
    found = true;
    return { ...old, items: old.items.map((o) => (o.id === c.id ? c : o)) };
  });
  if (!found) void qc.invalidateQueries({ queryKey: supportKeys.list('staff') });
}

const sortByLatest = (list: SupportConversation[]) =>
  [...list].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
