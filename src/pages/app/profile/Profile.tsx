import { useState, type ReactNode } from 'react';
import { BadgeCheck, FileSignature, FileText, Headset, Landmark, Lock, Moon, Pencil, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '../../../components/PageHeader';
import { Avatar, CopyButton, Pill, Segmented, Switch } from '../../../components/ui/Bits';
import { Button } from '../../../components/ui/Button';
import { Card, DetailRows, NavRow, SectionHeader } from '../../../components/ui/Card';
import { Input, Select } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { useAction } from '../../../hooks/useAction';
import { useMySignatures } from '../../../hooks/queries';
import { meApi } from '../../../lib/api/endpoints';
import { downloadFile } from '../../../lib/cn';
import { asDay, asDayTime, maskLast4 } from '../../../lib/format';
import { NIGERIAN_STATES, normalisePhone, validators } from '../../../lib/validators';
import { useProfile, useSession } from '../../../state/session';
import { useTheme, type ThemeChoice } from '../../../state/theme';
import type { SignatureRecord } from '../../../types/api';

export default function Profile() {
  const profile = useProfile();
  const { setProfile, setThemeChoice, setHideBalance } = useSession();
  const theme = useTheme();
  const signatures = useMySignatures();
  const { busy, run } = useAction();
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Profile" />

      <Card gradient glow className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
            <Avatar name={profile.fullName} size={64} />
            <div className="min-w-0 flex-1">
              <p className="break-words text-lg font-extrabold leading-tight sm:text-xl">{profile.fullName}</p>
              <p className="break-all text-[13px] text-ink-3">{profile.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="gold">{profile.kycTierLabel}</Pill>
                {profile.emailVerified && <Pill tone="success" icon={<BadgeCheck className="h-3 w-3" />}>Email verified</Pill>}
                <span className="flex items-center gap-1 whitespace-nowrap font-mono text-[12.5px] font-bold text-gold">
                  {profile.customerRef} <CopyButton value={profile.customerRef} label="Account number copied" />
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" className="w-full sm:w-auto" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
            Edit details
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Personal details" />
          <DetailRows
            rows={[
              ['Phone', profile.phone],
              ['Date of birth', profile.dateOfBirth ? asDay(profile.dateOfBirth) : '—'],
              ['Gender', profile.gender ?? '—'],
              ['Address', profile.address ?? '—'],
              ['State', profile.state ?? '—'],
              ['BVN', maskLast4(profile.bvnLast4)],
              ['NIN', maskLast4(profile.ninLast4)],
              ['Member since', asDay(profile.createdAt)],
            ]}
          />
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionHeader title="Payout account" action="Change" actionTo="/app/wallet/payout-account" />
            {profile.hasPayoutAccount ? (
              <DetailRows
                rows={[
                  ['Bank', profile.payoutBank ?? '—'],
                  ['Account', profile.payoutAccountNumber ?? '—'],
                  ['Name', profile.payoutAccountName ?? profile.fullName],
                ]}
              />
            ) : (
              <Button to="/app/wallet/payout-account" icon={<Landmark className="h-4 w-4" />}>
                Add your bank account
              </Button>
            )}
          </Card>

          <Card>
            <SectionHeader title="Preferences" />
            <div className="space-y-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Moon className="h-4 w-4 text-gold" /> Appearance
                </p>
                <Segmented<ThemeChoice>
                  size="sm"
                  value={theme.choice}
                  onChange={setThemeChoice}
                  options={[
                    { value: 'system', label: 'Match device' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>
              <Row label="Hide balances" hint="Shows ₦ •••• until you tap to reveal.">
                <Switch label="Hide balances" checked={profile.hideBalance} onChange={setHideBalance} />
              </Row>
              <Row label="Auto-debit repayments" hint="Take a due loan repayment from your wallet automatically.">
                <Switch
                  label="Auto-debit"
                  checked={profile.autoDebit}
                  disabled={busy}
                  onChange={(on) => void run(async () => setProfile(await meApi.update({ autoDebit: on })), on ? 'Auto-debit on' : 'Auto-debit off')}
                />
              </Row>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionHeader title="Agreements you signed" />
        {signatures.data?.length ? (
          <ul className="divide-y divide-stroke">
            {signatures.data.map((sig) => (
              <SignedRow key={sig.id} sig={sig} name={profile.fullName} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">
            The agreements you accepted when you opened your account are on the legal page. Accounts opened on this website also keep your signature here.
          </p>
        )}
      </Card>

      <Card padded={false} className="divide-y divide-stroke">
        <NavRow icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Security" subtitle="Password, passcode, PIN and signed-in devices" to="/app/security" />
        <NavRow icon={<Lock className="h-[18px] w-[18px]" />} title="Privacy and your data" subtitle="Download your data or close your account" to="/app/privacy" />
        <NavRow icon={<FileText className="h-[18px] w-[18px]" />} title="Terms and policies" subtitle="Terms, privacy notice and lending terms" to="/app/legal" />
        <NavRow icon={<Headset className="h-[18px] w-[18px]" />} title="Help & complaints" subtitle="Talk to the Kudi9ja team" to="/app/support" />
      </Card>

      <EditDetails open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[12px] text-ink-3">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function SignedRow({ sig, name }: { sig: SignatureRecord; name: string }) {
  const [open, setOpen] = useState(false);
  const download = () => {
    const html = `<!doctype html><meta charset="utf-8"><title>Signed agreements</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;color:#111">
<h1 style="font-size:20px">Kudi9ja — signed agreements</h1>
<p><b>${escape(name)}</b> signed ${escape(sig.documents)} on ${escape(asDayTime(sig.signedAt))}${sig.device ? ` from ${escape(sig.device)}` : ''}.</p>
<p>Typed name: <b>${escape(sig.typedName)}</b></p>
${sig.image ? `<img src="${sig.image}" alt="Signature" style="max-width:360px;border:1px solid #ddd;border-radius:8px;padding:8px;background:#fff">` : ''}
<p style="color:#666;font-size:12px">An electronic signature under section 93 of the Evidence Act 2011.</p></body>`;
    downloadFile(`kudi9ja-signed-${sig.signedAt.slice(0, 10)}.html`, html, 'text/html');
  };
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold">
        <FileSignature className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{sig.documents}</p>
        <p className="text-[12px] text-ink-3">
          Signed {asDayTime(sig.signedAt)} as “{sig.typedName}”
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        View
      </Button>
      <Button size="sm" variant="subtle" onClick={download}>
        Download
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Your signature" description={`${sig.documents} · ${asDayTime(sig.signedAt)}`}>
        {sig.image && <img src={sig.image} alt="Your signature" className="mx-auto max-h-48 rounded-xl border border-stroke bg-white p-3" />}
        <p className="mt-4 text-center text-sm">
          Typed name: <b>{sig.typedName}</b>
        </p>
      </Modal>
    </li>
  );
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function EditDetails({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useProfile();
  const { setProfile } = useSession();
  const { busy, run } = useAction();
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address ?? '');
  const [state, setState] = useState(profile.state ?? '');
  const phoneError = validators.phone(phone);
  const save = async () => {
    const updated = await run(() => meApi.update({ phone: normalisePhone(phone), address: address.trim(), state }), 'Details saved');
    if (updated) {
      setProfile(updated);
      onClose();
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit details"
      description="Your name, date of birth, BVN and NIN come from your identity check and cannot be changed here."
      footer={
        <Button block loading={busy} disabled={!!phoneError || address.trim().length < 5 || !state} onClick={() => void save()} icon={<UserRound className="h-4 w-4" />}>
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={phone ? phoneError : null} />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Select label="State" value={state} onChange={(e) => setState(e.target.value)} options={NIGERIAN_STATES} placeholder="Choose" />
      </div>
    </Modal>
  );
}
