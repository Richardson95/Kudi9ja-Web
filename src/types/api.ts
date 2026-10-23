/**
 * The Kudi9ja API, as the server sends it.
 *
 * Mirrors the Java DTOs in Kudi9ja-Mobile-Backend (web/dto). Money arrives as
 * a JSON number in naira (a BigDecimal on the server); timestamps as ISO-8601
 * strings; enums by their Java name. Fields the server marks optional are
 * optional here, because Jackson omits nulls (default-property-inclusion:
 * non_null) rather than sending them.
 */

export type ISODate = string;
export type Naira = number;

// ── Enums ───────────────────────────────────────────────────────────────────

export type KycTier = 'TIER0' | 'TIER1' | 'TIER2';
/** PENDING_ACTIVATION: opened by the team; the customer takes it over by signing up with the BVN on it. */
export type AccountStatus = 'ACTIVE' | 'FLAGGED' | 'FROZEN' | 'DORMANT' | 'CLOSED' | 'PENDING_ACTIVATION';
export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
export type AdminRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'VIEWER';
export type TxKind =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SAVINGS_LOCK'
  | 'INTEREST_PAYOUT'
  | 'SAVINGS_RELEASE'
  | 'LOAN_DISBURSEMENT'
  | 'LOAN_REPAYMENT'
  | 'FEE';
export type TxStatus = 'PENDING' | 'SUCCESSFUL' | 'REVERSED';
export type TxFilter = 'ALL' | 'DEPOSITS' | 'WITHDRAWALS' | 'SAVINGS' | 'LOANS' | 'FEES';
export type SavingsType = 'FIXED' | 'TARGET';
export type SavingsStatus = 'ACTIVE' | 'MATURED' | 'WITHDRAWN' | 'BROKEN' | 'RELEASED_ON_COMPASSIONATE_GROUNDS';
export type AutoFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type LoanStatus = 'PENDING' | 'ACTIVE' | 'REPAID' | 'OVERDUE' | 'REJECTED' | 'CANCELLED' | 'WRITTEN_OFF';
export type InstallmentStatus = 'PAID' | 'PARTIAL' | 'UPCOMING' | 'OVERDUE';
export type LoanApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DepositPurpose = 'WALLET' | 'LOAN_REPAYMENT';
export type DepositStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
export type NotifyKind =
  | 'INTEREST'
  | 'MATURITY'
  | 'REPAYMENT_DUE'
  | 'REPAYMENT_PAID'
  | 'AUTO_SAVE'
  | 'THRIFT'
  | 'SECURITY'
  | 'GENERAL'
  | 'SUPPORT';
export type AuditCategory = 'GENERAL' | 'SETTINGS' | 'TEAM' | 'CUSTOMER' | 'LOAN' | 'DATA_ACCESS' | 'COMPLIANCE';
export type SignupStep = 'PERSONAL' | 'EMAIL_VERIFIED' | 'IDENTITY' | 'PAYOUT' | 'PASSWORD' | 'PASSCODE' | 'PIN' | 'COMPLETE';
export type LegalKind = 'terms' | 'privacy' | 'lending';
export type OtpPurpose = 'SIGNUP_EMAIL' | 'PASSWORD_RESET' | 'REACTIVATION' | 'PAYOUT_CHANGE' | 'ACCOUNT_CLOSURE';

// ── Paging and errors ───────────────────────────────────────────────────────

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  path?: string;
  at?: ISODate;
}

// ── Session and profile ─────────────────────────────────────────────────────

export interface Profile {
  id: string;
  customerRef: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  bvnLast4?: string;
  ninLast4?: string;
  address?: string;
  state?: string;
  payoutBank?: string;
  payoutAccountNumber?: string;
  payoutAccountName?: string;
  hasPayoutAccount: boolean;
  kycTier: KycTier;
  kycTierLabel: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  biometricsEnabled: boolean;
  securityQuestion?: string;
  themeMode?: ThemeMode;
  hideBalance: boolean;
  autoDebit: boolean;
  accountStatus: AccountStatus;
  admin: boolean;
  adminRole?: AdminRole;
  createdAt: ISODate;
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  expiresAt: ISODate;
  sessionId: string;
  admin: boolean;
  profile: Profile;
}

