import type { AutoFrequency, PublicSettings } from '../types/api';

/**
 * Every money formula the website previews, in one place, reading the live
 * platform settings. These are for showing a customer a figure before they
 * commit — the server prices everything again, and its answer is the one
 * that is charged. Mirrors `Finance` in the app and on the server.
 */

/** A month counted as the settings say (30 days at the shipped value). */
export const targetDays = (s: PublicSettings, months: number) => months * s.savings.daysPerSavingsMonth;

/** Fixed Savings: principal × rate × days ÷ daysPerYear, paid upfront. Never rounded to whole months. */
export function savingsInterest(s: PublicSettings, principal: number, days: number): number {
  return principal * s.savings.annualRate * (days / s.savings.daysPerYear);
}

export function effectiveYieldPct(s: PublicSettings, days: number): number {
  return s.savings.annualRate * (days / s.savings.daysPerYear) * 100;
}

export function targetRuns(s: PublicSettings, frequency: AutoFrequency, months: number): number {
  const days = targetDays(s, months);
  if (frequency === 'DAILY') return days;
  if (frequency === 'WEEKLY') return Math.floor(days / 7);
  return months;
}

export function targetPerDeposit(s: PublicSettings, goal: number, frequency: AutoFrequency, months: number): number {
  const runs = targetRuns(s, frequency, months);
  return runs <= 0 ? goal : goal / runs;
}

/** 2.5% / 5% / 10% by term, at the shipped tiers. */
export function targetRateFor(s: PublicSettings, months: number): number {
  if (months >= s.savings.targetTierLong) return s.savings.targetRateLong;
  if (months >= s.savings.targetTierMedium) return s.savings.targetRateMedium;
  return s.savings.targetRateShort;
}

/**
 * The flat rate for a tenure. A tenure with no entry falls back to the
 * nearest shorter one that has one, so the table can never leave a loan
 * unpriced (the server refuses an unpriced tenure anyway).
 */
export function loanRateFor(s: PublicSettings, months: number): number {
  return rateFromTable(s.lending.rates, months);
}

export function rateFromTable(rates: Record<string, number>, months: number): number {
  const wanted = Math.max(1, months);
  const exact = rates[String(wanted)];
  if (exact !== undefined) return exact;
  const keys = Object.keys(rates)
    .map(Number)
    .filter((k) => Number.isFinite(k))
    .sort((a, b) => a - b);
  if (keys.length === 0) return 0;
  const below = keys.filter((k) => k <= wanted);
  const key = below.length ? below[below.length - 1]! : keys[0]!;
  return rates[String(key)] ?? 0;
}

/** Flat on the full principal up to and including the threshold; a percentage of the WHOLE amount above it. */
export function processingFee(s: PublicSettings, principal: number): number {
  return feeFor(
    { flat: s.lending.flatProcessingFee, threshold: s.lending.processingFeeThreshold, rate: s.lending.processingFeeRate },
    principal,
  );
}

export function feeFor(rule: { flat: number; threshold: number; rate: number }, principal: number): number {
  return principal <= rule.threshold ? rule.flat : principal * rule.rate;
}

export interface LoanPreview {
  rate: number;
  interest: number;
  total: number;
  monthly: number;
  /** The management fee. */
  fee: number;
  /** The flat transaction fee. */
  transactionFee: number;
  net: number;
}

/** The flat transaction fee on every loan, beside the management fee. */
export const transactionFee = (s: PublicSettings): number => s.lending.transactionFee ?? 0;

export function loanPreview(s: PublicSettings, principal: number, months: number): LoanPreview {
  const rate = loanRateFor(s, months);
  const interest = principal * rate;
  const total = principal + interest;
  const fee = principal > 0 ? processingFee(s, principal) : 0;
  const txn = principal > 0 ? transactionFee(s) : 0;
  return { rate, interest, total, monthly: months > 0 ? total / months : 0, fee, transactionFee: txn, net: principal - fee - txn };
}

export function feeBasis(s: PublicSettings, principal: number): string {
  return principal <= s.lending.processingFeeThreshold
    ? `flat fee up to ₦${s.lending.processingFeeThreshold.toLocaleString('en-NG')}`
    : `${Math.round(s.lending.processingFeeRate * 10000) / 100}% of the whole amount`;
}

/** "12.5-25%" — the span of the rate card. */
export function loanRateRange(s: PublicSettings): string {
  const pcts = Array.from({ length: s.lending.maxTenureMonths }, (_, i) => loanRateFor(s, i + 1) * 100).sort((a, b) => a - b);
  if (pcts.length === 0) return '—';
  const fmt = (p: number) => {
    const r = Math.round(p * 100) / 100;
    return Number.isInteger(r) ? r.toFixed(0) : String(r);
  };
  const low = fmt(pcts[0]!);
  const high = fmt(pcts[pcts.length - 1]!);
  return low === high ? `${low}%` : `${low}-${high}%`;
}

/** Adds calendar months, clamping the day to the target month's end (31 Jan + 1 → 28/29 Feb). */
export function addMonths(from: Date, monthsToAdd: number): Date {
  const total = from.getMonth() + monthsToAdd;
  const year = from.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(from.getDate(), lastDay), from.getHours(), from.getMinutes());
}

export type InstalmentState = 'PAID' | 'PARTIAL' | 'UPCOMING' | 'OVERDUE';

export interface Instalment {
  number: number;
  dueDate: Date;
  amount: number;
  paid: number;
  outstanding: number;
  status: InstalmentState;
}

/**
 * Equal instalments, the nth due n months after disbursement. What has been
 * repaid is poured in oldest-first: covered → paid, partly → part paid, past
 * its date and not covered → overdue.
 */
export function buildSchedule(
  principal: number,
  flatRate: number,
  tenureMonths: number,
  disbursedAt: Date,
  amountRepaid = 0,
  now = new Date(),
): Instalment[] {
  const total = principal * (1 + flatRate);
  const each = tenureMonths > 0 ? total / tenureMonths : 0;
  let covered = amountRepaid;
  return Array.from({ length: tenureMonths }, (_, i) => {
    const dueDate = addMonths(disbursedAt, i + 1);
    const paid = covered >= each ? each : Math.max(covered, 0);
    covered -= paid;
    const settled = paid >= each - 0.01;
    const status: InstalmentState = settled
      ? 'PAID'
      : now > dueDate
        ? 'OVERDUE'
        : paid > 0
          ? 'PARTIAL'
          : 'UPCOMING';
    return { number: i + 1, dueDate, amount: each, paid, outstanding: Math.max(each - paid, 0), status };
  });
}
