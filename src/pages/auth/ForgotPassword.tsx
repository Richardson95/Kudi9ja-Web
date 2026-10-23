import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AtSign, Lock, MailCheck } from 'lucide-react';
import { AuthShell } from '../../layouts/AuthShell';
import { usePageTitle } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { IconBadge, Notice } from '../../components/ui/Bits';
import { OtpInput } from '../../components/ui/PinPad';
import { useToast } from '../../components/ui/Toast';
import { PasswordStrength } from '../../components/PasswordStrength';
import { authApi } from '../../lib/api/endpoints';
import { describeError } from '../../lib/api/errors';
import { validators } from '../../lib/validators';

export default function ForgotPassword() {
  usePageTitle('Reset password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const emailError = validators.email(email);
    setErrors({ email: emailError });
    if (emailError) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
      toast.success('If that email has an account, a code is on its way.');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      code: code.length === 6 ? null : 'Enter the 6-digit code from your email',
      password: validators.password(password),
      confirm: confirm === password ? null : 'Passwords do not match',
    };
    setErrors(next);
    if (next.code || next.password || next.confirm) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), code, password);
      toast.success('Password reset. Sign in with your new password.');
      navigate(`/signin?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="animate-rise">
        <Link to="/signin" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 hover:text-gold">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="text-[30px] font-extrabold tracking-[-0.03em]">Reset your password</h1>
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-stroke bg-surface p-4">
          <IconBadge>
            <MailCheck />
          </IconBadge>
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {sent
              ? `Enter the code we sent to ${email.trim()} and choose a new password. Every device will be signed out.`
              : 'Enter the email you signed up with and we will send you a 6-digit code.'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={send} className="mt-7 space-y-5" noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              icon={<AtSign />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoFocus
            />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" size="lg" block loading={busy}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-7 space-y-5" noValidate>
            <div>
              <p className="mb-3 text-[13px] font-semibold text-ink-2">Code from your email</p>
              <OtpInput value={code} onChange={setCode} error={!!errors.code} />
              {errors.code && <p className="mt-2 text-center text-[12.5px] font-semibold text-danger">{errors.code}</p>}
            </div>
            <div>
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                icon={<Lock />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
              <PasswordStrength value={password} className="mt-3" />
            </div>
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              placeholder="Type it once more"
              icon={<Lock />}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
            />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" size="lg" block loading={busy}>
              Reset password
            </Button>
            <Button variant="subtle" block disabled={busy} onClick={() => send()}>
              Send a new code
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