export interface SessionSummary {
  id: string;
  device: string;
  ipAddress?: string;
  createdAt: ISODate;
  lastSeenAt?: ISODate;
  current: boolean;
}

export interface OtpResponse {
  expiresAt: ISODate;
  resendAfterSeconds: number;
  codeLength: number;
  message: string;
}

export interface DraftResponse {
  draftId: string;
  signupToken: string;
  step: SignupStep;
  nextStep: SignupStep;
  email: string;
  expiresAt: ISODate;
  message?: string;
}

export interface NextRepayment {
  loanId: string;
  purpose: string;
  installmentNumber: number;
  amount: Naira;
  dueDate: ISODate;
  daysUntilDue: number;
}

export interface DashboardResponse {
  balance: Naira;
  totalSaved: Naira;
  totalOwed: Naira;
  netWorth: Naira;
  totalInterestEarned: Naira;
  thriftCommitted: Naira;
  activePlans: number;
  activeLoans: number;
  activeCircles: number;
  unreadNotifications: number;
  hideBalance: boolean;
  nextRepayment?: NextRepayment;
}

export interface OutstandingAgreement {
  kind: string;
  id: LegalKind;
  title: string;
  version: string;
  effectiveFrom: string;
  changeSummary: string;
}

// ── Wallet ──────────────────────────────────────────────────────────────────

export interface WalletResponse {
  balance: Naira;
  customerRef: string;
  totalSaved: Naira;
  totalOwed: Naira;
  netWorth: Naira;
  totalInterestEarned: Naira;
  totalDeposited: Naira;
  pendingWithdrawals: Naira;
  hideBalance: boolean;
  disclosure?: string;
}

export interface Transaction {
  id: string;
  sequence: number;
  kind: TxKind;
  kindLabel: string;
  credit: boolean;
  amount: Naira;
  description: string;
  occurredAt: ISODate;
  balanceAfter: Naira;
  reference: string;
  counterparty?: string;
  status: TxStatus;
  statusLabel: string;
  relatedType?: string;
  relatedId?: string;
}

export interface PaymentInstruction {
  reference: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  minimumAmount: Naira;
  note?: string;
}

export interface Claim {
  id: string;
  amount: Naira;
  reference: string;
  purpose: DepositPurpose;
  purposeLabel: string;
  loanId?: string;
  loanPurpose?: string;
  senderName?: string;
  senderBank?: string;
  status: DepositStatus;
  statusLabel: string;
  claimedAt: ISODate;
  reviewedAt?: ISODate;
  reviewedBy?: string;
  note?: string;
  hasReceipt: boolean;
}

export interface AdminClaim extends Omit<Claim, 'hasReceipt'> {
  userId: string;
  customerName: string;
  customerRef: string;
  hoursWaiting: number;
  receiptUrl?: string;
}

export interface Withdrawal {
  id: string;
  amount: Naira;
  bank: string;
  destinationAccount: string;
  destinationName?: string;
  reference: string;
  status: WithdrawalStatus;
  statusLabel: string;
  requestedAt: ISODate;
  reviewedAt?: ISODate;
  reviewedBy?: string;
  note?: string;
  newBalance?: Naira;
  message?: string;
  /** PAID, PROCESSING or FAILED once approved. */
  payoutStatus?: string;
  payoutFailure?: string;
  paidOutAt?: ISODate;
}

export interface AdminWithdrawal extends Omit<Withdrawal, 'newBalance' | 'message'> {
  userId: string;
  customerName: string;
  customerRef: string;
  hoursWaiting: number;
  payoutReference?: string;
  /** PAYSTACK or MANUAL. */
  payoutProvider?: string;
  transferCode?: string;
}

