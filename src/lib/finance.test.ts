import { describe, expect, it } from 'vitest';
import type { PublicSettings } from '../types/api';
import {
  addMonths,
  buildSchedule,
  effectiveYieldPct,
  instalmentCount,
  loanPreview,
  loanRateFor,
  loanRateRange,
  processingFee,
  rateFromTable,
  savingsInterest,
  targetPerDeposit,
  targetRateFor,
  targetRuns,
} from './finance';
import { formatAmountInput, humanPeriod, lockPeriodLabel, naira, nairaShort, parseAmount, ratePct } from './format';
import { passwordScore, sameName, validators } from './validators';

/** The shipped defaults from the README. */
const S: PublicSettings = {
  version: 1,
  savings: {
    annualRate: 0.17,
    minLockDays: 30,
    maxLockDays: 1825,
    daysPerYear: 365,
    minAmount: 5000,
    maxAmount: 50_000_000,
    targetRateShort: 0.025,
    targetRateMedium: 0.05,
    targetRateLong: 0.1,
    targetTierMedium: 6,
    targetTierLong: 12,
    minTargetMonths: 3,
    daysPerSavingsMonth: 30,
  },
  lending: {
    rates: Object.fromEntries(
      [12.5, 17, 25, 32, 38, 45, 51, 57, 63, 68, 73, 78, 83, 88, 93, 98, 102, 107, 111, 116, 121, 125, 130, 134].map(
        (p, i) => [String(i + 1), p / 100],
      ),
    ),
    maxTenureMonths: 24,
    minAmount: 50_000,
    maxAmount: 5_000_000,
    flatProcessingFee: 5000,
    processingFeeThreshold: 500_000,
    processingFeeRate: 0.01,
    transactionFee: 2000,
  },
  wallet: { minDepositAmount: 100, minWithdrawalAmount: 500 },
  thrift: { minContribution: 1000, minMembers: 2, maxMembers: 12 },
  collectionAccount: { bank: 'Zenith Bank', accountNumber: '1018548852', accountName: 'Quadrilateral Technologies Ltd' },
  switches: { savingsEnabled: true, lendingEnabled: true, thriftEnabled: true, maintenanceMode: false },
  security: { maxPasscodeAttempts: 5, lockTimeoutMinutes: 2, otpResendSeconds: 45, passcodeLength: 6, pinLength: 4 },
  company: {
    legalName: 'Quadrilateral Technologies Limited',
    rcNumber: 'RC 1657731',
    productName: 'Kudi9ja',
    supportEmail: 'support@kudi9ja.com',
    legalEmail: 'legal@kudi9ja.com',
    privacyEmail: 'privacy@kudi9ja.com',
    whatsapp: [],
  },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

describe('Fixed Savings — the published table', () => {
  it.each([
    [30, 1397.26],
    [90, 4191.78],
    [171, 7964.38],
    [365, 17000],
    [730, 34000],
    [1825, 85000],
  ])('₦100,000 for %i days earns ₦%f', (days, expected) => {
    expect(round2(savingsInterest(S, 100_000, days))).toBe(expected);
  });

  it('reports the yield over the term', () => {
    expect(effectiveYieldPct(S, 365)).toBeCloseTo(17);
    expect(effectiveYieldPct(S, 171)).toBeCloseTo(7.964, 3);
  });
});

describe('Target Savings', () => {
  it('saves ₦100,000 over 6 months daily as 180 deposits of ₦555.56', () => {
    expect(targetRuns(S, 'DAILY', 6)).toBe(180);
    expect(round2(targetPerDeposit(S, 100_000, 'DAILY', 6))).toBe(555.56);
  });

  it('counts weekly deposits in whole weeks', () => {
    expect(targetRuns(S, 'WEEKLY', 6)).toBe(25);
  });

  it('pays the bonus tier for the term', () => {
    expect(targetRateFor(S, 3)).toBe(0.025);
    expect(targetRateFor(S, 5)).toBe(0.025);
    expect(targetRateFor(S, 6)).toBe(0.05);
    expect(targetRateFor(S, 11)).toBe(0.05);
    expect(targetRateFor(S, 12)).toBe(0.1);
    expect(targetRateFor(S, 36)).toBe(0.1);
  });
});

describe('Lending', () => {
  it.each([
    [1, 225_000, 225_000],
    [2, 234_000, 117_000],
    [3, 250_000, 83_333.33],
    [6, 290_000, 48_333.33],
    [12, 356_000, 29_666.67],
    [24, 468_000, 19_500],
  ])('₦200,000 over %i months repays ₦%f', (m, total, monthly) => {
    const p = loanPreview(S, 200_000, m);
    expect(round2(p.total)).toBe(total);
    expect(round2(p.monthly)).toBe(monthly);
  });

  it('charges a flat ₦5,000 up to and including ₦500,000, then 1% of the whole amount', () => {
    expect(processingFee(S, 50_000)).toBe(5000);
    expect(processingFee(S, 500_000)).toBe(5000);
    expect(processingFee(S, 500_001)).toBeCloseTo(5000.01);
    expect(processingFee(S, 2_000_000)).toBe(20_000);
  });

  it('takes both fees out of the disbursement, not on top of the debt', () => {
    const p = loanPreview(S, 200_000, 3);
    expect(p.fee).toBe(5000);
    expect(p.transactionFee).toBe(2000);
    expect(p.net).toBe(193_000);
    expect(p.total).toBe(250_000);
  });

  it.each([
    [100_000, 5000, 93_000],
    [600_000, 6000, 592_000],
  ])('₦%i borrowed: ₦%i management fee, ₦2,000 transaction fee, ₦%i received', (principal, fee, net) => {
    const p = loanPreview(S, principal, 3);
    expect(p.fee).toBe(fee);
    expect(p.transactionFee).toBe(2000);
    expect(p.net).toBe(net);
  });

  it('keeps the two rate-card invariants', () => {
    for (let m = 2; m <= 24; m++) {
      expect(loanRateFor(S, m)).toBeGreaterThan(loanRateFor(S, m - 1));
      expect(loanRateFor(S, m) / m).toBeLessThan(loanRateFor(S, m - 1) / (m - 1));
    }
  });

  it('falls back to the nearest shorter priced tenure', () => {
    expect(rateFromTable({ '1': 0.1, '3': 0.25 }, 2)).toBe(0.1);
    expect(rateFromTable({ '3': 0.25 }, 1)).toBe(0.25);
  });

  it('summarises the card', () => {
    expect(loanRateRange(S)).toBe('12.5-134%');
  });

  it('builds a schedule and pours repayments in oldest-first', () => {
    const start = new Date(2026, 0, 31);
    const now = new Date(2026, 2, 15);
    const rows = buildSchedule(200_000, 0.25, 3, start, 100_000, now);
    expect(rows.map((r) => r.dueDate.getDate())).toEqual([28, 31, 30]);
    expect(rows[0]!.status).toBe('PAID');
    expect(rows[1]!.status).toBe('PARTIAL');
    expect(round2(rows[1]!.paid)).toBe(16_666.67);
    expect(rows[2]!.status).toBe('UPCOMING');
  });

  it('adds calendar months and clamps to month end', () => {
    expect(addMonths(new Date(2024, 0, 31), 1).getDate()).toBe(29);
    expect(addMonths(new Date(2026, 10, 15), 3).getFullYear()).toBe(2027);
  });
});

describe('Formatting', () => {
  it('prints naira with the sign', () => {
    expect(naira(1500.5)).toBe('₦1,500.50');
    expect(nairaShort(1_500_000)).toBe('₦1.5M');
    expect(nairaShort(250_000)).toBe('₦250k');
  });

  it('never rounds a rate into a different one', () => {
    expect(ratePct(12.5)).toBe('12.5%');
    expect(ratePct(17)).toBe('17%');
    expect(ratePct(5.58)).toBe('5.58%');
  });

  it('labels lock periods in days with the human equivalent', () => {
    expect(lockPeriodLabel(171)).toBe('171 days (5 months, 3 weeks)');
    expect(lockPeriodLabel(30)).toBe('30 days (1 month)');
    expect(humanPeriod(5)).toBe('');
  });

  it('formats and parses typed amounts', () => {
    expect(formatAmountInput('001500000')).toBe('1,500,000');
    expect(parseAmount('1,500,000')).toBe(1_500_000);
  });
});

describe('Validation', () => {
  it('rejects weak passcodes', () => {
    expect(validators.passcodeStrength('111111')).not.toBeNull();
    expect(validators.passcodeStrength('123456')).not.toBeNull();
    expect(validators.passcodeStrength('654321')).not.toBeNull();
    expect(validators.passcodeStrength('193746')).toBeNull();
  });

  it('checks Nigerian phone numbers', () => {
    expect(validators.phone('08031234567')).toBeNull();
    expect(validators.phone('+234 803 123 4567')).toBeNull();
    expect(validators.phone('0503123456')).not.toBeNull();
  });

  it('scores passwords', () => {
    expect(passwordScore('Abcdefg1!xyz')).toBe(5);
    expect(validators.password('Abcdefg1!')).toBeNull();
  });

  it('matches a typed signature name to the account name', () => {
    expect(sameName('Ada  Okafor', 'ada okafor')).toBe(true);
    expect(sameName('Ada Okafor', 'Ada Okafo')).toBe(false);
  });
});

describe('weekly repayment', () => {
  it('splits a tenure into as many weeks as the months hold', () => {
    expect(instalmentCount('WEEKLY', 1)).toBe(4);
    expect(instalmentCount('WEEKLY', 3)).toBe(13);
    expect(instalmentCount('WEEKLY', 6)).toBe(26);
    expect(instalmentCount('WEEKLY', 12)).toBe(52);
    expect(instalmentCount('MONTHLY', 6)).toBe(6);
  });

  it('costs the same as monthly, split into weekly instalments seven days apart', () => {
    const weekly = loanPreview(S, 200_000, 3, 'WEEKLY');
    const monthly = loanPreview(S, 200_000, 3);
    expect(weekly.total).toBe(monthly.total);
    expect(weekly.count).toBe(13);
    expect(round2(weekly.each)).toBe(round2(weekly.total / 13));

    const start = new Date(2026, 0, 31, 12);
    const rows = buildSchedule(200_000, 0.25, 3, start, 0, start, 'WEEKLY');
    expect(rows).toHaveLength(13);
    expect((rows[1]!.dueDate.getTime() - rows[0]!.dueDate.getTime()) / 86_400_000).toBe(7);
    expect(round2(rows.reduce((sum, r) => sum + r.amount, 0))).toBe(250_000);
  });
});
