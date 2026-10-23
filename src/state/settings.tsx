import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../lib/api/endpoints';
import type { PublicSettings } from '../types/api';
import { Splash } from '../components/Splash';

/**
 * The live rates and limits. Fetched before anything is drawn — the site
 * never quotes a rate from its own build, because an admin can change any of
 * them and a page quoting a rate the server no longer honours is quoting a
 * price it cannot deliver.
 */
const SettingsContext = createContext<PublicSettings | null>(null);

export const settingsKey = ['public-settings'] as const;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: settingsKey,
    queryFn: publicApi.settings,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 3,
    retryDelay: (n) => Math.min(2000 * 2 ** n, 15_000),
  });

  if (!query.data) {
    return <Splash failed={query.isError} onRetry={() => query.refetch()} />;
  }
  return <SettingsContext.Provider value={query.data}>{children}</SettingsContext.Provider>;
}

export function useSettings(): PublicSettings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