// ── Savings ─────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  title: string;
  type: SavingsType;
  typeLabel: string;
  status: SavingsStatus;
  statusLabel: string;
  principal: Naira;
  lockDays: number;
  interestPaid: Naira;
  annualRate: number;
  startDate: ISODate;
  maturityDate: ISODate;
  emoji: string;
  targetAmount?: Naira;
  targetMonths?: number;
  autoFrequency?: AutoFrequency;
  autoAmount?: Naira;
  nextAutoRun?: ISODate;
  autoEnabled: boolean;
  bonusRate: number;
  bonusPaid: boolean;
  bonusEarned: Naira;
  projectedBonus: Naira;
  contributions: number;
  missedContributions: number;
  totalValue: Naira;
  valueAtMaturity: Naira;
  amountLeftToTarget: Naira;
  goalReached: boolean;
  progress: number;
  goalProgress: number;
  daysRemaining: number;
  mature: boolean;
  canBreak: boolean;
  canWithdraw: boolean;
}

export interface ReleaseResponse {
  planId: string;
  principalReturned: Naira;
  bonusPaid: Naira;
  totalCredited: Naira;
  newBalance: Naira;
  status: SavingsStatus;
  message: string;
}

// ── Lending ─────────────────────────────────────────────────────────────────

export interface ScheduleRow {
  number: number;
  dueDate: ISODate;
  amount: Naira;
  amountPaid: Naira;
  outstanding: Naira;
  status: InstallmentStatus;
  statusLabel: string;
  daysUntilDue: number;
}

export interface Loan {
  id: string;
  principal: Naira;
  tenureMonths: number;
  flatRate: number;
  flatRateLabel: string;
  processingFee: Naira;
  /** Zero on loans priced before the transaction fee existed. */
  transactionFee: Naira;
  netDisbursed: Naira;
  purpose: string;
  status: LoanStatus;
  statusLabel: string;
  requestedAt: ISODate;
  disbursedAt?: ISODate;
  dueDate?: ISODate;
  settledAt?: ISODate;
  totalInterest: Naira;
  totalRepayable: Naira;
  monthlyRepayment: Naira;
  amountRepaid: Naira;
  rebateGranted: Naira;
  outstanding: Naira;
  repaymentProgress: number;
  installmentsPaid: number;
  schedule: ScheduleRow[];
  nextInstallment?: ScheduleRow;
  earlySettlementRebate: Naira;
  earlySettlementAmount: Naira;
  decisionReasons?: string;
}

export interface LoanQuote {
  principal: Naira;
  months: number;
  flatRate: number;
  flatRateLabel: string;
  costPerMonthPct: number;
  totalInterest: Naira;
  totalRepayable: Naira;
  monthlyRepayment: Naira;
  processingFee: Naira;
  processingFeeBasis: string;
  transactionFee: Naira;
  netDisbursed: Naira;
  firstDueDate: ISODate;
  dueDate: ISODate;
  schedule: ScheduleRow[];
  withinLimits: boolean;
  note?: string;
}

export interface Eligibility {
  eligible: boolean;
  minAmount: Naira;
  maxAmount: Naira;
  minMonths: number;
  maxMonths: number;
  rateCard: Record<string, number>;
  reason?: string;
}

export interface RepaymentResponse {
  loanId: string;
  amountPaid: Naira;
  rebate: Naira;
  outstanding: Naira;
  status: LoanStatus;
  newBalance: Naira;
  message: string;
}

export interface Guarantor {
  fullName: string;
  phone: string;
  address: string;
  state: string;
  localGovernment: string;
  landmark: string;
  relationship: string;
  bvn: string;
  occupation?: string;
  email?: string;
}

