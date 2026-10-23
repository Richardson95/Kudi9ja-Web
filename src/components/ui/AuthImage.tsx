import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { absoluteUrl } from '../../config';
import { http } from '../../lib/api/client';
import { describeError } from '../../lib/api/errors';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

/**
 * A protected file — a receipt, a selfie, a business photograph — fetched with
 * the admin's session attached. A plain <img src> cannot send the token, and
 * the server rightly refuses a receipt to anyone without one.
 */
export function useAuthBlob(url: string | undefined | null) {
  const [state, setState] = useState<{ src: string | null; error: string | null; loading: boolean; type: string }>({
    src: null,
    error: null,
    loading: !!url,
    type: '',
  });
  useEffect(() => {
    if (!url) {
      setState({ src: null, error: null, loading: false, type: '' });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ src: null, error: null, loading: true, type: '' });
    http
      .blob(absoluteUrl(url))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ src: objectUrl, error: null, loading: false, type: blob.type });
      })
      .catch((e) => !cancelled && setState({ src: null, error: describeError(e), loading: false, type: '' }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return state;
}

export function AuthImage({ url, alt, className, fit = 'cover' }: { url?: string | null; alt: string; className?: string; fit?: 'cover' | 'contain' }) {
  const { src, error, loading } = useAuthBlob(url);
  return (
    <div className={cn('relative grid place-items-center overflow-hidden bg-surface-alt', className)}>
      {loading && <Spinner className="h-5 w-5 text-ink-3" />}
      {src && <img src={src} alt={alt} className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')} />}
      {!loading && !src && (
        <div className="flex flex-col items-center gap-1.5 p-3 text-center text-[11.5px] text-ink-3">
          <ImageOff className="h-5 w-5" />
          {error ?? 'No image'}
        </div>
      )}
    </div>
  );
}
