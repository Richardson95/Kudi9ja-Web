import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Fingerprint,
  Landmark,
  Lock,
  Menu,
  /* PiggyBank, */ ShieldCheck,
  /* Users, */ X,
  Zap,
} from 'lucide-react';
import { BrandLogo, BrandMark } from '../../components/Brand';
import { PromiseHeading, PromiseList } from '../../components/Promises';
import { Reveal, useCycle } from '../../components/landing/Motion';
import { usePageTitle } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { nairaFlat, nairaShort /* , ratePct */ } from '../../lib/format';
import { useSettings } from '../../state/settings';

/*
 * Photos are from Unsplash, free under the Unsplash License:
 *   hero-office, who-employee, wallet  — Vitaly Gariev
 *   hero-trader                       — Ali Mkumbwa (Dar es Salaam)
 *   hero-lagos                        — Nupo Deyon Daniel (Civic Towers, Lekki, Lagos)
 *   who-business                      — Tunde Buremo (Ibadan)
 *   who-personal                      — Ben Iwara (Lagos)
 *   market                            — Fahd Aminu (Lagos)
 */
// `flip` mirrors a photo so its subject faces into the page, towards the words.
const HERO_SLIDES = [
  { src: '/landing/hero-office.jpg', position: '30% 30%', flip: true },
  { src: '/landing/hero-trader.jpg', position: '55% 35%', flip: false },
  { src: '/landing/hero-lagos.jpg', position: '50% 50%', flip: false },
];

const PRODUCT_LINES = ['Employee loans', 'Personal loans', 'Business loans' /* , 'Savings' */];

const TRUST: [typeof Lock, string][] = [
  [ShieldCheck, 'Accounts held with your BVN & NIN'],
  [Lock, 'Passcode + transaction PIN'],
  [Fingerprint, 'Payments secured by Paystack'],
];

