/** Field checks, worded exactly as the app words them. Each returns an error message, or null when fine. */

export const validators = {
  required: (v: string, field = 'This field') => (v.trim() ? null : `${field} is required`),

  fullName(v: string) {
    const value = v.trim();
    if (!value) return 'Full name is required';
    const parts = value.split(/\s+/);
    if (parts.length < 2) return 'Enter your first and last name';
    if (parts.some((p) => p.length < 2)) return 'Each name needs 2+ letters';
    if (!/^[a-zA-Z\s'-]+$/.test(value)) return 'Letters only, please';
    return null;
  },

  email(v: string) {
    if (!v.trim()) return 'Email address is required';
    return /^[\w.+-]+@[\w-]+\.[\w.-]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address';
  },

  phone(v: string) {
    if (!v.trim()) return 'Phone number is required';
    return /^0(70|80|81|90|91)\d{8}$/.test(normalisePhone(v)) ? null : 'Enter an 11-digit number e.g. 08031234567';
  },

  address(v: string) {
    const value = v.trim();
    if (!value) return 'Address is required';
    if (value.length < 5) return 'Give your street, area and city';
    if (value.length > 400) return 'That address is too long';
    return null;
  },

  bvn: (v: string) => (!v.trim() ? 'BVN is required' : v.replace(/\D/g, '').length !== 11 ? 'BVN must be exactly 11 digits' : null),
  nin: (v: string) => (!v.trim() ? 'NIN is required' : v.replace(/\D/g, '').length !== 11 ? 'NIN must be exactly 11 digits' : null),

  password(v: string) {
    if (!v) return 'Password is required';
    if (v.length < 8) return 'At least 8 characters';
    if (!/[A-Z]/.test(v)) return 'Add an uppercase letter';
    if (!/[a-z]/.test(v)) return 'Add a lowercase letter';
    if (!/[0-9]/.test(v)) return 'Add a number';
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(v)) return 'Add a special character';
    return null;
  },

  dateOfBirth(v: string) {
    if (!v) return 'Date of birth is required';
    const dob = new Date(`${v}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return 'Enter a valid date';
    const years = (Date.now() - dob.getTime()) / (365.25 * 86_400_000);
    if (years < 18) return 'You must be at least 18 years old';
    if (years > 100) return 'Please check the date entered';
    return null;
  },

  /** Rejects repeated digits (111111) and straight runs (123456 / 654321). */
  passcodeStrength(code: string) {
    if (new Set(code).size === 1) return 'Avoid repeating a single digit';
    let ascending = true;
    let descending = true;
    for (let i = 1; i < code.length; i++) {
      const prev = Number(code[i - 1]);
      const cur = Number(code[i]);
      if (cur !== prev + 1) ascending = false;
      if (cur !== prev - 1) descending = false;
    }
    return ascending || descending ? 'Avoid sequential digits' : null;
  },
};

export function normalisePhone(v: string): string {
  let digits = v.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) digits = `0${digits.slice(3)}`;
  return digits;
}

export function passwordScore(v: string): number {
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(v)) s++;
  return s;
}

/** The same person, written the same way: case, spacing and punctuation ignored. */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  return norm(a).length > 0 && norm(a) === norm(b);
}

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is your mother’s maiden name?',
  'What city were you born in?',
  'What was the name of your first pet?',
  'What is your favourite childhood meal?',
];

export const GENDERS = ['Female', 'Male', 'Prefer not to say'];

export const PLAN_EMOJIS = ['🎯', '🏠', '🚗', '🎓', '💍', '✈️', '💼', '🏥', '📱', '👶', '🎉', '🛠️', '🌍', '💡', '🏦', '🤝'];

export const LOAN_PURPOSES = ['Business', 'Education', 'Medical', 'Rent', 'Vehicle', 'Personal'];
