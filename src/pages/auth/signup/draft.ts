/** The answers so far. Secrets (password, passcode, PIN) are never kept here — the server already holds them, hashed. */
export interface SignupDraft {
  draftId: string | null;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bvn: string;
  nin: string;
  address: string;
  state: string;
  payoutBank: string;
  payoutAccountNumber: string;
  securityQuestion: string;
}

export const emptyDraft: SignupDraft = {
  draftId: null,
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  bvn: '',
  nin: '',
  address: '',
  state: '',
  payoutBank: '',
  payoutAccountNumber: '',
  securityQuestion: '',
};

const KEY = 'k9.signup';

export function loadDraft(): { draft: SignupDraft; step: number } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft: SignupDraft; step: number };
    // BVN and NIN are not kept across a reload either: only their last digits are needed after the identity step.
    return parsed.draft?.draftId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SignupDraft, step: number) {
  try {
    const { bvn, nin, ...rest } = draft;
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ draft: { ...rest, bvn: bvn ? `•••••••${bvn.slice(-4)}` : '', nin: nin ? `•••••••${nin.slice(-4)}` : '' }, step }),
    );
  } catch {
    // ignore
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const STEP_TITLES = [
  'Your details',
  'Verify email',
  'Identity check',
  'Payout account',
  'Secure your account',
  'Sign-in passcode',
  'Transaction PIN',
  'Review',
  'Agree and sign',
];
