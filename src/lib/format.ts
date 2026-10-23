const naira2 = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const naira0 = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 });

/** ₦1,234.50 — always with the naira sign, never "NGN". */
export function naira(value: number | null | undefined): string {
  return naira2.format(value ?? 0).replace('NGN', '₦');
}

/** ₦1,235 — whole naira, for headline figures and limits. */
export function nairaFlat(value: number | null | undefined): string {
  return naira0.format(Math.round(value ?? 0)).replace('NGN', '₦');
}

/** ₦1.5M / ₦250k / ₦900 — for tight spaces. */
export function nairaShort(value: number | null | undefined): string {
  const v = value ?? 0;
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${sign}₦${trim(a / 1_000_000, a % 1_000_000 === 0 ? 0 : 1)}M`;
  if (a >= 1_000) return `${sign}₦${trim(a / 1_000, a % 1_000 === 0 ? 0 : 1)}k`;
  return `${sign}₦${Math.round(a)}`;
}

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0$/, '');
}

export function plainNumber(value: number): string {
  return plain.format(value);
}

/** "17%", "12.5%" — never a rate rounded into something the customer is not charged. */
export function ratePct(pct: number): string {
  const rounded = Math.round(pct * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}%`;
}

/** A fraction (0.17) as a percentage label ("17%"). */
export function rateOf(fraction: number): string {
  return ratePct(fraction * 100);
}

// ── Amount input ────────────────────────────────────────────────────────────

/** Keeps digits and adds thousands separators as the user types: "1500000" → "1,500,000". */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
  return digits ? Number(digits).toLocaleString('en-NG') : '';
}

export function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ── Dates ───────────────────────────────────────────────────────────────────

const dayFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit' });
const monthYearFmt = new Intl.DateTimeFormat('en-NG', { month: 'long', year: 'numeric' });

const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));

export const asDay = (d?: string | Date | null) => (d ? dayFmt.format(toDate(d)) : '—');
export const asTime = (d?: string | Date | null) => (d ? timeFmt.format(toDate(d)) : '—');
export const asDayTime = (d?: string | Date | null) => (d ? `${asDay(d)}, ${asTime(d)}` : '—');
export const asMonthYear = (d?: string | Date | null) => (d ? monthYearFmt.format(toDate(d)) : '—');

export function relative(d?: string | Date | null): string {
  if (!d) return '—';
  const diff = Date.now() - toDate(d).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return asDay(d);
}

/** "3 months left", "12 days left", "Matured". */
export function countdown(d?: string | Date | null): string {
  if (!d) return '—';
  const ms = toDate(d).getTime() - Date.now();
  if (ms < 0) return 'Matured';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 365) {
    const y = Math.floor(days / 365);
    const mo = Math.floor((days % 365) / 30);
    return mo === 0 ? `${y} ${y === 1 ? 'year' : 'years'} left` : `${y}y ${mo}m left`;
  }
  if (days >= 60) return `${Math.floor(days / 30)} months left`;
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} left`;
  return `${Math.max(1, Math.floor(ms / 3_600_000))} hours left`;
}

/** "5 months, 3 weeks" — empty under a week. */
export function humanPeriod(days: number): string {
  if (days < 7) return '';
  let left = days;
  const years = Math.floor(left / 365);
  left %= 365;
  const months = Math.floor(left / 30);
  left %= 30;
  const weeks = Math.floor(left / 7);
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? '' : 's'}`;
  return [years > 0 && unit(years, 'year'), months > 0 && unit(months, 'month'), weeks > 0 && unit(weeks, 'week')]
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
}

/** "171 days (5 months, 3 weeks)". */
export function lockPeriodLabel(days: number): string {
  if (days <= 0) return '0 days';
  const human = humanPeriod(days);
  const base = `${plainNumber(days)} ${days === 1 ? 'day' : 'days'}`;
  return human ? `${base} (${human})` : base;
}

export function lockPeriodShort(days: number): string {
  return humanPeriod(days) || `${days} ${days === 1 ? 'day' : 'days'}`;
}

export const months = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`;

/** ISO date (yyyy-mm-dd) for a local date. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── People ──────────────────────────────────────────────────────────────────

export function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K9';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] ?? '';

/** "••••••• 1234" from the last four digits the server sends. */
/** The server sends BVN/NIN already masked ("*******8901"); show only the last four, our way. */
export const maskLast4 = (last4?: string | null) => (last4 ? `••••••• ${last4.slice(-4)}` : '—');

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email;
  const name = email.slice(0, at);
  const shown = name.slice(0, 2);
  return `${shown}${'*'.repeat(Math.max(0, name.length - shown.length))}${email.slice(at)}`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
