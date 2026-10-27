import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, CheckCircle2, Fingerprint, Landmark, Lock, PiggyBank, ShieldCheck, Users, Zap } from 'lucide-react';
import { BrandLogo, BrandMark } from '../../components/Brand';
import { usePageTitle } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { lockPeriodShort, naira, nairaFlat, nairaShort, ratePct } from '../../lib/format';
import { effectiveYieldPct, loanPreview, loanRateFor, savingsInterest } from '../../lib/finance';
import { useSettings } from '../../state/settings';

/** The app's three onboarding slides, as a landing page. */
export default function Welcome() {
  usePageTitle('');
  const s = useSettings();
  const rate = ratePct(s.savings.annualRate * 100);
  const example = loanPreview(s, 200_000, 3);
  const exampleDays = [30, 90, 365, 730];

  return (
    <div className="min-h-screen bg-canvas">
      <div className="night-gradient pointer-events-none fixed inset-0" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <BrandLogo height={40} />
        <nav className="flex items-center gap-2">
          <Link to="/legal" className="hidden px-3 py-2 text-[13.5px] font-semibold text-ink-2 hover:text-ink sm:block">
            How it works
          </Link>
          <Button variant="ghost" size="sm" to="/signin">
            Sign in
          </Button>
          <Button size="sm" to="/signup">
            Open an account
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
        <div className="animate-rise">
          <p className="eyebrow mb-4 text-gold">Easy money.</p>
          <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-[60px]">
            Earn {rate}.
            <br />
            <span className="gold-text">Paid upfront.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Lock any amount from {s.savings.minLockDays} days to {lockPeriodShort(s.savings.maxLockDays)} and we credit your full return the
            same second the plan starts. Borrow up to {nairaFlat(s.lending.maxAmount)} for your business at a flat rate. Run your Ajo circle
            without the notebook.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" to="/signup" iconRight={<ArrowRight className="h-5 w-5" />}>
              Get started
            </Button>
            <Button size="lg" variant="ghost" to="/signin">
              I already have an account
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[13px] text-ink-2">
            {[
              [ShieldCheck, 'Accounts held with your BVN & NIN'],
              [Lock, 'Passcode + transaction PIN'],
              [Fingerprint, 'Payments secured by Paystack'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Lock;
              return (
                <span key={label as string} className="flex items-center gap-2">
                  <I className="h-4 w-4 text-gold" /> {label as string}
                </span>
              );
            })}
          </div>
        </div>

        {/* The upfront-interest card */}
        <div className="relative animate-rise [animation-delay:150ms]">
          <div className="absolute -inset-6 rounded-[40px] bg-gold/10 blur-3xl" />
          <div className="card-gradient relative overflow-hidden rounded-3xl border border-gold/25 p-7 shadow-pop">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink-2">Lock ₦100,000 for a year</p>
                <BrandMark size={28} />
              </div>
              <p className="num mt-4 text-[13px] text-ink-3">Paid into your wallet today</p>
              <p className="num text-[46px] font-extrabold tracking-[-0.035em] gold-text">{naira(savingsInterest(s, 100_000, 365))}</p>
              <div className="mt-6 space-y-2.5">
                {exampleDays.map((d) => (
                  <div key={d} className="flex items-center justify-between rounded-xl bg-surface-alt/50 px-4 py-2.5 text-[13.5px]">
                    <span className="text-ink-2">{lockPeriodShort(d)}</span>
                    <span className="num font-bold">
                      +{naira(savingsInterest(s, 100_000, d))}
                      <span className="ml-2 text-[11.5px] font-semibold text-success">{ratePct(effectiveYieldPct(s, d))}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three products */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <Product
            icon={<PiggyBank />}
            eyebrow="Save"
            title={`Fixed Savings at ${rate}`}
            stat={rate}
            statLabel="per annum, paid instantly"
            points={['Your whole return lands the day you start', 'Top up whenever you like', 'Principal returns in full at maturity']}
          />
          <Product
            icon={<Zap />}
            eyebrow="Borrow"
            title="Credit at your speed"
            stat={nairaShort(s.lending.maxAmount)}
            statLabel="the most we lend"
            points={[
              `${ratePct(loanRateFor(s, 1) * 100)} flat over 1 month`,
              `Borrow ₦200,000 → ${nairaFlat(example.net)} in your wallet`,
              'Repay weekly or monthly',
            ]}
          />
          <Product
            icon={<Users />}
            eyebrow="Ajo circles"
            title="Ajo, done properly"
            stat={`${s.thrift.minMembers}–${s.thrift.maxMembers}`}
            statLabel="members per circle"
            points={['Everyone pays in each cycle', 'One member collects the pot each round', 'Kudi9ja keeps the record and the reminders']}
          />
        </div>
      </section>

      {/* How money moves */}
      <section className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="rounded-3xl border border-stroke bg-surface p-8 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="eyebrow text-gold">Honest by design</p>
              <h2 className="mt-3 text-[30px] font-extrabold leading-tight tracking-[-0.03em]">Paid in by Paystack. Paid out to you alone.</h2>
              <p className="mt-4 leading-relaxed text-ink-2">
                Add money or repay a loan by card, bank transfer or USSD through Paystack. It reaches your wallet — or comes off what you owe — the
                moment Paystack confirms it, with no receipt to upload and nothing to wait for. Withdrawals go only to a bank account in your own name.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-stroke bg-canvas/40 p-4">
                <Landmark className="h-5 w-5 shrink-0 text-gold" />
                <p className="text-[13px] text-ink-2">
                  Card details go to Paystack, never to Kudi9ja. Every payment is checked with Paystack before a naira is credited.
                </p>
              </div>
            </div>
            <ol className="space-y-4">
              {[
                'Open your account in a few minutes — BVN, NIN and a payout account in your own name.',
                'Add money by card, bank transfer or USSD through Paystack — credited the moment it is confirmed.',
                'Lock savings, borrow, or start an Ajo circle — every move confirmed with your PIN.',
                'Withdraw to your own bank account. Once approved, Paystack sends it straight to your bank.',
              ].map((t, i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gold-gradient text-[13px] font-extrabold text-on-gold">{i + 1}</span>
                  <p className="pt-1 text-[14.5px] leading-relaxed text-ink-2">{t}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <h2 className="text-[28px] font-extrabold tracking-[-0.03em]">Ready when you are.</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" to="/signup" iconRight={<ArrowRight className="h-5 w-5" />}>
              Open my account
            </Button>
            <Button size="lg" variant="ghost" to="/legal" icon={<Calculator className="h-5 w-5" />}>
              Read the terms first
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-stroke">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[12.5px] text-ink-3 sm:px-8">
          <p>
            © {new Date().getFullYear()} {s.company.legalName} · {s.company.rcNumber}. Kudi9ja is a product of {s.company.legalName}.
          </p>
          <div className="flex gap-5">
            <Link to="/legal/terms" className="hover:text-gold">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-gold">Privacy</Link>
            <Link to="/legal/lending" className="hover:text-gold">Lending Agreement</Link>
            <a href={`mailto:${s.company.supportEmail}`} className="hover:text-gold">{s.company.supportEmail}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Product({
  icon,
  eyebrow,
  title,
  stat,
  statLabel,
  points,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  stat: string;
  statLabel: string;
  points: string[];
}) {
  return (
    <div className="group rounded-3xl border border-stroke bg-surface p-7 transition hover:-translate-y-1 hover:border-gold/35">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <p className="eyebrow mt-6 text-gold">{eyebrow}</p>
      <h3 className="mt-1.5 text-xl font-extrabold tracking-[-0.02em]">{title}</h3>
      <div className="mt-5 flex items-baseline gap-3 border-y border-stroke py-4">
        <span className="num text-[30px] font-extrabold tracking-[-0.03em] gold-text">{stat}</span>
        <span className="text-[12.5px] text-ink-3">{statLabel}</span>
      </div>
      <ul className="mt-5 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[13.5px] text-ink-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
