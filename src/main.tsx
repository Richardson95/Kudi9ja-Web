import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ApiError } from './lib/api/errors';
import { ThemeProvider } from './state/theme';
import { SettingsProvider } from './state/settings';
import { SessionProvider } from './state/session';
import { ToastProvider } from './components/ui/Toast';
import { DialogProvider } from './components/ui/Dialogs';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // An answer from the application (403, 404, validation) will not change
      // by asking again. Only a missing answer is worth one more try.
      retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.code === 'NETWORK'),
    },
    mutations: { retry: false },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <SettingsProvider>
            <SessionProvider>
              <DialogProvider>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <App />
                </BrowserRouter>
              </DialogProvider>
            </SessionProvider>
          </SettingsProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
