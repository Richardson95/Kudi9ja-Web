import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setSessionLostHandler } from '../lib/api/client';
import { authApi, meApi } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/errors';
import { tokens } from '../lib/api/tokens';
import type { AdminRole, Profile, SessionResponse, ThemeMode } from '../types/api';
import { useSettings } from './settings';
import { useTheme, type ThemeChoice } from './theme';

/**
 * Where the visitor stands:
 *  - signedOut — no session; email and password needed.
 *  - locked    — a session exists but the sign-in passcode has not been
 *                entered in this visit (every visit, and after idle time).
 *  - unlocked  — the dashboard.
 */
export type Stage = 'signedOut' | 'locked' | 'unlocked';

interface SessionApi {
  stage: Stage;
  profile: Profile | null;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  /** Why the visitor was signed out, shown once on the sign-in page. */
  notice: string | null;
  clearNotice: () => void;
  attemptsLeft: number;
  signIn: (email: string, password: string) => Promise<void>;
  /** After sign-up: the account is open and the customer is already in. */
  enterFromSignup: (session: SessionResponse) => void;
  unlock: (passcode: string) => Promise<{ ok: true } | { ok: false; message: string; signedOut: boolean }>;
  lock: () => void;
  signOut: (message?: string) => Promise<void>;
  setProfile: (p: Profile) => void;
  refreshProfile: () => Promise<void>;
  setThemeChoice: (c: ThemeChoice) => void;
  setHideBalance: (hide: boolean) => void;
}

const SessionContext = createContext<SessionApi | null>(null);

const themeToApi = (c: ThemeChoice): ThemeMode => (c === 'system' ? 'SYSTEM' : c === 'light' ? 'LIGHT' : 'DARK');
const themeFromApi = (t?: ThemeMode): ThemeChoice | null =>
  t === 'SYSTEM' ? 'system' : t === 'LIGHT' ? 'light' : t === 'DARK' ? 'dark' : null;

export function SessionProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>(() => (tokens.hasSession ? 'locked' : 'signedOut'));
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(0);

  const maxAttempts = settings.security.maxPasscodeAttempts;

  const applyProfile = useCallback(
    (p: Profile) => {
      setProfileState(p);
      const t = themeFromApi(p.themeMode);
      if (t) theme.setChoice(t);
    },
    // theme.setChoice is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const reset = useCallback(
    (message: string | null) => {
      tokens.clear();
      queryClient.clear();
      setProfileState(null);
      setFailed(0);
      setNotice(message);
      setStage('signedOut');
    },
    [queryClient],
  );

  // The server refused the refresh token: the session is gone for good.
  useEffect(() => {
    setSessionLostHandler(() => reset('Your session has ended. Please sign in again.'));
  }, [reset]);

  // Another tab signed out: follow it.
  useEffect(
    () =>
      tokens.subscribe(() => {
        if (!tokens.hasSession) {
          setProfileState(null);
          setStage('signedOut');
        }
      }),
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.signIn(email.trim().toLowerCase(), password);
      applyProfile(session.profile);
      setNotice(null);
      setFailed(0);
      setStage('locked');
    },
    [applyProfile],
  );

  const enterFromSignup = useCallback(
    (session: SessionResponse) => {
      applyProfile(session.profile);
      setNotice(null);
      setFailed(0);
      setStage('unlocked');
    },
    [applyProfile],
  );

  const signOut = useCallback(
    async (message?: string) => {
      await authApi.signOut();
      reset(message ?? null);
    },
    [reset],
  );

  const unlock = useCallback<SessionApi['unlock']>(
    async (passcode) => {
      try {
        await authApi.verifyPasscode(passcode);
        setFailed(0);
        const me = await meApi.profile();
        applyProfile(me);
        setStage('unlocked');
        return { ok: true };
      } catch (error) {
        if (!(error instanceof ApiError)) return { ok: false, message: 'Something went wrong. Please try again.', signedOut: false };
        if (error.isAuthFailure) {
          reset('Your session has ended. Please sign in again.');
          return { ok: false, message: error.message, signedOut: true };
        }
        // Counted on the server, not here: a local counter is reset by a refresh.
        const left = error.details.attemptsLeft;
        const used = typeof left === 'number' ? Math.max(0, maxAttempts - left) : failed + 1;
        setFailed(used);
        if (error.code === 'ACCOUNT_LOCKED' || used >= maxAttempts) {
          await authApi.signOut();
          reset('Too many wrong passcodes. Sign in with your email and password.');
          return { ok: false, message: error.message, signedOut: true };
        }
        return { ok: false, message: error.message, signedOut: false };
      }
    },
    [applyProfile, failed, maxAttempts, reset],
  );

  const lock = useCallback(() => {
    if (tokens.hasSession) setStage((s) => (s === 'unlocked' ? 'locked' : s));
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      applyProfile(await meApi.profile());
    } catch {
      // keep what we have
    }
  }, [applyProfile]);

  const setThemeChoice = useCallback(
    (c: ThemeChoice) => {
      theme.setChoice(c);
      if (tokens.hasSession) {
        meApi
          .update({ themeMode: themeToApi(c) })
          .then(setProfileState)
          .catch(() => undefined);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setHideBalance = useCallback(
    (hide: boolean) => {
      setProfileState((p) => (p ? { ...p, hideBalance: hide } : p));
      meApi
        .update({ hideBalance: hide })
        .then((p) => {
          setProfileState(p);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        })
        .catch(() => setProfileState((p) => (p ? { ...p, hideBalance: !hide } : p)));
    },
    [queryClient],
  );

  // Locked or signed out: drop cached money figures from memory.
  useEffect(() => {
    if (stage !== 'unlocked') queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'public-settings' && q.queryKey[0] !== 'legal' && q.queryKey[0] !== 'banks' });
  }, [stage, queryClient]);

  const value = useMemo<SessionApi>(
    () => ({
      stage,
      profile,
      isAdmin: !!profile?.admin,
      adminRole: profile?.admin ? (profile.adminRole ?? null) : null,
      notice,
      clearNotice: () => setNotice(null),
      attemptsLeft: Math.max(0, maxAttempts - failed),
      signIn,
      enterFromSignup,
      unlock,
      lock,
      signOut,
      setProfile: applyProfile,
      refreshProfile,
      setThemeChoice,
      setHideBalance,
    }),
    [stage, profile, notice, maxAttempts, failed, signIn, enterFromSignup, unlock, lock, signOut, applyProfile, refreshProfile, setThemeChoice, setHideBalance],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** The signed-in profile. Only call below the unlocked gate. */
export function useProfile(): Profile {
  const { profile } = useSession();
  if (!profile) throw new Error('useProfile called without a profile');
  return profile;
}

/** Never lock sooner than this, whatever the saved setting says. */
export const MIN_LOCK_MINUTES = 10;

/**
 * Locks after the admin-set idle time (10 minutes at the least): no pointer,
 * key or scroll activity, or the tab hidden for that long.
 */
export function useIdleLock() {
  const { stage, lock } = useSession();
  const settings = useSettings();
  const last = useRef(Date.now());
  const saved = settings.security.lockTimeoutMinutes;
  const minutes = saved > 0 ? Math.max(saved, MIN_LOCK_MINUTES) : saved;

  useEffect(() => {
    if (stage !== 'unlocked' || minutes <= 0) return;
    last.current = Date.now();
    const limit = minutes * 60_000;
    const touch = () => (last.current = Date.now());
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current >= limit) lock();
      else if (document.visibilityState === 'visible') touch();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (Date.now() - last.current >= limit) lock();
    }, 10_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [stage, minutes, lock]);
}
