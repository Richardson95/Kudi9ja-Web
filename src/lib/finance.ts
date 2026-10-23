import type { AutoFrequency, PublicSettings, RepaymentFrequency } from '../types/api';

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
  /** Flat interest, whole naira, rounded up. */
  interest: number;
  /** The loan and its interest, before the transaction fees. */
  loanTotal: number;
  /** The transaction fee on every instalment, added up. */
  fees: number;
  /** Everything repaid: the loan, the interest and every transaction fee. */
  total: number;
  /** How often they repay, and how many times. */
  frequency: RepaymentFrequency;
  count: number;
  /** One instalment, fee included, and its two parts. The last can be a little smaller. */
  each: number;
  base: number;
  instalmentFee: number;
  /** The transaction fee rate on each repayment: 0.02 for 2%. */
  feeRate: number;
  /** The management fee — the only thing taken off the payout. */
  fee: number;
  net: number;
}

/** The transaction fee on each repayment, as a fraction of the instalment: 0.02 for 2%. */
export const repaymentFeeRate = (s: PublicSettings): number => s.lending.repaymentFeeRate ?? 0;

/** "2%". */
export const feeRateLabel = (rate: number) => `${Math.round(rate * 10000) / 100}%`;

/** Rounds up to the whole naira, ignoring floating-point dust (10,417.000000001 is 10,417). */
const ceilNaira = (v: number) => Math.ceil(Math.round(v * 1e6) / 1e6);

/**
 * How many instalments a tenure of `months` starting at `start` is split into:
 * one a month, or one for each whole week the calendar holds between `start`
 * and the same date `months` later — 13 for most three-month loans, 12 when
 * the months are short. Mirrors `RepaymentFrequency` on the server; the loan
 * fixes its count on the day it is paid out.
 */
