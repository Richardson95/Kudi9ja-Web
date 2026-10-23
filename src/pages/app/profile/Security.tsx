import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Laptop, LogOut, Smartphone, SquareAsterisk } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { PasswordStrength } from '../../../components/PasswordStrength';
import { Pill } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, NavRow, SectionHeader } from '../../../components/ui/Card';
import { useDialogs } from '../../../components/ui/Dialogs';
import { Input } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Skeleton } from '../../../components/ui/Spinner';
import { useAction } from '../../../hooks/useAction';
import { keys, useSessions } from '../../../hooks/queries';
import { authApi } from '../../../lib/api/endpoints';
import { relative } from '../../../lib/format';
import { validators } from '../../../lib/validators';
import { useSession } from '../../../state/session';
import { useSettings } from '../../../state/settings';

type Secret = 'password' | 'passcode' | 'pin' | null;

export default function Security() {
  const sessions = useSessions();
  const { signOut } = useSession();
  const dialogs = useDialogs();
  const qc = useQueryClient();
  const { run } = useAction();
  const [changing, setChanging] = useState<Secret>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader back="/app/profile" backLabel="Profile" title="Security" subtitle="How you get in, and where you are signed in." />

      <Card padded={false} className="divide-y divide-stroke">
        <NavRow icon={<KeyRound className="h-[18px] w-[18px]" />} title="Password" subtitle="Used to sign in on a new device" onClick={() => setChanging('password')} />
        <NavRow icon={<SquareAsterisk className="h-[18px] w-[18px]" />} title="Passcode" subtitle="Six digits that unlock the app" onClick={() => setChanging('passcode')} />
        <NavRow icon={<SquareAsterisk className="h-[18px] w-[18px]" />} title="Transaction PIN" subtitle="Four digits that approve money moving" onClick={() => setChanging('pin')} />
      </Card>

      <Card>
        <SectionHeader
          title="Signed-in devices"
          action="Sign out everywhere"
          onAction={async () => {
            const ok = await dialogs.confirm({
              title: 'Sign out of every device?',
              message: 'Including this one. You will need your password to come back in.',
              confirmLabel: 'Sign out everywhere',
              danger: true,
            });
            if (ok) await run(async () => {
              await authApi.signOutEverywhere();
              await signOut('You signed out of every device.');
            });
          }}
        />
        {sessions.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <ul className="divide-y divide-stroke">
            {(sessions.data ?? []).map((s) => {
              const phone = /android|iphone|mobile|app/i.test(s.device);
              const Icon = phone ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-alt text-ink-2">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {s.device} {s.current && <Pill tone="success">This device</Pill>}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {s.ipAddress ? `${s.ipAddress} · ` : ''}active {relative(s.lastSeenAt ?? s.createdAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      size="sm"
                      variant="subtle"
                      icon={<LogOut className="h-4 w-4" />}
                      onClick={() => void run(async () => {
                        await authApi.endSession(s.id);
                        await qc.invalidateQueries({ queryKey: keys.sessions });
                      }, 'Signed out of that device')}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ChangeSecret kind={changing} onClose={() => setChanging(null)} />
    </div>
  );
}

function ChangeSecret({ kind, onClose }: { kind: Secret; onClose: () => void }) {
  const settings = useSettings();
  const { busy, run } = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const close = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    onClose();
  };
  const digits = kind === 'passcode' ? settings.security.passcodeLength : kind === 'pin' ? settings.security.pinLength : 0;
  const numeric = (v: string) => (digits ? v.replace(/\D/g, '').slice(0, digits) : v);
  const nextError =
    !next
      ? null
      : kind === 'password'
        ? validators.password(next)
        : kind === 'passcode'
          ? next.length !== digits ? `${digits} digits` : validators.passcodeStrength(next)
          : next.length !== digits
            ? `${digits} digits`
            : null;
  const valid = !!current && !!next && !nextError && next === confirm;
  const title = kind === 'password' ? 'Change password' : kind === 'passcode' ? 'Change passcode' : 'Change transaction PIN';

  const save = async () => {
    const done = await run(
      async () => {
        if (kind === 'password') await authApi.changePassword(current, next);
        else if (kind === 'passcode') await authApi.changePasscode(current, next);
        else await authApi.changePin(current, next);
        return true;
      },
      `${title.replace('Change ', '').replace(/^./, (c) => c.toUpperCase())} changed`,
    );
    if (done) close();
  };

  return (
    <Modal
      open={!!kind}
      onClose={close}
      locked={busy}
      title={title}
      footer={
        <Button block loading={busy} disabled={!valid} onClick={() => void save()}>
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          label={`Current ${kind === 'pin' ? 'PIN' : kind}`}
          type="password"
          inputMode={digits ? 'numeric' : undefined}
          value={current}
          onChange={(e) => setCurrent(numeric(e.target.value))}
          autoComplete={kind === 'password' ? 'current-password' : 'off'}
        />
        <Input
          label={`New ${kind === 'pin' ? 'PIN' : kind}`}
          type="password"
          inputMode={digits ? 'numeric' : undefined}
          value={next}
          onChange={(e) => setNext(numeric(e.target.value))}
          error={nextError}
          autoComplete={kind === 'password' ? 'new-password' : 'off'}
        />
        {kind === 'password' && <PasswordStrength value={next} />}
        <Input
          label="Type it again"
          type="password"
          inputMode={digits ? 'numeric' : undefined}
          value={confirm}
          onChange={(e) => setConfirm(numeric(e.target.value))}
          error={confirm && confirm !== next ? 'These do not match' : null}
        />
      </div>
    </Modal>
  );
}
