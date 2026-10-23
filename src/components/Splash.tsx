import { RefreshCw } from 'lucide-react';
import { BrandLogo, BrandMark } from './Brand';
import { Button } from './ui/Button';

export function Splash({ failed, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  return (
    <div className="night-gradient fixed inset-0 grid place-items-center bg-canvas">
      <div className="flex flex-col items-center px-6 text-center">
        <BrandMark size={92} halo className="animate-pop-in" spin={!failed} />
        <div className="mt-8 animate-rise [animation-delay:250ms]">
          <BrandLogo height={46} />
        </div>
        {failed ? (
          <div className="mt-10 max-w-sm animate-rise space-y-4">
            <p className="text-sm leading-relaxed text-ink-2">
              Kudi9ja is taking a moment to wake up. This usually clears in under a minute.
            </p>
            <Button variant="outline" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="mt-12 h-[3px] w-32 overflow-hidden rounded-full bg-surface-alt">
            <div className="h-full w-1/2 rounded-full gold-gradient" style={{ animation: 'splash-bar 1.2s ease-in-out infinite' }} />
          </div>
        )}
        <p className="mt-5 text-[11.5px] uppercase tracking-[0.2em] text-ink-3">Secured by Kudi9ja</p>
      </div>
      <style>{`@keyframes splash-bar { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }`}</style>
    </div>
  );
}
