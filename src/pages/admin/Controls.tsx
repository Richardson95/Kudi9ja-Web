import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Save, Undo2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Notice, Switch } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys, useAdminSettings } from '../../hooks/queries';
import { adminApi } from '../../lib/api/endpoints';
import { asDayTime } from '../../lib/format';
import { can } from '../../lib/labels';
import { useSession } from '../../state/session';
import { settingsKey } from '../../state/settings';
import type { PlatformSettings } from '../../types/api';

type NumKey = { [K in keyof PlatformSettings]-?: PlatformSettings[K] extends number ? K : never }[keyof PlatformSettings];
type BoolKey = { [K in keyof PlatformSettings]-?: PlatformSettings[K] extends boolean ? K : never }[keyof PlatformSettings];

/** Rates are stored as fractions; they are edited as percentages. */
const PERCENT: NumKey[] = ['savingsAnnualRate', 'targetRateShort', 'targetRateMedium', 'targetRateLong', 'loanProcessingFeeRate'];

export default function Controls() {
  const settings = useAdminSettings();
  const { adminRole } = useSession();
  const editable = can.editSettings(adminRole);
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [announcing, setAnnouncing] = useState(false);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const changed = useMemo(() => {
    if (!draft || !settings.data) return [] as string[];
    return (Object.keys(draft) as (keyof PlatformSettings)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(settings.data![k]));
  }, [draft, settings.data]);

  if (settings.isLoading || !draft) return <PageSpinner />;

  const num = (k: NumKey, label: string, hint?: string) => {
    const pct = PERCENT.includes(k);
    const value = draft[k] as number;
    return (
      <Input
        label={label}
        hint={hint}
        type="number"
        step={pct ? '0.01' : 'any'}
        disabled={!editable}
        value={pct ? String(Math.round(value * 10000) / 100) : String(value)}
        suffix={pct ? '%' : undefined}
        onChange={(e) => {
          const n = Number(e.target.value);
          setDraft({ ...draft, [k]: pct ? n / 100 : n });
        }}
      />
    );
  };
  const flag = (k: BoolKey, label: string, hint: string) => (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-stroke p-3">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[12px] text-ink-3">{hint}</p>
      </div>
      <Switch label={label} checked={draft[k] as boolean} disabled={!editable} onChange={(v) => setDraft({ ...draft, [k]: v })} />
    </div>
  );

  const save = async () => {
    const ok = await dialogs.confirm({
      title: `Save ${changed.length} change${changed.length > 1 ? 's' : ''}?`,
      message: 'New figures apply to new plans and loans from now. Running plans and loans keep the terms they started with.',
      confirmLabel: 'Save',
    });
    if (!ok) return;
    const saved = await run(() => adminApi.saveSettings(settings.data!.version, draft), 'Settings saved');
    if (saved) {
      qc.setQueryData(keys.admin.settings, saved);
      await qc.invalidateQueries({ queryKey: settingsKey });
    }
  };

  const rates = Object.entries(draft.loanRates).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controls"
        subtitle={`Version ${draft.version}${draft.createdBy ? ` · last changed by ${draft.createdBy}` : ''}${draft.createdAt ? ` · ${asDayTime(draft.createdAt)}` : ''}`}
        actions={
          <>
            <Button variant="ghost" icon={<Megaphone className="h-4 w-4" />} onClick={() => setAnnouncing(true)} disabled={!can.manageCustomers(adminRole)}>
              Announce
            </Button>
            {editable && (
              <>
                <Button variant="subtle" disabled={!changed.length} icon={<Undo2 className="h-4 w-4" />} onClick={() => setDraft(settings.data!)}>
                  Undo
                </Button>
                <Button disabled={!changed.length} loading={busy} icon={<Save className="h-4 w-4" />} onClick={() => void save()}>
                  Save {changed.length ? `(${changed.length})` : ''}
                </Button>
              </>
            )}
          </>
        }
      />
      {!editable && <Notice tone="info">Your role can read these settings but not change them.</Notice>}

      <Group title="Switches">
        <div className="grid gap-3 md:grid-cols-2">
          {flag('savingsEnabled', 'Savings', 'New savings plans can be opened')}
          {flag('lendingEnabled', 'Lending', 'New loan applications are taken')}
          {flag('thriftEnabled', 'Ajo circles', 'New circles can be started')}
          {flag('maintenanceMode', 'Maintenance mode', 'Pauses money movement; customers see a notice')}
        </div>
      </Group>

      <Group title="Savings">
        <Grid>
          {num('savingsAnnualRate', 'Fixed savings rate, a year')}
          {num('minLockDays', 'Shortest lock (days)')}
          {num('maxLockDays', 'Longest lock (days)')}
          {num('daysPerYear', 'Days in a year, for interest')}
          {num('minSavingsAmount', 'Smallest plan (₦)')}
          {num('maxSavingsAmount', 'Largest plan (₦)')}
          {num('targetRateShort', 'Target bonus, short')}
          {num('targetRateMedium', 'Target bonus, medium')}
          {num('targetRateLong', 'Target bonus, long')}
          {num('targetTierMedium', 'Medium from (months)')}
          {num('targetTierLong', 'Long from (months)')}
          {num('minTargetMonths', 'Shortest target plan (months)')}
        </Grid>
      </Group>

      <Group title="Lending">
        <Grid>
          {num('minLoanAmount', 'Smallest loan (₦)')}
          {num('maxLoanAmount', 'Largest loan (₦)')}
          {num('maxLoanTenureMonths', 'Longest term (months)')}
          {num('flatProcessingFee', 'Flat management fee (₦)')}
          {num('processingFeeThreshold', 'Flat fee up to (₦)')}
          {num('loanProcessingFeeRate', 'Management fee above that, of the loan')}
          {num('loanTransactionFee', 'Transaction fee on every loan (₦)')}
        </Grid>
        <p className="mb-2 mt-5 text-sm font-bold">Flat rate by term</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {rates.map(([m, r]) => (
            <Input
              key={m}
              label={`${m} month${m === '1' ? '' : 's'}`}
              type="number"
              step="0.01"
              suffix="%"
              disabled={!editable}
              value={String(Math.round(r * 10000) / 100)}
              onChange={(e) => setDraft({ ...draft, loanRates: { ...draft.loanRates, [m]: Number(e.target.value) / 100 } })}
            />
          ))}
        </div>
      </Group>

      <Group title="Wallet and circles">
        <Grid>
          {num('minDepositAmount', 'Smallest pay-in (₦)')}
          {num('minWithdrawalAmount', 'Smallest withdrawal (₦)')}
          {num('minCircleContribution', 'Smallest circle contribution (₦)')}
          {num('minCircleMembers', 'Fewest circle members')}
          {num('maxCircleMembers', 'Most circle members')}
        </Grid>
      </Group>

      <Group title="Security">
        <Grid>
          {num('maxPasscodeAttempts', 'Passcode attempts before sign-out')}
          {num('lockTimeoutMinutes', 'Lock after idle (minutes)')}
          {num('otpResendSeconds', 'Wait before resending a code (seconds)')}
        </Grid>
      </Group>

      <Announce open={announcing} onClose={() => setAnnouncing(false)} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {children}
    </Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Announce({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { busy, run } = useAction();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const send = async () => {
    const r = await run(() => adminApi.announce(title.trim(), body.trim()), (x) => `Sent to ${x.devices} device${x.devices === 1 ? '' : 's'}`);
    if (r) {
      setTitle('');
      setBody('');
      onClose();
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Announce to every customer"
      description="Goes to every customer as a notification, and to their phones."
      footer={
        <Button block loading={busy} disabled={title.trim().length < 3 || body.trim().length < 3} onClick={() => void send()}>
          Send to everyone
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Message" value={body} maxLength={500} rows={4} onChange={(e) => setBody(e.target.value)} />
      </div>
    </Modal>
  );
}
