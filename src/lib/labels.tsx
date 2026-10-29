import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  Gavel,
  Info,
  Lock,
  LockOpen,
  MessagesSquare,
  MinusCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  Zap,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import type { Tone } from '../components/ui/Bits';
import type {
  AccountStatus,
  AdminRole,
  AuditCategory,
  AutoFrequency,
  DepositStatus,
  InstallmentStatus,
  LoanApplicationStatus,
  LoanStatus,
  NotifyKind,
  SavingsStatus,
  SupportStatus,
  PaystackStatus,
  Withdrawal,
  TxFilter,
  TxKind,
  TxStatus,
  WithdrawalStatus,
} from '../types/api';

export const roleLabel = (r: AdminRole) => ({ OWNER: 'Owner', ADMIN: 'Administrator', SUPPORT: 'Support', VIEWER: 'Viewer' })[r];

export const roleBlurb = (r: AdminRole) =>
  ({
    OWNER: 'Full control, including rates and managing the admin team',
    ADMIN: 'Everything except adding or removing other admins',
    SUPPORT: 'View customers and act on loans; cannot change rates',
    VIEWER: 'Read-only access to the panel',
  })[r];

/** The permission matrix. Each row reads the same rule that gates the real screen. */
export const can = {
  approvePayments: (r: AdminRole | null) => !!r && r !== 'VIEWER',
  actOnLoans: (r: AdminRole | null) => !!r && r !== 'VIEWER',
  manageCustomers: (r: AdminRole | null) => !!r && r !== 'VIEWER',
  editSettings: (r: AdminRole | null) => r === 'OWNER' || r === 'ADMIN',
  manageTeam: (r: AdminRole | null) => r === 'OWNER',
  /** Anyone on the panel, whatever their role, answers Help & complaints. */
  answerSupport: (r: AdminRole | null) => !!r,
  /** Bulk copies of customers' data: owners and administrators. */
  exportReports: (r: AdminRole | null) => r === 'OWNER' || r === 'ADMIN',
};

export const CAPABILITIES: { label: string; held: (r: AdminRole) => boolean }[] = [
  { label: 'See customers and their full records', held: () => true },
  { label: 'Read the audit log', held: () => true },
  { label: 'Answer Help & complaints chats', held: () => true },
  { label: 'Confirm pay-ins and approve withdrawals', held: (r) => can.approvePayments(r) },
  { label: 'Act on loans — remind, record repayments, write off', held: (r) => can.actOnLoans(r) },
  { label: 'Flag or freeze a customer', held: (r) => can.manageCustomers(r) },
  { label: 'Change rates, limits and switches', held: (r) => can.editSettings(r) },
  { label: 'Download reports (Excel and PDF)', held: (r) => can.exportReports(r) },
  { label: 'Add, promote, suspend or remove admins', held: (r) => can.manageTeam(r) },
];

export const ROLES: AdminRole[] = ['OWNER', 'ADMIN', 'SUPPORT', 'VIEWER'];

// ── Ledger ──────────────────────────────────────────────────────────────────

export const txIcon: Record<TxKind, LucideIcon> = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAWAL: ArrowUpRight,
  SAVINGS_LOCK: Lock,
  INTEREST_PAYOUT: TrendingUp,
  SAVINGS_RELEASE: LockOpen,
  LOAN_DISBURSEMENT: Zap,
  LOAN_REPAYMENT: CheckCircle2,
  FEE: MinusCircle,
};

export function txTone(kind: TxKind, credit: boolean): Tone {
  if (kind === 'INTEREST_PAYOUT') return 'success';
  if (kind === 'FEE') return 'danger';
  return credit ? 'success' : 'neutral';
}

export const txStatusTone = (s: TxStatus): Tone => (s === 'SUCCESSFUL' ? 'success' : s === 'PENDING' ? 'gold' : 'danger');

export const TX_FILTERS: { value: TxFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DEPOSITS', label: 'Deposits' },
  { value: 'WITHDRAWALS', label: 'Withdrawals' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'LOANS', label: 'Loans' },
  { value: 'FEES', label: 'Fees' },
];

// ── Statuses ────────────────────────────────────────────────────────────────

export const loanTone = (s: LoanStatus): Tone =>
  s === 'OVERDUE' || s === 'WRITTEN_OFF' ? 'danger' : s === 'REPAID' ? 'success' : s === 'PENDING' ? 'info' : s === 'ACTIVE' ? 'gold' : 'neutral';

export const loanStatusLabel = (s: LoanStatus) =>
  ({
    PENDING: 'Under review',
    ACTIVE: 'Active',
    REPAID: 'Fully repaid',
    OVERDUE: 'Overdue',
    REJECTED: 'Declined',
    CANCELLED: 'Cancelled',
    WRITTEN_OFF: 'Written off',
  })[s];

