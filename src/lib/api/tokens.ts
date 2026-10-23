/**
 * Where the session lives between visits.
 *
 * A browser has no keystore, so the pair is kept in localStorage and the
 * access token also in memory. What protects a walked-away laptop is the
 * same thing that protects a phone: every visit opens on the passcode lock,
 * and the app locks itself after the admin-set idle time.
 */
const KEY = 'k9.session';

interface Stored {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  sessionId?: string;
}

let current: Stored | null = read();
const listeners = new Set<() => void>();

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

function write(value: Stored | null) {
  current = value;
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): the session still works for this tab.
  }
  listeners.forEach((l) => l());
}

// Another tab signed in or out: follow it.
window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return;
  current = read();
  listeners.forEach((l) => l());
});

export const tokens = {
  get accessToken() {
    return current?.accessToken ?? null;
  },
  get refreshToken() {
    return current?.refreshToken ?? null;
  },
  get sessionId() {
    return current?.sessionId ?? null;
  },
  /** Whether there is a session to try at all. Says nothing about whether the server still honours it. */
  get hasSession() {
    return current?.refreshToken != null;
  },
  /** Spent, or close enough that a request made now would land after it expires. */
  get isAccessExpired() {
    if (!current?.accessToken) return true;
    return Date.now() > current.expiresAt - 30_000;
  },
  save(accessToken: string, refreshToken: string, expiresInSeconds: number, sessionId?: string) {
    write({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
      sessionId: sessionId ?? current?.sessionId,
    });
  },
  clear() {
    write(null);
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