export interface ApplicationDocument {
  label: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface LoanApplication {
  id: string;
  amount: Naira;
  tenureMonths: number;
  purpose: string;
  businessName: string;
  businessAddress?: string;
  monthlyIncome?: Naira;
  guarantors?: Guarantor[];
  documentsAttached?: number;
  status: LoanApplicationStatus;
  statusLabel: string;
  submittedAt: ISODate;
  reviewedAt?: ISODate;
  rejectionReason?: string;
  loanId?: string;
}

export interface AdminApplicationRow {
  id: string;
  userId: string;
  customerName: string;
  customerRef: string;
  amount: Naira;
  tenureMonths: number;
  purpose: string;
  businessName: string;
  status: LoanApplicationStatus;
  statusLabel: string;
  submittedAt: ISODate;
  reviewedAt?: ISODate;
  reviewedBy?: string;
}

export interface AdminApplicationDetail extends AdminApplicationRow {
  businessAddress: string;
  monthlyIncome: Naira;
  guarantors: Guarantor[];
  bankStatement?: ApplicationDocument;
  statementPassword?: string;
  selfie?: ApplicationDocument;
  businessPhotos: ApplicationDocument[];
  rejectionReason?: string;
  loanId?: string;
}

// ── Thrift ──────────────────────────────────────────────────────────────────

export interface CircleMember {
  id: string;
  userId: string;
  displayName: string;
  initials: string;
  customerRef: string;
  position: number;
  isMe: boolean;
  hasCollected: boolean;
  paidThisRound: boolean;
  payoutDate: ISODate;
}

export interface Circle {
  id: string;
  name: string;
  emoji: string;
  contribution: Naira;
  frequency: AutoFrequency;
  frequencyLabel: string;
  startDate: ISODate;
  size: number;
  potSize: Naira;
  totalCommitment: Naira;
  currentRound: number;
  started: boolean;
  complete: boolean;
  progress: number;
  inviteCode: string;
  createdByMe: boolean;
  myPosition: number;
  myPayoutDate?: ISODate;
  iHaveCollected: boolean;
  iHavePaidThisRound: boolean;
  myRoundsPaid: number[];
  paidThisRound: number;
  nextCollectionDate?: ISODate;
  currentCollector?: CircleMember;
  members: CircleMember[];
}

export interface RoundResponse {
  circleId: string;
  round: number;
  payout: Naira;
  collectorRef: string;
  collectorName: string;
  youCollected: boolean;
  nextRound: number;
  complete: boolean;
  newBalance: Naira;
  message: string;
}

// ── Notifications and reviews ───────────────────────────────────────────────

export interface AppNotification {
  id: string;
  kind: NotifyKind;
  title: string;
  body: string;
  date: ISODate;
  read: boolean;
  amount?: Naira;
}

export interface NotificationPreference {
  kind: NotifyKind;
  label: string;
  canBeSwitchedOff: boolean;
  enabled: boolean;
  whyNot?: string;
}

export interface Review {
  id: string;
  displayName: string;
  rating: number;
  comment: string;
  writtenAt: ISODate;
  edited: boolean;
  mine: boolean;
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
}

// ── Reference data ──────────────────────────────────────────────────────────

export interface PublicSettings {
  version: number;
  savings: {
    annualRate: number;
    minLockDays: number;
    maxLockDays: number;
    daysPerYear: number;
    minAmount: Naira;
    maxAmount: Naira;
    targetRateShort: number;
    targetRateMedium: number;
    targetRateLong: number;
    targetTierMedium: number;
    targetTierLong: number;
    minTargetMonths: number;
    daysPerSavingsMonth: number;
  };
  lending: {
    rates: Record<string, number>;
    maxTenureMonths: number;
    minAmount: Naira;
    maxAmount: Naira;
    flatProcessingFee: Naira;
    processingFeeThreshold: Naira;
    processingFeeRate: number;
    /** Flat, on every loan, beside the management fee. */
    transactionFee: number;
  };
  wallet: { minDepositAmount: Naira; minWithdrawalAmount: Naira };
  thrift: { minContribution: Naira; minMembers: number; maxMembers: number };
  collectionAccount: { bank: string; accountNumber: string; accountName: string };
  switches: { savingsEnabled: boolean; lendingEnabled: boolean; thriftEnabled: boolean; maintenanceMode: boolean };
  security: {
    maxPasscodeAttempts: number;
    lockTimeoutMinutes: number;
    otpResendSeconds: number;
    passcodeLength: number;
    pinLength: number;
  };
  company: {
    legalName: string;
    rcNumber: string;
    productName: string;
    supportEmail: string;
    legalEmail: string;
    privacyEmail: string;
    supportPhone?: string;
    whatsapp: string[];
  };
}

export interface Bank {
  code: string;
  name: string;
}

export type LegalBlock =
  | { type: 'text'; text: string }
  | { type: 'note'; text: string; title?: string; tone?: 'neutral' | 'positive' | 'caution' }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'definitions'; entries: { term: string; meaning: string }[] }
  | { type: 'example'; title?: string; rows: { label: string; value: string }[] };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  kind: LegalKind;
  title: string;
  shortTitle: string;
  version: string;
  summary: string;
  readMinutes: number;
  effectiveFrom?: ISODate;
  publishedAt?: ISODate;
  inForce: boolean;
  changeSummary?: string;
  body: unknown;
}

