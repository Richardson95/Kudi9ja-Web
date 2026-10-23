import { useCallback, useRef, useState } from 'react';
import { describeError } from '../lib/api/errors';
import { useToast } from '../components/ui/Toast';

/**
 * Runs one server action at a time: tracks that it is busy, shows the
 * server's own message if it fails, and ignores a second click while the
 * first is still in flight. Resolves to the result, or undefined on failure.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async <T>(work: () => Promise<T>, success?: string | ((result: T) => string)): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await work();
        if (success) toast.success(typeof success === 'function' ? success(result) : success);
        return result;
      } catch (error) {
        toast.error(describeError(error));
        return undefined;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [toast],
  );

  return { busy, run };
}
