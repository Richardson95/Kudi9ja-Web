import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '../../components/Brand';
import { usePageTitle } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { useDialogs } from '../../components/ui/Dialogs';
import { NumericKeypad, PasscodeDots } from '../../components/ui/PinPad';
import { PASSCODE_LENGTH } from '../../config';
import { meApi } from '../../lib/api/endpoints';
import { firstName } from '../../lib/format';
import { useSession } from '../../state/session';
import { useSettings } from '../../state/settings';

/** Shown on every visit and after idle time: the six-digit sign-in passcode. */
export default function LockScreen() {
  usePageTitle('Unlock');
  const { unlock, profile, setProfile, attemptsLeft, signOut } = useSession();
  const settings = useSettings();
  const dialogs = useDialogs();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const value = useRef('');

  // After a reload the session is known but not the name. Fetch it quietly.
  useEffect(() => {
    if (!profile) meApi.profile().then(setProfile).catch(() => undefined);
  }, [profile, setProfile]);

  const submit = async (entered: string) => {
    setChecking(true);
    const result = await unlock(entered);
    if (result.ok) return;
    setError(result.signedOut ? null : result.message);
    window.setTimeout(() => {
      value.current = '';
      setCode('');
      setChecking(false);
    }, 650);
  };

  const digit = (d: string) => {
    if (checking || value.current.length >= PASSCODE_LENGTH) return;
    value.current += d;
    setCode(value.current);
    setError(null);
    if (value.current.length === PASSCODE_LENGTH) void submit(value.current);
  };

  const backspace = () => {
    if (checking) return;
    value.current = value.current.slice(0, -1);
    setCode(value.current);
  };

  const left = attemptsLeft;
  const name = profile ? firstName(profile.fullName) : 'there';

  return (
    <div className="night-gradient grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm animate-rise text-center">
        <BrandMark size={60} halo className="mx-auto" />
        <h1 className="mt-7 text-[28px] font-extrabold tracking-[-0.03em]">Hello, {name}</h1>
        <p className="mt-1 text-ink-2">Enter your {PASSCODE_LENGTH}-digit passcode</p>

        <div className="mt-9">
          <PasscodeDots length={PASSCODE_LENGTH} filled={code.length} error={!!error} />
        </div>
        <p className="mt-4 h-10 text-[12.5px] font-semibold text-danger">
          {error &&
            (left <= 2 && left < settings.security.maxPasscodeAttempts
              ? `Wrong passcode. ${left} ${left === 1 ? 'attempt' : 'attempts'} left before sign-out.`
              : error)}
        </p>

        <NumericKeypad onDigit={digit} onBackspace={backspace} disabled={checking} />
        <p className="mt-4 text-[12px] text-ink-3">You can type the digits on your keyboard.</p>

        <Button
          variant="subtle"
          className="mt-6"
          onClick={async () => {
            const ok = await dialogs.confirm({
              title: 'Sign out?',
              message: 'You will need your email and password to get back in.',
              confirmLabel: 'Sign out',
              cancelLabel: 'Stay',
            });
            if (ok) await signOut();
          }}
        >
          Sign in with password instead
        </Button>
      </div>
    </div>
  );
}