export const isLoanOpen = (s: LoanStatus) => s === 'ACTIVE' || s === 'OVERDUE';

export const instalmentTone = (s: InstallmentStatus | string): Tone =>
  s === 'PAID' ? 'success' : s === 'OVERDUE' ? 'danger' : s === 'PARTIAL' ? 'gold' : 'neutral';

export const instalmentLabel = (s: InstallmentStatus | string) =>
  ({ PAID: 'Paid', PARTIAL: 'Part paid', UPCOMING: 'Upcoming', OVERDUE: 'Overdue' })[s as InstallmentStatus] ?? s;

export const planTone = (s: SavingsStatus): Tone => (s === 'ACTIVE' ? 'gold' : s === 'MATURED' ? 'success' : s === 'BROKEN' ? 'danger' : 'neutral');

export const applicationTone = (s: LoanApplicationStatus): Tone =>
  s === 'PENDING' ? 'gold' : s === 'OFFERED' ? 'info' : s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'neutral';

export const depositTone = (s: DepositStatus): Tone => (s === 'PENDING' ? 'gold' : s === 'CONFIRMED' ? 'success' : 'danger');

export const withdrawalTone = (s: WithdrawalStatus): Tone => (s === 'PENDING' ? 'gold' : s === 'APPROVED' ? 'success' : 'danger');

export const supportTone = (s: SupportStatus): Tone =>
  s === 'OPEN' ? 'gold' : s === 'AWAITING_CUSTOMER' ? 'info' : 'success';

export const paystackTone = (s: PaystackStatus): Tone =>
  s === 'SUCCESSFUL' ? 'success' : s === 'INITIALIZED' ? 'gold' : 'danger';

/** What happened to the money after a withdrawal was approved. */
export function payoutLabel(w: Pick<Withdrawal, 'status' | 'statusLabel' | 'payoutStatus'>): { label: string; tone: Tone } {
  if (w.status === 'APPROVED' && w.payoutStatus === 'PROCESSING') return { label: 'Sending', tone: 'info' };
  if (w.status === 'APPROVED' && w.payoutStatus === 'FAILED') return { label: 'Returned to wallet', tone: 'danger' };
  if (w.status === 'APPROVED') return { label: 'Sent', tone: 'success' };
  return { label: w.statusLabel, tone: withdrawalTone(w.status) };
}

export const accountTone = (s: AccountStatus): Tone =>
  s === 'ACTIVE' ? 'success' : s === 'FLAGGED' ? 'gold' : s === 'FROZEN' ? 'info' : s === 'CLOSED' ? 'danger' : s === 'PENDING_ACTIVATION' ? 'info' : 'neutral';

export const frequencyLabel = (f: AutoFrequency) => ({ DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' })[f];
export const frequencyAdverb = (f?: AutoFrequency) => (f ? { DAILY: 'every day', WEEKLY: 'every week', MONTHLY: 'every month' }[f] : '');

// ── Notifications and audit ─────────────────────────────────────────────────

export const notifyStyle: Record<NotifyKind, { icon: LucideIcon; tone: Tone }> = {
  INTEREST: { icon: TrendingUp, tone: 'success' },
  MATURITY: { icon: LockOpen, tone: 'gold' },
  REPAYMENT_DUE: { icon: CalendarClock, tone: 'danger' },
  REPAYMENT_PAID: { icon: BadgeCheck, tone: 'success' },
  AUTO_SAVE: { icon: RefreshCw, tone: 'info' },
  THRIFT: { icon: Users, tone: 'gold' },
  SECURITY: { icon: ShieldCheck, tone: 'info' },
  GENERAL: { icon: Bell, tone: 'neutral' },
  SUPPORT: { icon: MessagesSquare, tone: 'gold' },
};

export const auditStyle: Record<AuditCategory, { icon: LucideIcon; tone: Tone; label: string }> = {
  GENERAL: { icon: Info, tone: 'neutral', label: 'General' },
  SETTINGS: { icon: Settings2, tone: 'gold', label: 'Settings' },
  TEAM: { icon: ShieldCheck, tone: 'info', label: 'Admin team' },
  CUSTOMER: { icon: UserRound, tone: 'success', label: 'Customer' },
  LOAN: { icon: Zap, tone: 'gold', label: 'Lending' },
  DATA_ACCESS: { icon: Eye, tone: 'info', label: 'Record access' },
  COMPLIANCE: { icon: Gavel, tone: 'gold', label: 'Compliance' },
};
