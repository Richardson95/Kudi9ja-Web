import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AtSign, Lock } from 'lucide-react';
import { AuthShell } from '../../layouts/AuthShell';
import { usePageTitle } from '../../components/PageHeader';
import { BrandMark } from '../../components/Brand';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Bits';
import { describeError } from '../../lib/api/errors';
import { validators } from '../../lib/validators';
import { useSession } from '../../state/session';

export default function SignIn() {
  usePageTitle('Sign in');
  const { signIn, notice, clearNotice } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = { email: validators.email(email), password: password ? null : 'Password is required' };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    setError(null);
    clearNotice();
    try {
      await signIn(email, password);
      const to = params.get('next');
      navigate(to && to.startsWith('/') ? to : '/app', { replace: true });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="animate-rise">
        <BrandMark size={52} halo className="mb-6" />
        <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">Welcome back</h1>
        <p className="mt-1.5 text-ink-2">Sign in to continue to your dashboard.</p>

        {notice && (
          <Notice tone="gold" className="mt-6">
            {notice}
          </Notice>
        )}

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
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
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <div className="flex justify-end">
            <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[13px] font-bold text-gold hover:underline">
              Forgot password?
            </Link>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" size="lg" block loading={busy}>
            Sign in
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-2">
          New to Kudi9ja?{' '}
          <Link to="/signup" className="font-bold text-gold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
