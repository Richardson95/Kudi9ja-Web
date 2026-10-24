import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { OfficerPicker } from '../../components/admin/OfficerPicker';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, Pill } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys } from '../../hooks/queries';
import { groupsApi } from '../../lib/api/endpoints';
import { formatNumber, naira } from '../../lib/format';
import { useSession } from '../../state/session';

const groupKeys = { list: keys.admin.groups };

export default function Groups() {
  const { adminRole, stage, isAdmin } = useSession();
  const list = useQuery({ queryKey: groupKeys.list, queryFn: groupsApi.list, enabled: stage === 'unlocked' && isAdmin });
  const [creating, setCreating] = useState(false);
  const groups = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan groups"
        subtitle="Group 1, Group 2, … each named for its market or area and run by one loan officer."
        actions={
          adminRole && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Open a group
            </Button>
          )
        }
      />

      {list.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : groups.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/admin/groups/${g.id}`}
              className="flex flex-col rounded-2xl border border-stroke bg-surface p-5 transition hover:-translate-y-px hover:border-gold/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl gold-gradient text-lg font-extrabold text-on-gold">{g.number}</span>
                  <div className="min-w-0">
                    <p className="eyebrow text-ink-3">Group {g.number}</p>
                    <p className="truncate font-extrabold">{g.name}</p>
                  </div>
                </div>
                {!g.active && <Pill tone="neutral">Closed</Pill>}
              </div>
              {g.area && (
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                  <MapPin className="h-3.5 w-3.5" /> {g.area}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-2">
                <ShieldCheck className="h-3.5 w-3.5 text-gold" /> {g.officerName}
                {!g.officerStillOnTeam && <Pill tone="danger" className="ml-1">Left the team</Pill>}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Figure label="Members" value={String(g.members)} />
                <Figure label="Lent" value={naira(g.totalLent)} />
                <Figure label="Owed" value={naira(g.outstanding)} />
              </div>
              <p className="mt-3 text-[11.5px] text-ink-3">
                {formatNumber(g.signedUp)} of {formatNumber(g.members)} signed up{g.overdueMembers ? ` · ${formatNumber(g.overdueMembers)} overdue` : ''}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<UsersRound />}
            title="No groups yet"
            message="Open Group 1, name it for its market or area, and choose its loan officer. Then add its borrowers with all their details."
            action={adminRole ? <Button onClick={() => setCreating(true)}>Open a group</Button> : undefined}
          />
        </Card>
      )}

      <NewGroup open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-alt/50 py-2">
      <p className="num text-sm font-extrabold">{value}</p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

function NewGroup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [officerId, setOfficerId] = useState('');

  useEffect(() => {
    if (!open) return;
    groupsApi.nextNumber().then((r) => setNumber(String(r.number))).catch(() => undefined);
  }, [open]);

  const create = async () => {
    const created = await run(
      () => groupsApi.create({ number: Number(number) || undefined, name: name.trim(), area: area.trim() || undefined, description: description.trim() || undefined, officerId }),
      (d) => `Group ${d.group.number} opened`,
    );
    if (created) {
      await qc.invalidateQueries({ queryKey: groupKeys.list });
      setName('');
      setArea('');
      setDescription('');
      setOfficerId('');
      onClose();
      navigate(`/admin/groups/${created.group.id}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      locked={busy}
      title="Open a loan group"
      footer={
        <Button block loading={busy} disabled={!name.trim() || !officerId || !(Number(number) > 0)} onClick={() => void create()}>
          Open Group {number || '…'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Input label="Group number" type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} />
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oja Oba market traders" maxLength={120} />
        </div>
        <Input label="Area or market (optional)" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Akure, Ondo State" maxLength={200} />
        <Textarea label="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} />
        <div>
          <p className="mb-2 text-[13px] font-semibold">Loan officer for this group</p>
          <OfficerPicker value={officerId} onChange={setOfficerId} />
          <p className="mt-2 text-[12px] text-ink-3">They run the group: adding borrowers and their details. Every borrower in it gets them as lead loan officer.</p>
        </div>
      </div>
    </Modal>
  );
}
