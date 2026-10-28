import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { BrandLogo } from '../components/Brand';
import { PromiseHeading, PromiseList } from '../components/Promises';
import { useSettings } from '../state/settings';

/**
 * The split screen every visitor page sits in: the brand and the product's
 * promises on the left, the form on the right. On a phone the left
 * panel folds away and the form has the screen.
 */
export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const s = useSettings();

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden border-r border-stroke lg:flex lg:flex-col">
        <div className="night-gradient absolute inset-0" />
        <div className="absolute -left-32 top-1/3 h-[520px] w-[520px] rounded-full bg-gold/10 blur-[120px]" />
        <div className="relative flex flex-1 flex-col px-14 py-12">
          <BrandLogo height={48} to="/" />
          <div className="my-auto max-w-md py-12">
            <PromiseHeading as="h2" className="text-[40px] leading-[1.08]" />
            <PromiseList className="mt-9" />
          </div>
          <p className="flex items-center gap-2 text-[12px] text-ink-3">
            <Lock className="h-3.5 w-3.5" /> {s.company.legalName} · {s.company.rcNumber}
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-col">
        <div className="night-gradient pointer-events-none absolute inset-0 lg:hidden" />
        <div className="relative flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <BrandLogo height={34} to="/" />
        </div>
        <div className={`relative mx-auto flex w-full flex-1 flex-col justify-center px-5 pb-12 sm:px-8 ${wide ? 'max-w-2xl' : 'max-w-[440px]'}`}>
          {children}
        </div>
        <footer className="relative px-5 pb-6 text-center text-[11.5px] text-ink-3 sm:px-8">
          <Link to="/legal" className="hover:text-gold">
            Terms, privacy and lending agreement
          </Link>
          <span className="mx-2">·</span>
          <a href={`mailto:${s.company.supportEmail}`} className="hover:text-gold">
            {s.company.supportEmail}
          </a>
        </footer>
      </main>
    </div>
  );
}
