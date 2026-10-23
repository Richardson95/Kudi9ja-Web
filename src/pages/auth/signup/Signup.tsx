import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { usePageTitle } from '../../../components/PageHeader';
import { BrandLogo, BrandMark } from '../../../components/Brand';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/cn';
import { useSession } from '../../../state/session';
import type { SessionResponse } from '../../../types/api';
import { AgreementsStep, type SignedRecord } from './AgreementsStep';
import { clearDraft, emptyDraft, loadDraft, saveDraft, STEP_TITLES, type SignupDraft } from './draft';
import { CodeStep, EmailStep, IdentityStep, PasswordStep, PayoutStep, PersonalStep, ReviewStep } from './Steps';
import { Welcome } from './Welcome';

/**
 * Nine steps, each submitted to the server as it is finished rather than all
 * at the end — so an abandoned sign-up leaves a draft that expires, not a
 * half-made account. The last step is new on the web: read the agreements,
 * agree, and sign.
 */
export default function Signup() {
  usePageTitle('Open an account');
  const navigate = useNavigate();
  const { enterFromSignup } = useSession();
  const restored = loadDraft();
  const [draft, setDraft] = useState<SignupDraft>(restored?.draft ?? emptyDraft);
  const [step, setStep] = useState(restored?.step ?? 0);
  const [done, setDone] = useState<{ session: SessionResponse; record: SignedRecord } | null>(null);

  useEffect(() => {
    if (draft.draftId) saveDraft(draft, step);
  }, [draft, step]);

  const update = (patch: Partial<SignupDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  const back = () => {
    if (step === 0) navigate('/signin');
    // Once the code is verified there is no going back to the email step.
    else setStep((s) => (s === 2 ? 0 : Math.max(0, s - 1)));
  };
  const restart = () => {
    clearDraft();
    setDraft(emptyDraft);
    setStep(0);
  };

  if (done) {
    return (
      <Welcome
        session={done.session}
        record={done.record}
        onContinue={() => {
          clearDraft();
          enterFromSignup(done.session);
        }}
      />
    );
  }

  const total = STEP_TITLES.length;
  const props = { draft, update, next, restart };

  return (
    <div className="night-gradient min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-stroke/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={back}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-stroke bg-surface text-ink-2 transition hover:text-ink"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold">
                Step {step + 1} of {total}
              </p>
              <p className="truncate text-lg font-extrabold">{STEP_TITLES[step]}</p>
            </div>
            <div className="hidden sm:block">
              <BrandLogo height={30} to="/" />
            </div>
            <BrandMark size={30} className="sm:hidden" />
          </div>
          <div className="mt-4 flex gap-1">
            {STEP_TITLES.map((t, i) => (
              <span key={t} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'gold-gradient' : 'bg-surface-alt')} />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <ol className="sticky top-32 space-y-1">
            {STEP_TITLES.map((t, i) => (
              <li key={t} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold', i === step ? 'bg-gold/10 text-gold' : i < step ? 'text-ink-2' : 'text-ink-3')}>
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold',
                    i < step ? 'bg-success text-white' : i === step ? 'gold-gradient text-on-gold' : 'border border-stroke',
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </aside>

        <main key={step} className="min-w-0 animate-rise">
          {step === 0 && <PersonalStep {...props} />}
          {step === 1 && <EmailStep {...props} />}
          {step === 2 && <IdentityStep {...props} />}
          {step === 3 && <PayoutStep {...props} />}
          {step === 4 && <PasswordStep {...props} />}
          {step === 5 && <CodeStep {...props} mode="passcode" />}
          {step === 6 && <CodeStep {...props} mode="pin" />}
          {step === 7 && <ReviewStep {...props} />}
          {step === 8 && <AgreementsStep {...props} onComplete={(session, record) => setDone({ session, record })} />}

          {step === 0 && (
            <p className="mt-8 text-center text-sm text-ink-2">
              Already have an account?{' '}
              <Link to="/signin" className="font-bold text-gold hover:underline">
                Sign in
              </Link>
            </p>
          )}
          {step > 0 && step < 8 && (
            <div className="mt-10 text-center">
              <Button variant="subtle" size="sm" onClick={restart}>
                Start again with different details
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export interface StepProps {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  next: () => void;
  restart: () => void;
}
