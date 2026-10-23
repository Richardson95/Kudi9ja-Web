import { API_BASE_URL, DEVICE_LABEL } from '../../config';
import type { ApiErrorBody, SessionResponse } from '../../types/api';
import { ApiError } from './errors';
import { tokens } from './tokens';

/**
 * Every call to the Kudi9ja server goes through here, so four things hold for
 * every request rather than for the ones somebody remembered:
 *
 *  - the bearer token, attached when there is one;
 *  - one refresh on expiry — serialised, because the server rotates refresh
 *    tokens and a second use of a spent one destroys the whole session;
 *  - the error envelope, decoded into ApiError;
 *  - idempotency keys on anything that moves money.
 */

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  idempotencyKey?: string;
  authenticated?: boolean;
  /** Multipart instead of JSON. */
  form?: FormData;
}

/** Generous: the free hosting tier sleeps, and the first request after idle can take most of a minute. */
const TIMEOUT_MS = 60_000;
const RETRY_PAUSE_MS = 3_000;

let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function url(path: string, query?: Query): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${API_BASE_URL}${normalised}${qs ? `?${qs}` : ''}`;
}

function streamHeaders(): Headers {
  const h = new Headers({ Accept: 'text/event-stream', 'X-Device': DEVICE_LABEL });
  if (tokens.accessToken) h.set('Authorization', `Bearer ${tokens.accessToken}`);
  return h;
}

function headers(opts: RequestOptions): Headers {
  const h = new Headers({ Accept: 'application/json', 'X-Device': DEVICE_LABEL });
  if (opts.body !== undefined && !opts.form) h.set('Content-Type', 'application/json');
  if (opts.idempotencyKey) h.set('Idempotency-Key', opts.idempotencyKey);
  if (opts.authenticated !== false && tokens.accessToken) h.set('Authorization', `Bearer ${tokens.accessToken}`);
  return h;
}

async function attempt(method: string, path: string, opts: RequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url(path, opts.query), {
      method,
      headers: headers(opts),
      body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

/** The host saying "not yet" (a proxy page while the instance starts) rather than the application answering. */
function serverNotReady(response: Response): boolean {
  if (![502, 503, 504].includes(response.status)) return false;
  return !(response.headers.get('content-type') ?? '').includes('json');
}

const pause = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * Runs an attempt, and once more if the server was not ready. Safe for money:
 * every money-moving request carries an idempotency key, so a retry of one
 * that did arrive returns the original result instead of moving money twice.
 */
async function withRetry(run: () => Promise<Response>): Promise<Response> {
  try {
    const response = await run();
    if (!serverNotReady(response)) return response;
  } catch {
    // timeout or network error — fall through to one more try
  }
  await pause(RETRY_PAUSE_MS);
  try {
    return await run();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw ApiError.offline('timeout');
    throw ApiError.offline(navigator.onLine ? 'dropped' : 'unreachable');
  }
}

async function decode<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    if (response.ok) return undefined as T;
    throw new ApiError('UNKNOWN', 'Something went wrong. Please try again.', {}, response.status);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    if (response.ok) return undefined as T;
    throw ApiError.offline('notTheApp', `server returned ${response.status}`);
  }
  if (response.ok) return body as T;
  if (body && typeof body === 'object') throw ApiError.fromBody(body as ApiErrorBody, response.status);
  throw ApiError.offline('notTheApp', `server returned ${response.status}`);
}

/** Exchanges the refresh token for a new pair. Concurrent callers share one in-flight refresh. */
function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = tokens.refreshToken;
    if (!refreshToken) return false;
    let response: Response;
    try {
      response = await fetch(url('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Device': DEVICE_LABEL },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Offline. The session may be perfectly good, so leave it alone.
      return tokens.hasSession;
    }
    if (response.ok) {
      const body = (await response.json()) as SessionResponse;
      tokens.save(body.accessToken, body.refreshToken, body.expiresInSeconds ?? 900, body.sessionId);
      return true;
    }
    if (serverNotReady(response)) return tokens.hasSession;
    // Refused: expired, rotated away, or signed out elsewhere.
    tokens.clear();
    onSessionLost?.();
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function send<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const authenticated = opts.authenticated !== false;
  if (authenticated && tokens.hasSession && tokens.isAccessExpired) await refreshSession();

  const response = await withRetry(() => attempt(method, path, opts));
  if (response.status !== 401 || !authenticated) return decode<T>(response);

  // A 401 on a request we thought was authenticated: refresh once and retry.
  let error: ApiError;
  try {
    await decode(response);
    error = new ApiError('UNAUTHENTICATED', 'Please sign in again.', {}, 401);
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError('UNAUTHENTICATED', 'Please sign in again.', {}, 401);
  }
  if (!tokens.hasSession || !error.isAuthFailure) throw error;
  const refreshed = await refreshSession();
  if (!refreshed) throw error;
  return decode<T>(await withRetry(() => attempt(method, path, opts)));
}

export const http = {
  get: <T>(path: string, query?: Query) => send<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, extra: Omit<RequestOptions, 'body'> = {}) =>
    send<T>('POST', path, { ...extra, body }),
  put: <T>(path: string, body?: unknown, extra: Omit<RequestOptions, 'body'> = {}) =>
    send<T>('PUT', path, { ...extra, body }),
  patch: <T>(path: string, body?: unknown, extra: Omit<RequestOptions, 'body'> = {}) =>
    send<T>('PATCH', path, { ...extra, body }),
  delete: <T>(path: string, body?: unknown) => send<T>('DELETE', path, { body }),
  upload: <T>(path: string, form: FormData, idempotencyKey?: string) =>
    send<T>('POST', path, { form, idempotencyKey }),

  /**
   * Holds a server-sent event stream open and calls `onEvent` for each event.
   * EventSource cannot send the session's token, so this reads the stream
   * through fetch. Resolves when the stream ends; rejects if it cannot open.
   * The caller reconnects.
   */
  async stream(path: string, onEvent: (event: string, data: unknown) => void, signal: AbortSignal): Promise<void> {
    if (tokens.hasSession && tokens.isAccessExpired) await refreshSession();
    let response = await fetch(url(path), { headers: streamHeaders(), signal });
    if (response.status === 401 && (await refreshSession())) {
      response = await fetch(url(path), { headers: streamHeaders(), signal });
    }
    if (!response.ok || !response.body) {
      throw new ApiError('UNKNOWN', `The live connection could not open (${response.status}).`, {}, response.status);
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value.replace(/\r\n/g, '\n');
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith(':')) continue; // keep-alive
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        if (!data.length) continue;
        const raw = data.join('\n');
        let parsed: unknown = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // plain text event
        }
        onEvent(event, parsed);
      }
    }
  },

  /** Fetches a protected file (receipt, statement) as a blob, with the session attached. */
  async blob(absolute: string): Promise<Blob> {
    if (tokens.hasSession && tokens.isAccessExpired) await refreshSession();
    const response = await fetch(absolute, {
      headers: tokens.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    });
    if (!response.ok) {
      throw new ApiError(
        response.status === 403 ? 'FORBIDDEN' : 'UNKNOWN',
        response.status === 403 || response.status === 410
          ? 'This link has expired. Close it and open the record again.'
          : `This file could not be fetched (${response.status}).`,
        {},
        response.status,
      );
    }
    return response.blob();
  },
};