// ── Data rights ─────────────────────────────────────────────────────────────

export interface ClosureEligibility {
  canClose: boolean;
  blockers: string[];
  walletBalance: Naira;
  lockedInSavings: Naira;
  outstandingOnLoans: Naira;
  retentionNote: string;
}

export interface ClosureResponse {
  status: AccountStatus;
  closedAt: ISODate;
  retainUntil: ISODate;
  sessionsEnded: number;
  redacted: string[];
  retained: string[];
  message: string;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string;
  actor: string;
  category: AuditCategory;
  categoryLabel: string;
  action: string;
  detail: string;
  date: ISODate;
}

export interface Overview {
  customerFundsHeld: Naira;
  queues: {
    pendingPayIns: number;
    pendingPayInValue: Naira;
    pendingWithdrawals: number;
    pendingWithdrawalValue: Naira;
    unmatchedPayIns: number;
    payInsBreachingSla: number;
    withdrawalsBreachingSla: number;
  };
  book: {
    totalSaved: Naira;
    totalInterestPaid: Naira;
    totalLent: Naira;
    totalInterestCharged: Naira;
    totalFeesCharged: Naira;
    totalOverdue: Naira;
    activePlans: number;
    maturedPlans: number;
    activeLoans: number;
    overdueLoans: number;
    repaidLoans: number;
  };
  people: {
    customers: number;
    activeCustomers: number;
    frozenCustomers: number;
    dormantCustomers: number;
    newThisWeek: number;
    admins: number;
  };
  recentActivity: AuditRow[];
  generatedAt: ISODate;
}

export interface CustomerRow {
  id: string;
  customerRef: string;
  fullName: string;
  email?: string;
  phone: string;
  kycTier: KycTier;
  kycTierLabel: string;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  balance: Naira;
  createdAt: ISODate;
  lastActiveAt?: ISODate;
}

export interface CustomerDetail {
  id: string;
  customerRef: string;
  fullName: string;
  email?: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  bvnLast4?: string;
  ninLast4?: string;
  address?: string;
  state?: string;
  payoutBank?: string;
  payoutAccountNumber?: string;
  payoutAccountName?: string;
  payoutVerified: boolean;
  kycTier: KycTier;
  kycTierLabel: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  statusNote?: string;
  createdAt: ISODate;
  lastActiveAt?: ISODate;
  isAdmin: boolean;
  adminRole?: AdminRole;
  financials: {
    balance: Naira;
    totalSaved: Naira;
    totalInterestEarned: Naira;
    totalDeposited: Naira;
    totalOwed: Naira;
    pendingWithdrawals: Naira;
    activePlans: number;
    totalPlans: number;
    activeLoans: number;
    totalLoans: number;
    overdueLoans: number;
    transactionCount: number;
  };
}