/** The app's three onboarding slides, as a landing page. */
export default function Welcome() {
  usePageTitle('');
  const s = useSettings();
  // const rate = ratePct(s.savings.annualRate * 100); // savings is switched off for now

  return (
    <div className="min-h-screen overflow-x-clip bg-canvas">
      <SiteHeader supportEmail={s.company.supportEmail} />

      <Hero />

      <TrustMarquee />

      {/* The three loan lines, as photographs */}
      <section className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 sm:px-8 lg:pt-28">
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0">
          {[
            { label: PRODUCT_LINES[0], src: '/landing/who-employee.jpg', position: '40% 50%' },
            { label: PRODUCT_LINES[1], src: '/landing/who-personal.jpg', position: '50% 30%' },
            { label: PRODUCT_LINES[2], src: '/landing/who-business.jpg', position: '50% 40%' },
          ].map((card, i) => (
            <Reveal key={card.label} delay={i * 120} className="w-[78%] shrink-0 snap-center sm:w-auto">
              <Link
                to="/signup"
                className={cn('group relative block aspect-[3/4] overflow-hidden rounded-3xl border border-stroke bg-surface shadow-pop', i === 1 && 'sm:translate-y-10')}
              >
                <img
                  src={card.src}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-[1200ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.07]"
                  style={{ objectPosition: card.position }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 transition group-hover:ring-gold/50" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-6">
                  <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(241_168_59)]" /> {card.label}
                  </p>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition duration-500 group-hover:rotate-45 group-hover:border-transparent group-hover:bg-[rgb(241_168_59)] group-hover:text-[rgb(18_12_2)]">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Why Kudi9ja: a photograph beside the promises */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-14">
        <Reveal className="relative order-2 lg:order-1">
          <div className="absolute -inset-8 rounded-[48px] bg-gold/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-gold/20 shadow-pop">
            <img src="/landing/wallet.jpg" alt="" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]" style={{ objectPosition: '45% 50%' }} />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-transparent" />
          </div>
          {/* Brand mark, floating off the corner of the photo */}
          <div className="absolute -right-3 -top-5 animate-float sm:-right-6">
            <div className="card-gradient grid h-20 w-20 place-items-center rounded-3xl border border-gold/30 shadow-pop">
              <BrandMark size={40} halo />
            </div>
          </div>
          <div className="absolute -bottom-5 left-6 animate-float rounded-2xl border border-gold/25 bg-surface/90 px-4 py-3 shadow-pop backdrop-blur-xl [animation-delay:-3s] sm:left-10">
            <p className="num text-[26px] font-extrabold leading-none tracking-[-0.03em] gold-text">{nairaShort(s.lending.maxAmount)}</p>
            <p className="mt-1 text-[12px] text-ink-3">the most we lend</p>
          </div>
        </Reveal>

        <Reveal delay={120} className="relative order-1 lg:order-2">
          <div className="absolute -inset-6 rounded-[40px] bg-gold/10 blur-3xl" />
          <div className="card-gradient relative overflow-hidden rounded-3xl border border-gold/25 p-6 shadow-pop sm:p-8">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative">
              <div className="mb-7 flex items-center justify-between">
                <p className="eyebrow text-gold">Why Kudi9ja</p>
                <BrandMark size={28} />
              </div>
              <PromiseList />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Three products */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        {/* Was three products in a grid (sm:grid-cols-2 lg:grid-cols-3); Savings and Ajo circles are switched off for now. */}
        <Reveal className="mx-auto grid max-w-xl gap-5">
          <Product
            icon={<Zap />}
            eyebrow="Borrow"
            title="Credit at your speed"
            stat={nairaShort(s.lending.maxAmount)}
            statLabel="the most we lend"
            points={[
              'Interest rate as low as 5%',
              `Borrow ${nairaFlat(s.lending.minAmount)} to ${nairaFlat(s.lending.maxAmount)}`,
              'Repay weekly or monthly',
            ]}
          />
          {/* Savings and Ajo circles are switched off for now.
          <Product
            icon={<PiggyBank />}
            eyebrow="Save"
            title={`Fixed Savings at ${rate}`}
            stat={rate}
            statLabel="per annum, paid instantly"
            points={['Your whole return lands the day you start', 'Top up whenever you like', 'Principal returns in full at maturity']}
          />
          <Product
            className="sm:col-span-2 lg:col-span-1"
            icon={<Users />}
            eyebrow="Ajo circles"
            title="Ajo, done properly"
            stat={`${s.thrift.minMembers}–${s.thrift.maxMembers}`}
            statLabel="members per circle"
            points={['Everyone pays in each cycle', 'One member collects the pot each round', 'Kudi9ja keeps the record and the reminders']}
          />
          */}
        </Reveal>
      </section>

      {/* How money moves */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl border border-stroke bg-surface p-5 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-2">
            <div>
              <p className="eyebrow text-gold">Built on trust</p>
              <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[30px]">Paid in by Paystack. Paid out to you alone.</h2>
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
            <ol className="relative space-y-4">
              {/* The thread joining the four steps */}
              <span className="absolute bottom-4 left-4 top-4 w-px bg-gradient-to-b from-gold/60 via-gold/25 to-transparent" aria-hidden />
              {[
                'Open your account in a few minutes — BVN, NIN and a payout account in your own name.',
                'Add money by card, bank transfer or USSD through Paystack — credited the moment it is confirmed.',
                'Apply for a loan and repay it from your wallet — every move confirmed with your PIN.',
                'Withdraw to your own bank account. Once approved, Paystack sends it straight to your bank.',
              ].map((t, i) => (
                <Reveal as="li" key={t} delay={150 + i * 110} className="relative flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gold-gradient text-[13px] font-extrabold text-on-gold shadow-gold">{i + 1}</span>
                  <p className="pt-1 text-[14.5px] leading-relaxed text-ink-2">{t}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>

      {/* Closing call to action, over an aerial photograph of a Lagos market */}
      <section className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <Reveal className="dark relative overflow-hidden rounded-[32px] border border-gold/20 text-ink shadow-pop">
          <div
            className="absolute inset-0 bg-cover bg-center lg:bg-fixed"
            style={{ backgroundImage: 'url(/landing/market.jpg)' }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-[rgb(7_6_6/0.72)]" />
          <div className="night-gradient absolute inset-0" />
          <div className="relative flex flex-col items-center gap-4 px-5 py-20 text-center sm:py-28">
            <BrandMark size={44} halo />
            <h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] sm:text-[40px]">Ready when you are.</h2>
            <div className="mt-2 flex justify-center gap-2 sm:gap-3">
              <Button size="hero" to="/signup" iconRight={<ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />}>
                Open my account
              </Button>
              <Button size="hero" variant="ghost" to="/legal" icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}>
                Read the terms first
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-stroke">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-[12.5px] text-ink-3 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-xl leading-relaxed lg:max-w-none">
            © {new Date().getFullYear()} {s.company.legalName} · {s.company.rcNumber}. Kudi9ja is a product of {s.company.legalName}.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 whitespace-nowrap">
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

/** Sits over the hero photo, then turns solid and blurred once the page scrolls. */
function SiteHeader({ supportEmail }: { supportEmail: string }) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || menu;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-500',
        solid ? 'border-b border-stroke bg-canvas/80 backdrop-blur-xl' : 'dark border-b border-transparent',
      )}
    >
      <div className={cn('relative mx-auto flex max-w-6xl items-center justify-between px-5 transition-[padding] duration-500 sm:px-8', solid ? 'py-3' : 'py-5')}>
        <BrandLogo height={solid ? 34 : 40} className="transition-[height] duration-500" />
        {/* Phones: everything sits behind one menu button so the bar doesn't overflow. */}
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-stroke bg-surface/70 text-ink-2 backdrop-blur transition hover:text-ink md:hidden"
          aria-label={menu ? 'Close menu' : 'Open menu'}
          aria-expanded={menu}
        >
          {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {menu && (
          <div className="absolute inset-x-5 top-full mt-2 animate-rise rounded-2xl border border-stroke bg-surface p-2 shadow-card md:hidden">
            <Link to="/legal" className="block rounded-xl px-4 py-3 text-[15px] font-semibold text-ink-2 hover:bg-surface-alt hover:text-ink">
              How it works
            </Link>
            <a href={`mailto:${supportEmail}`} className="block rounded-xl px-4 py-3 text-[15px] font-semibold text-ink-2 hover:bg-surface-alt hover:text-ink">
              Contact us
            </a>
            <div className="mt-2 grid gap-2 border-t border-stroke p-2 pt-4">
              <Button variant="ghost" block to="/signin">
                Sign in
              </Button>
              <Button block to="/signup">
                Open an account
              </Button>
            </div>
          </div>
        )}
        <nav className="hidden items-center gap-2 md:flex">
          <Link to="/legal" className="px-3 py-2 text-[13.5px] font-semibold text-ink-2 transition hover:text-ink">
            How it works
          </Link>
          <a href={`mailto:${supportEmail}`} className="px-3 py-2 text-[13.5px] font-semibold text-ink-2 transition hover:text-ink">
            Contact us
          </a>
          <Button variant="ghost" size="sm" to="/signin" className="bg-surface/60 backdrop-blur">
            Sign in
          </Button>
          <Button size="sm" to="/signup">
            Open an account
          </Button>
        </nav>
      </div>
    </header>
  );
}

/** Full-screen photographs that cross-fade and slowly drift, with the headline over them. */
function Hero() {
  const [active, setActive] = useCycle(HERO_SLIDES.length, 7000);
  const [prev, setPrev] = useState(-1);
  const [shown, setShown] = useState(active);

  // Keep the outgoing slide drifting while it fades, so it doesn't snap back.
  if (active !== shown) {
    setPrev(shown);
    setShown(active);
  }

  return (
    <section className="relative isolate flex min-h-[min(100svh,1000px)] flex-col overflow-hidden">
      {/* Photographs, always on dark */}
      <div className="dark absolute inset-0 -z-10 bg-canvas" aria-hidden>
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className={cn(
              // Desktop: the photo takes the right two-thirds and feathers into the dark behind the words.
              'absolute inset-y-0 right-0 w-full overflow-hidden transition-opacity duration-[1400ms] ease-in-out lg:w-[68%] lg:[mask-image:linear-gradient(90deg,transparent,black_38%)]',
              i === active ? 'opacity-100' : 'opacity-0',
            )}
          >
            <img
              src={slide.src}
              alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              {...(i === 0 ? { fetchpriority: 'high' } : {})}
              className={cn('h-full w-full object-cover will-change-transform', (i === active || i === prev) && 'animate-kenburns')}
              style={{ objectPosition: slide.position, scale: slide.flip ? '-1 1' : undefined }}
            />
          </div>
        ))}
        {/* Darkest behind the words, lighter where the people are */}
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(7_6_6/0.94)] via-[rgb(7_6_6/0.7)] to-[rgb(7_6_6/0.25)] lg:from-[rgb(7_6_6/0.9)] lg:from-25% lg:via-[rgb(7_6_6/0.35)] lg:via-55% lg:to-[rgb(7_6_6/0.1)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[rgb(7_6_6/0.7)] to-transparent" />
        <div className="absolute -left-40 top-1/4 h-[560px] w-[560px] rounded-full bg-[rgb(241_168_59/0.14)] blur-[140px]" />
        {/* Film grain, so the gradients don't band */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>
      {/* Melts the photo into the page, in whichever theme the page is in */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-canvas to-transparent" aria-hidden />

      <div className="dark relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-28 pt-32 text-ink sm:px-8 lg:pt-36">
        <div className="max-w-2xl">
          <ul className="grid w-fit animate-rise grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl border border-gold/30 bg-black/30 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-gold backdrop-blur-md sm:flex sm:rounded-full sm:py-1.5 sm:text-[12px] sm:tracking-[0.14em]">
            {PRODUCT_LINES.map((label) => (
              <li key={label} className="flex items-center gap-2 whitespace-nowrap">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-gold opacity-60" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-gold" />
                </span>
                {label}
              </li>
            ))}
          </ul>
          <PromiseHeading className="mt-6 animate-rise text-[42px] leading-[1.04] [animation-delay:120ms] sm:text-[64px] lg:text-[72px]" />
          <p className="mt-6 max-w-xl animate-rise text-[17.6px] leading-relaxed text-white/90 [animation-delay:240ms]">
            At Kudi9ja, we provide flexible financing solutions designed to meet your needs, with competitive monthly interest rates that make
            repayment easy and convenient.
          </p>
          <p className="mt-4 max-w-xl animate-rise text-[17.6px] leading-relaxed text-white/90 [animation-delay:320ms]">
            Money for the needs that can’t wait for month end, paid straight into your Kudi9ja wallet, with a repayment plan that is clear from
            day one.
          </p>
          <div className="mt-8 flex animate-rise gap-2 [animation-delay:420ms] sm:gap-3">
            <Button size="hero" to="/signup" iconRight={<ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />}>
              Get started
            </Button>
            <Button size="hero" variant="ghost" to="/signin" className="bg-white/10 backdrop-blur-md hover:bg-white/15">
              I already have an account
            </Button>
          </div>
          <div className="mt-10 flex animate-rise flex-wrap gap-x-7 gap-y-3 text-[13px] text-white/80 [animation-delay:520ms]">
            {TRUST.map(([Icon, label]) => (
              <span key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gold" /> {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Slide picker with a filling progress bar, and a nudge to scroll */}
      <div className="dark absolute inset-x-0 bottom-8 mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-8">
        <div className="flex gap-2">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => setActive(i)}
              className="group relative h-1 w-10 overflow-hidden rounded-full bg-white/20 transition-all hover:bg-white/35 sm:w-14"
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
            >
              {i === active && <span key={`p${active}`} className="absolute inset-0 origin-left animate-progress rounded-full bg-gold [animation-duration:7000ms]" />}
            </button>
          ))}
        </div>
        <ChevronDown className="h-6 w-6 animate-nudge text-white/70" aria-hidden />
      </div>
    </section>
  );
}

/** An endless gold ribbon of what Kudi9ja offers and how it keeps money safe. */
function TrustMarquee() {
  const items = [...PRODUCT_LINES, ...TRUST.map(([, label]) => label)];
  const row = (hidden?: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((label) => (
        <span key={label} className="flex items-center gap-6 whitespace-nowrap px-6 text-[13px] font-bold uppercase tracking-[0.16em] text-ink-2">
          <BrandMark size={16} /> {label}
        </span>
      ))}
    </div>
  );

  return (
    <div className="relative border-y border-stroke bg-surface/60 py-4 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row()}
        {row(true)}
      </div>
    </div>
  );
}

function Product({
  className,
  icon,
  eyebrow,
  title,
  stat,
  statLabel,
  points,
}: {
  className?: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  stat: string;
  statLabel: string;
  points: string[];
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-stroke bg-surface p-6 transition duration-500 hover:-translate-y-1 hover:border-gold/35 hover:shadow-pop sm:p-7 ${className ?? ''}`}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/10 opacity-0 blur-3xl transition duration-700 group-hover:opacity-100" />
      <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <p className="eyebrow relative mt-6 text-gold">{eyebrow}</p>
      <h3 className="relative mt-1.5 text-xl font-extrabold tracking-[-0.02em]">{title}</h3>
      <div className="relative mt-5 flex items-baseline gap-3 border-y border-stroke py-4">
        <span className="num text-[30px] font-extrabold tracking-[-0.03em] gold-text">{stat}</span>
        <span className="text-[12.5px] text-ink-3">{statLabel}</span>
      </div>
      <ul className="relative mt-5 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[13.5px] text-ink-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
