import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, ShieldCheck, UserPlus, UserRoundPlus, UsersRound, X } from 'lucide-react';
import { OfficerPicker } from '../../components/admin/OfficerPicker';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, EmptyState, Notice, Pill, StatTile, Switch } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Input, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys } from '../../hooks/queries';

const groupKeys = { list: keys.admin.groups, detail: keys.admin.group };
import { groupsApi } from '../../lib/api/endpoints';
import { asDay, formatNumber, naira } from '../../lib/format';
import { useSession } from '../../state/session';
import type { LoanGroup } from '../../types/api';

export default function GroupDetail() {
  const { id = '' } = useParams();
  const { stage, isAdmin } = useSession();
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { busy, run } = useAction();
  const detail = useQuery({ queryKey: groupKeys.detail(id), queryFn: () => groupsApi.detail(id), enabled: stage === 'unlocked' && isAdmin && !!id });
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  if (detail.isLoading) return <PageSpinner />;
  if (!detail.data) return <EmptyState icon={<UsersRound />} title="Group not found" action={<Button to="/admin/groups">Back</Button>} />;
  const { group: g, members } = detail.data;
  const put = (d: typeof detail.data) => {
    qc.setQueryData(groupKeys.detail(id), d);
    void qc.invalidateQueries({ queryKey: groupKeys.list });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back="/admin/groups"
        backLabel="Loan groups"
        eyebrow={`Group ${g.number}`}
        title={g.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {g.area && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {g.area}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Loan officer: <b className="text-ink">{g.officerName}</b>
            </span>
            <span>Opened {asDay(g.createdAt)}</span>
          </span>
        }
        actions={
          g.canManage && (
            <>
              <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit group
              </Button>
              {g.active && (
                <>
                  <Button variant="ghost" icon={<UserRoundPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                    Add existing customer
                  </Button>
                  <Button to={`/admin/lending/offline/new?group=${g.id}`} icon={<UserPlus className="h-4 w-4" />}>
                    Add borrower
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {!g.canManage && (
        <Notice tone="info">This group is run by {g.officerName}. Only they, an owner or an administrator can add or change its borrowers.</Notice>
      )}
      {!g.active && <Notice tone="neutral">This group is closed to new borrowers. Its loans carry on as normal.</Notice>}
      {g.description && <p className="text-[13.5px] text-ink-2">{g.description}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Members" value={formatNumber(g.members)} footnote={`${formatNumber(g.signedUp)} signed up`} />
        <StatTile label="Lent" value={naira(g.totalLent)} tone="info" />
        <StatTile label="Still owed" value={naira(g.outstanding)} />
        <StatTile label="Overdue" value={formatNumber(g.overdueMembers)} tone={g.overdueMembers ? 'danger' : 'neutral'} footnote="members" />
      </div>

      <Card padded={false} className="overflow-x-auto">
        {members.length ? (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-stroke text-[12px] uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Borrower</th>
                <th className="px-4 py-3 text-right font-semibold">Lent</th>
                <th className="px-4 py-3 text-right font-semibold">Owed</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {members.map((m, i) => (
                <tr key={m.id} className="hover:bg-surface-alt/50">
                  <td className="px-4 py-3 text-ink-3">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={m.customerId ? `/admin/customers/${m.customerId}` : `/admin/lending/offline/${m.importedLoanId}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar name={m.name} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-bold hover:text-gold">{m.name}</span>
                        <span className="block text-[12px] text-ink-3">
                          {m.customerRef ?? 'Not signed up'}
                          {m.phone ? ` · ${m.phone}` : ''}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="num px-4 py-3 text-right">{naira(m.lent)}</td>
                  <td className="num px-4 py-3 text-right font-bold">{naira(m.outstanding)}</td>
                  <td className="px-4 py-3">
                    {m.overdue ? <Pill tone="danger">Overdue</Pill> : <span className="text-[12.5px] text-ink-3">{m.nextDue ? asDay(m.nextDue) : '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-3">
                    {asDay(m.addedAt)}
                    <span className="block">by {m.addedBy}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {g.canManage && (
                      <button
                        type="button"
                        aria-label={`Remove ${m.name} from the group`}
                        disabled={busy}
                        onClick={async () => {
                          const ok = await dialogs.confirm({
                            title: `Take ${m.name} out of Group ${g.number}?`,
                            message: 'Their loan, documents and repayments stay exactly as they are.',
                            confirmLabel: 'Remove from group',
                            danger: true,
                          });
                          if (ok) await run(async () => put(await groupsApi.removeMember(id, m.id)), 'Removed from the group');
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-danger/10 hover:text-danger"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon={<UsersRound />}
            title="No borrowers yet"
            message="Add each borrower with their BVN, phone, address, guarantors and loan — or add someone who already has an account."
            action={g.canManage ? <Button to={`/admin/lending/offline/new?group=${g.id}`}>Add the first borrower</Button> : undefined}
          />
        )}
      </Card>

      {editing && <EditGroup group={g} onClose={() => setEditing(false)} onSaved={put} />}
      <Modal open={adding} onClose={() => setAdding(false)} title={`Add to Group ${g.number}`} description="Someone who already has a Kudi9ja account.">
        <AddExisting groupId={id} onDone={(d) => {
          put(d);
          setAdding(false);
        }} />
      </Modal>
    </div>
  );
}

function AddExisting({ groupId, onDone }: { groupId: string; onDone: (d: Awaited<ReturnType<typeof groupsApi.detail>>) => void }) {
  const { busy, run } = useAction();
  const [ref, setRef] = useState('');
  return (
    <div className="space-y-4">
      <Input label="Their account number" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} autoFocus className="font-mono" />
      <Button
        block
        loading={busy}
        disabled={ref.trim().length < 4}
        onClick={async () => {
          const d = await run(() => groupsApi.addCustomer(groupId, ref.trim()), 'Added to the group');
          if (d) onDone(d);
        }}
      >
        Add to group
      </Button>
      <p className="text-[12px] text-ink-3">Find it on the Customers page. The group&apos;s officer becomes their lead loan officer.</p>
    </div>
  );
}

function EditGroup({ group: g, onClose, onSaved }: { group: LoanGroup; onClose: () => void; onSaved: (d: Awaited<ReturnType<typeof groupsApi.detail>>) => void }) {
  const { busy, run } = useAction();
  const { adminRole } = useSession();
  const [name, setName] = useState(g.name);
  const [area, setArea] = useState(g.area ?? '');
  const [description, setDescription] = useState(g.description ?? '');
  const [officerId, setOfficerId] = useState(g.officerId);
  const [active, setActive] = useState(g.active);
  const save = async () => {
    const d = await run(
      () => groupsApi.update(g.id, { name: name.trim(), area, description, active, ...(officerId !== g.officerId ? { officerId } : {}) }),
      officerId !== g.officerId ? 'Saved — the new officer now leads every borrower in the group' : 'Saved',
    );
    if (d) {
      onSaved(d);
      onClose();
    }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={`Edit Group ${g.number}`} footer={<Button block loading={busy} disabled={!name.trim()} onClick={() => void save()}>Save</Button>}>
      <div className="space-y-4">
        <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Input label="Area or market" value={area} onChange={(e) => setArea(e.target.value)} maxLength={200} />
        <Textarea label="Notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} />
        <div className="flex items-center justify-between gap-4 rounded-xl border border-stroke p-3">
          <div>
            <p className="text-sm font-bold">Open to new borrowers</p>
            <p className="text-[12px] text-ink-3">Closing stops new additions; existing loans carry on.</p>
          </div>
          <Switch label="Open" checked={active} onChange={setActive} />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold">Loan officer</p>
          <OfficerPicker value={officerId} onChange={setOfficerId} />
          {officerId !== g.officerId && (
            <p className="mt-2 text-[12px] text-gold">Every borrower in the group will get the new officer as their lead.</p>
          )}
          {adminRole !== 'OWNER' && adminRole !== 'ADMIN' && officerId !== g.officerId && (
            <p className="mt-1 text-[12px] text-ink-3">Handing the group over means you can no longer change it.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