export interface IssuedReference {
  reference: string;
  copiedAt: ISODate;
  claimed: boolean;
  claimId?: string;
}

export interface AdminLoanRow {
  loanId: string;
  customerId: string;
  customerName: string;
  customerRef: string;
  principal: Naira;
  outstanding: Naira;
  amountRepaid: Naira;
  processingFee: Naira;
  tenureMonths: number;
  purpose: string;
  status: LoanStatus;
  statusLabel: string;
  disbursedAt?: ISODate;
  dueDate?: ISODate;
  daysOverdue: number;
}

export interface ImportedLoan {
  id: string;
  bvnLast4?: string;
  fullName: string;
  email?: string;
  phone?: string;
  principal: Naira;
  tenureMonths: number;
  flatRate: number;
  /** The management fee taken when the loan was given. */
  processingFee: Naira;
  /** The transaction fee taken when the loan was given. */
  transactionFee: Naira;
  /** What the borrower actually received: the loan less both fees. */
  netDisbursed: Naira;
  purpose: string;
  disbursedAt?: ISODate;
  dueDate?: ISODate;
  totalRepayable: Naira;
  amountRepaid: Naira;
  outstanding: Naira;
  importedBy?: string;
  importedAt?: ISODate;
  claimed: boolean;
  claimedAt?: ISODate;
  customerId?: string;
  loanId?: string;
  ninLast4?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  state?: string;
  occupation?: string;
  businessName?: string;
  businessAddress?: string;
  monthlyIncome?: Naira;
  payoutBank?: string;
  payoutAccountNumber?: string;
  notes?: string;
  guarantors?: OfflineGuarantor[];
}

/** A guarantor on a loan written outside the app. Only the name is required. */
export interface OfflineGuarantor {
  fullName: string;
  phone?: string;
  address?: string;
  state?: string;
  localGovernment?: string;
  landmark?: string;
  relationship?: string;
  bvn?: string;
  occupation?: string;
  email?: string;
}

export interface OfflineDocument {
  id: string;
  label: string;
  contentType: string;
  sizeBytes?: number;
  filename?: string;
  uploadedBy?: string;
  uploadedAt: ISODate;
  url: string;
}

export type RepaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'CHEQUE' | 'OTHER';

export interface OfflineRepayment {
  id: string;
  importedLoanId?: string;
  loanId?: string;
  amount: Naira;
  paidAt: ISODate;
  method: RepaymentMethod;
  reference?: string;
  note?: string;
  recordedBy?: string;
  recordedAt: ISODate;
}

export interface OfflineLoanFile {
  loan: ImportedLoan;
  documents: OfflineDocument[];
  repayments: OfflineRepayment[];
}

export interface LoanRecords {
  loanId?: string;
  importedLoanId?: string;
  documents: OfflineDocument[];
  repayments: OfflineRepayment[];
}

export interface CustomerLoanRecords {
  importedLoans: ImportedLoan[];
  documents: OfflineDocument[];
  repayments: OfflineRepayment[];
}

/** Everything an admin can type about an offline borrower. */
export interface ImportLoanInput {
  bvn: string;
  fullName: string;
  email?: string;
  phone?: string;
  principal: number;
  tenureMonths: number;
  flatRate: number;
  processingFee?: number;
  transactionFee?: number;
  purpose: string;
  disbursedAt: string;
  amountRepaid?: number;
  nin?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  state?: string;
  occupation?: string;
  businessName?: string;
  businessAddress?: string;
  monthlyIncome?: number;
  payoutBank?: string;
  payoutAccountNumber?: string;
  notes?: string;
  guarantors?: OfflineGuarantor[];
  /** The loan officers; the first leads. Empty: whoever enters it. */
  officerIds?: string[];
  /** The loan group this borrower belongs to. */
  groupId?: string;
}

