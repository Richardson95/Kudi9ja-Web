import { afterEach, describe, expect, it, vi } from 'vitest';

// The client's token store reads the browser on load; tests run without one.
vi.hoisted(() => {
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    window: { addEventListener: () => undefined, location: { origin: 'http://localhost' } },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

const { http } = await import('./client');

function streamOf(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('the live stream reader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('splits events across chunk boundaries, parses JSON, and skips keep-alives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamOf([
          'event:ready\ndata:{}\n\n: keep-alive\n\nevent:mess',
          'age\ndata:{"conversation":{"id":"c1"},\r\n',
          'data:"message":{"id":"m1"}}\n\nevent:typing\ndata:{"conversationId":"c1","name":"Ada"}\n\n',
        ]),
      ),
    );
    const seen: [string, unknown][] = [];
    await http.stream('/support/stream', (e, d) => seen.push([e, d]), new AbortController().signal);
    expect(seen.map(([e]) => e)).toEqual(['ready', 'message', 'typing']);
    expect(seen[1]![1]).toEqual({ conversation: { id: 'c1' }, message: { id: 'm1' } });
    expect(seen[2]![1]).toEqual({ conversationId: 'c1', name: 'Ada' });
  });

  it('refuses to open on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })));
    await expect(http.stream('/support/stream', () => undefined, new AbortController().signal)).rejects.toThrow();
  });
});
