import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, ShieldCheck, UserPlus, X } from 'lucide-react';
import { officersApi } from '../../lib/api/endpoints';
import { cn } from '../../lib/cn';
import { asDay } from '../../lib/format';
import { can } from '../../lib/labels';
import { useSession } from '../../state/session';
import { useAction } from '../../hooks/useAction';
import { Pill } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Card, SectionHeader } from '../ui/Card';
import { Checkbox } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Skeleton } from '../ui/Spinner';

type Target = { customerId: string } | { importId: string };

const keyOf = (t: Target) => ['admin', 'officers', 'customerId' in t ? `c:${t.customerId}` : `i:${t.importId}`] as const;

/**
 * A borrower's loan officers: at least one, as many as needed, one leading.
 * Works for a customer with an account and for a paper loan whose borrower
 * has not signed up yet.
 */
export function OfficersPanel({ target }: { target: Target }) {
  const { adminRole, stage, isAdmin } = useSession();
  const canAct = can.actOnLoans(adminRole);
  const qc = useQueryClient();
  const { busy, run } = useAction();
  const [adding, setAdding] = useState(false);
  const list = useQuery({
    queryKey: keyOf(target),
    queryFn: () => ('customerId' in target ? officersApi.forCustomer(target.customerId) : officersApi.forImport(target.importId)),
    enabled: stage === 'unlocked' && isAdmin,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: keyOf(target) });
  const officers = list.data ?? [];

  return (
    <Card>
      <SectionHeader title={officers.length > 1 ? 'Loan officers' : 'Loan officer'} action={canAct ? 'Add' : undefined} onAction={() => setAdding(true)} />
      {list.isLoading ? (
        <Skeleton className="h-14 w-full" />
      ) : officers.length ? (
        <ul className="space-y-2">
          {officers.map((o) => (
            <li key={o.id} className={cn('flex items-center gap-3 rounded-xl border p-3', o.lead ? 'border-gold/40 bg-gold/[0.05]' : 'border-stroke')}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                {o.lead ? <Crown className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {o.name} {o.lead && <Pill className="ml-1">Lead</Pill>} {!o.stillOnTeam && <Pill tone="danger" className="ml-1">Left the team</Pill>}
                </p>
                <p className="truncate text-[12px] text-ink-3">
                  {o.email}
                  {o.phone ? ` · ${o.phone}` : ''} · since {asDay(o.assignedAt)}
                </p>
              </div>
              {canAct && !o.lead && (
                <Button size="sm" variant="subtle" disabled={busy} onClick={() => void run(async () => {
                  await officersApi.makeLead(o.id);
                  await refresh();
                }, `${o.name.split(' ')[0]} now leads`)}>
                  Make lead
                </Button>
              )}
              {canAct && officers.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${o.name}`}
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await officersApi.remove(o.id);
                    await refresh();
                  }, 'Officer removed')}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-danger/10 hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">No loan officer yet. One is assigned automatically when a loan is approved or entered.</p>
      )}
      {officers.length === 1 && <p className="mt-2 text-[11.5px] text-ink-3">Every borrower keeps at least one officer.</p>}
      <AddOfficers open={adding} onClose={() => setAdding(false)} target={target} existing={officers.map((o) => o.officerId)} onDone={refresh} />
    </Card>
  );
}

function AddOfficers({
  open,
  onClose,
  target,
  existing,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  target: Target;
  existing: string[];
  onDone: () => Promise<unknown>;
}) {
  const options = useOfficerOptions(open);
  const { busy, run } = useAction();
  const [picked, setPicked] = useState<string[]>([]);
  const [lead, setLead] = useState(false);
  const available = (options.data ?? []).filter((o) => !existing.includes(o.id));

  const save = async () => {
    const ok = await run(async () => {
      if ('customerId' in target) await officersApi.assignToCustomer(target.customerId, picked, lead);
      else await officersApi.assignToImport(target.importId, picked, lead);
      await onDone();
      return true;
    }, picked.length > 1 ? 'Officers added' : 'Officer added');
    if (ok) {
      setPicked([]);
      setLead(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add loan officers"
      description="Anyone on the team who can act on loans."
      footer={
        <Button block loading={busy} disabled={!picked.length} icon={<UserPlus className="h-4 w-4" />} onClick={() => void save()}>
          Add {picked.length || ''}
        </Button>
      }
    >
      <OfficerChecklist options={available} picked={picked} onChange={setPicked} loading={options.isLoading} />
      {picked.length > 0 && (
        <div className="mt-4">
          <Checkbox checked={lead} onChange={setLead}>
            Make {available.find((o) => o.id === picked[0])?.name ?? 'the first one'} the lead
          </Checkbox>
        </div>
      )}
    </Modal>
  );
}

export function useOfficerOptions(enabled = true) {
  const { stage, isAdmin } = useSession();
  return useQuery({ queryKey: ['admin', 'officer-options'], queryFn: officersApi.options, enabled: enabled && stage === 'unlocked' && isAdmin });
}

/** Pick one or more officers; the first picked is listed first. */
export function OfficerChecklist({
  options,
  picked,
  onChange,
  loading,
}: {
  options: { id: string; name: string; email: string; roleLabel: string; borrowers: number }[];
  picked: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!options.length) return <p className="text-[13px] text-ink-3">Everyone who can be an officer is already on this borrower.</p>;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto">
      {options.map((o) => {
        const index = picked.indexOf(o.id);
        return (
          <li key={o.id}>
            <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition', index >= 0 ? 'border-gold/50 bg-gold/[0.06]' : 'border-stroke hover:border-gold/30')}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(var(--gold))]"
                checked={index >= 0}
                onChange={(e) => onChange(e.target.checked ? [...picked, o.id] : picked.filter((p) => p !== o.id))}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {o.name} {index === 0 && picked.length > 1 && <Pill className="ml-1">First</Pill>}
                </p>
                <p className="truncate text-[12px] text-ink-3">
                  {o.roleLabel} · {o.borrowers} borrower{o.borrowers === 1 ? '' : 's'}
                </p>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