export type OfflineLoanUpdate = Partial<
  Pick<
    ImportLoanInput,
    | 'bvn'
    | 'fullName'
    | 'email'
    | 'phone'
    | 'nin'
    | 'dateOfBirth'
    | 'gender'
    | 'address'
    | 'state'
    | 'occupation'
    | 'businessName'
    | 'businessAddress'
    | 'monthlyIncome'
    | 'payoutBank'
    | 'payoutAccountNumber'
    | 'purpose'
    | 'notes'
    | 'guarantors'
  >
>;

export interface RecordRepaymentInput {
  amount: number;
  paidAt?: string;
  method: RepaymentMethod;
  reference?: string;
  note?: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: AdminRole;
  roleLabel: string;
  roleBlurb: string;
  addedAt: ISODate;
  addedBy?: string;
  active: boolean;
  lastActiveAt?: ISODate;
  isMe: boolean;
  canBeEdited: boolean;
}

export interface RoleOption {
  value: AdminRole;
  label: string;
  blurb: string;
}

/** The full, editable platform settings document (GET/PUT /admin/settings). */
export interface PlatformSettings {
  version: number;
  createdAt?: ISODate;
  createdBy?: string;
  savingsAnnualRate: number;
  minLockDays: number;
  maxLockDays: number;
  daysPerYear: number;
  minSavingsAmount: Naira;
  maxSavingsAmount: Naira;
  targetRateShort: number;
  targetRateMedium: number;
  targetRateLong: number;
  targetTierMedium: number;
  targetTierLong: number;
  minTargetMonths: number;
  daysPerSavingsMonth: number;
  loanRates: Record<string, number>;
  maxLoanTenureMonths: number;
  minLoanAmount: Naira;
  maxLoanAmount: Naira;
  /** Retired: paying early earns no discount. Always 0. */
  earlyPayoffRebateShare: number;
  /** Retired: loans can no longer be cancelled once paid out. Always 0. */
  loanCancellationHours: number;
  flatProcessingFee: Naira;
  processingFeeThreshold: Naira;
  loanProcessingFeeRate: number;
  loanTransactionFee: number;
  maxPasscodeAttempts: number;
  lockTimeoutMinutes: number;
  otpResendSeconds: number;
  minDepositAmount: Naira;
  minWithdrawalAmount: Naira;
  minCircleContribution: Naira;
  minCircleMembers: number;
  maxCircleMembers: number;
  companyAccountName: string;
  companyAccountNumber: string;
  companyBank: string;
  savingsEnabled: boolean;
  lendingEnabled: boolean;
  thriftEnabled: boolean;
  maintenanceMode: boolean;
}

// ── Paystack ────────────────────────────────────────────────────────────────

export type PaystackStatus = 'INITIALIZED' | 'SUCCESSFUL' | 'FAILED' | 'ABANDONED';

export interface PaystackCheckout {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amount: Naira;
}

export interface PaystackPayment {
  id: string;
  reference: string;
  amount: Naira;
  purpose: DepositPurpose;
  purposeLabel: string;
  loanId?: string;
  status: PaystackStatus;
  statusLabel: string;
  credited: boolean;
  channel?: string;
  cardType?: string;
  cardLast4?: string;
  cardBank?: string;
  createdAt: ISODate;
  paidAt?: ISODate;
}

export interface AdminPaystackPayment extends PaystackPayment {
  userId: string;
  customerName: string;
  customerRef: string;
  fees?: Naira;
  gatewayResponse?: string;
}

// ── Signed agreements ───────────────────────────────────────────────────────