export function instalmentCount(frequency: RepaymentFrequency, months: number, start: Date = new Date()): number {
  if (months <= 0) return 0;
  if (frequency === 'MONTHLY') return months;
  const days = Math.round((addMonths(start, months).getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(days / 7));
}

/** "a week" or "a month". */
export const perInstalment = (frequency: RepaymentFrequency) => (frequency === 'WEEKLY' ? 'a week' : 'a month');

/** "Each week" or "Each month". */
export const eachInstalment = (frequency: RepaymentFrequency) => (frequency === 'WEEKLY' ? 'Each week' : 'Each month');

/** "13 weekly payments" or "3 monthly payments". */
export const instalmentsPhrase = (frequency: RepaymentFrequency, months: number, start: Date = new Date()) => {
  const n = instalmentCount(frequency, months, start);
  return `${n} ${frequency === 'WEEKLY' ? 'weekly' : 'monthly'} payment${n === 1 ? '' : 's'}`;
};

/** "monthly" or "weekly". */
export const frequencyWord = (frequency: RepaymentFrequency | undefined) => (frequency === 'WEEKLY' ? 'weekly' : 'monthly');

/**
 * How long a loan runs, in the unit it is repaid in: "12 months", or for a
 * weekly loan the weeks those months hold, "52 weeks". The term is always
 * chosen in months; weekly only divides it into weeks. `count` is a loan's
 * fixed instalment count, when it has one.
 */
export function loanLength(frequency: RepaymentFrequency | undefined, months: number, count?: number, start: Date = new Date()): string {
  if (frequency !== 'WEEKLY') return `${months} month${months === 1 ? '' : 's'}`;
  const weeks = count ?? instalmentCount('WEEKLY', months, start);
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

/** "52 weeks (12 months)" for a weekly loan, "12 months" for a monthly one. */
export function loanLengthDetail(frequency: RepaymentFrequency | undefined, months: number, count?: number): string {
  const length = loanLength(frequency, months, count);
  return frequency === 'WEEKLY' ? `${length} (${months} month${months === 1 ? '' : 's'})` : length;
}

/** "6 months, repaid monthly" or "26 weeks, repaid weekly" — for list rows. */
export const termPhrase = (months: number, frequency: RepaymentFrequency | undefined, count?: number) =>
  `${loanLength(frequency, months, count)}, repaid ${frequencyWord(frequency)}`;

/** When the nth instalment (from 1) falls due. */
export function instalmentDue(frequency: RepaymentFrequency, disbursedAt: Date, n: number): Date {
  return frequency === 'WEEKLY' ? new Date(disbursedAt.getTime() + n * 7 * 86_400_000) : addMonths(disbursedAt, n);
}

export interface InstalmentPart {
  base: number;
  fee: number;
}

/**
 * Splits the loan and interest into `count` instalments and puts the
 * transaction fee on each. In whole naira, as loans are now priced: each share
 * rounded up, the last taking what is left, and the fee on each `feeRate` of
 * its share, rounded up. ₦125,000 over 12 weeks at 2% is ₦10,417 + ₦209 a week.
 * Mirrors `Finance.instalmentPlan` on the server.
 */
export function instalmentPlan(loanTotal: number, count: number, feeRate: number, wholeNaira = true): InstalmentPart[] {
  if (count <= 0) return [];
  const round2 = (v: number) => Math.round(v * 100) / 100;
  let each = wholeNaira ? ceilNaira(loanTotal / count) : round2(loanTotal / count);
  let last = round2(loanTotal - each * (count - 1));
  if (wholeNaira && last <= 0) {
    each = Math.floor(loanTotal / count);
    last = round2(loanTotal - each * (count - 1));
  }
  return Array.from({ length: count }, (_, i) => {
    const base = i === count - 1 ? last : each;
    const fee = wholeNaira ? ceilNaira(base * feeRate) : round2(base * feeRate);
    return { base, fee };
  });
}

export function loanPreview(
  s: PublicSettings,
  principal: number,
  months: number,
  frequency: RepaymentFrequency = 'MONTHLY',
  start: Date = new Date(),
): LoanPreview {
  const rate = loanRateFor(s, months);
  const loanTotal = principal > 0 ? ceilNaira(principal * (1 + rate)) : 0;
  const interest = loanTotal - principal;
  const feeRate = repaymentFeeRate(s);
  const count = instalmentCount(frequency, months, start);
  const plan = instalmentPlan(loanTotal, count, feeRate);
  const fees = plan.reduce((sum, p) => sum + p.fee, 0);
  const first = plan[0] ?? { base: 0, fee: 0 };
  const fee = principal > 0 ? processingFee(s, principal) : 0;
  return {
    rate,
    interest: Math.max(interest, 0),
    loanTotal,
    fees,
    total: loanTotal + fees,
    frequency,
    count,
    each: first.base + first.fee,
    base: first.base,
    instalmentFee: first.fee,
    feeRate,
    fee,
    net: principal - fee,
  };
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
  /** Fee included. */
  amount: number;
  base: number;
  fee: number;
  paid: number;
  outstanding: number;
  status: InstalmentState;
}

/**
 * The instalments, each with its transaction fee, the nth due n months (or, weekly, n
 * weeks) after disbursement. What has been repaid is poured in oldest-first:
 * covered → paid, partly → part paid, past its date and not covered → overdue.
 * Mirrors the schedule the server derives.
 */
export function buildSchedule(
  principal: number,
  flatRate: number,
  tenureMonths: number,
  disbursedAt: Date,
  amountRepaid = 0,
  now = new Date(),
  frequency: RepaymentFrequency = 'MONTHLY',
  terms: { count?: number; feeRate?: number; wholeNaira?: boolean } = {},
): Instalment[] {
  const wholeNaira = terms.wholeNaira ?? true;
  const loanTotal = wholeNaira ? ceilNaira(principal * (1 + flatRate)) : principal * (1 + flatRate);
  const count = terms.count ?? instalmentCount(frequency, tenureMonths, disbursedAt);
  const plan = instalmentPlan(loanTotal, count, terms.feeRate ?? 0, wholeNaira);
  let covered = amountRepaid;
  return plan.map((part, i) => {
    const amount = part.base + part.fee;
    const dueDate = instalmentDue(frequency, disbursedAt, i + 1);
    const paid = covered >= amount ? amount : Math.max(covered, 0);
    covered -= paid;
    const settled = paid >= amount - 0.01;
    const status: InstalmentState = settled ? 'PAID' : now > dueDate ? 'OVERDUE' : paid > 0 ? 'PARTIAL' : 'UPCOMING';
    return { number: i + 1, dueDate, amount, base: part.base, fee: part.fee, paid, outstanding: Math.max(amount - paid, 0), status };
  });
}