export interface SignatureRecord {
  id: string;
  typedName: string;
  documents: string;
  signedAt: ISODate;
  device?: string;
  /** Data URL — the customer's own copy. */
  image?: string;
  /** Signed link — the panel's copy. */
  url?: string;
}

// ── Help and complaints ─────────────────────────────────────────────────────

export type SupportKind = 'COMPLAINT' | 'ENQUIRY';
export type SupportStatus = 'OPEN' | 'AWAITING_CUSTOMER' | 'RESOLVED';
export type SupportAuthor = 'CUSTOMER' | 'STAFF' | 'SYSTEM';

export interface SupportConversation {
  id: string;
  reference: string;
  kind: SupportKind;
  kindLabel: string;
  category: string;
  subject: string;
  status: SupportStatus;
  statusLabel: string;
  assignedToName?: string;
  lastMessageAt: ISODate;
  lastMessagePreview?: string;
  lastMessageBy?: SupportAuthor;
  unread: number;
  acknowledgeBy?: ISODate;
  acknowledgedAt?: ISODate;
  resolveBy?: ISODate;
  resolvedAt?: ISODate;
  resolutionNote?: string;
  overdue: boolean;
  createdAt: ISODate;
  /** The panel's fields. */
  customerId?: string;
  customerName?: string;
  customerRef?: string;
  assignedToId?: string;
  resolvedBy?: string;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  author: SupportAuthor;
  authorName: string;
  mine: boolean;
  body?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  attachmentUrl?: string;
  createdAt: ISODate;
}

export interface SupportThread {
  conversation: SupportConversation;
  messages: SupportMessage[];
}

export interface SupportMessageEvent {
  conversation: SupportConversation;
  message: SupportMessage;
}

export interface SupportTypingEvent {
  conversationId: string;
  who: SupportAuthor;
  name: string;
}

export interface SupportQueueSummary {
  open: number;
  awaitingCustomer: number;
  unassigned: number;
  overdue: number;
  unread: number;
}

// ── Loan officers ───────────────────────────────────────────────────────────

export interface OfficerOption {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  roleLabel: string;
  borrowers: number;
}

export interface AssignedOfficer {
  id: string;
  officerId: string;
  name: string;
  email: string;
  phone?: string;
  lead: boolean;
  stillOnTeam: boolean;
  assignedAt: ISODate;
  assignedBy: string;
}

export interface MyOfficer {
  name: string;
  email: string;
  phone?: string;
  lead: boolean;
}

export interface OfficerBorrower {
  assignmentId: string;
  customerId?: string;
  importedLoanId?: string;
  name: string;
  customerRef?: string;
  signedUp: boolean;
  lead: boolean;
  assignedAt: ISODate;
}

// ── Loan groups ─────────────────────────────────────────────────────────────

export interface LoanGroup {
  id: string;
  number: number;
  name: string;
  area?: string;
  description?: string;
  officerId: string;
  officerName: string;
  officerEmail: string;
  officerStillOnTeam: boolean;
  active: boolean;
  members: number;
  signedUp: number;
  totalLent: Naira;
  outstanding: Naira;
  overdueMembers: number;
  createdAt: ISODate;
  createdBy: string;
  /** Whether the signed-in admin may add, edit and remove members. */
  canManage: boolean;
}

export interface LoanGroupMember {
  id: string;
  customerId?: string;
  importedLoanId?: string;
  name: string;
  customerRef?: string;
  phone?: string;
  signedUp: boolean;
  loans: number;
  lent: Naira;
  outstanding: Naira;
  overdue: boolean;
  nextDue?: ISODate;
  addedAt: ISODate;
  addedBy: string;
}

/** One place a borrower holds in a group, for labelling lists. */
export interface GroupLabel {
  customerId?: string;
  importedLoanId?: string;
  groupId: string;
  number: number;
  name: string;
}

export interface LoanGroupDetail {
  group: LoanGroup;
  members: LoanGroupMember[];
}
