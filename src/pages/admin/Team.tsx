import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Check, Minus, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, ChoiceTiles, Pill } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys, useTeam } from '../../hooks/queries';
import { adminApi, officersApi } from '../../lib/api/endpoints';
import { asDay, relative } from '../../lib/format';
import { CAPABILITIES, ROLES, can, roleBlurb, roleLabel } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { AdminRole, TeamMember } from '../../types/api';

export default function Team() {
  const team = useTeam();
  const { adminRole } = useSession();
  const manage = can.manageTeam(adminRole);
  const [granting, setGranting] = useState(false);
  const [book, setBook] = useState<TeamMember | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle="Who has the panel, what each role can do, and whose borrowers are whose."
        actions={manage && <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setGranting(true)}>Add to team</Button>}
      />

      <Card padded={false}>
        {team.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : (
          <ul className="divide-y divide-stroke">
            {(team.data ?? []).map((m) => (
              <MemberRow key={m.id} m={m} manage={manage} onBook={() => setBook(m)} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <SectionHeader title="What each role can do" />
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-[12px] text-ink-3">
              <th className="py-2 text-left font-semibold" />
              {ROLES.map((r) => (
                <th key={r} className="py-2 font-semibold">{roleLabel(r)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {CAPABILITIES.map((c) => (
              <tr key={c.label}>
                <td className="py-2.5 pr-4">{c.label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="py-2.5 text-center">
                    {c.held(r) ? <Check className="mx-auto h-4 w-4 text-success" /> : <Minus className="mx-auto h-4 w-4 text-ink-3" />}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-2.5 pr-4">Open loan groups, and be a loan officer</td>
              {ROLES.map((r) => (
                <td key={r} className="py-2.5 text-center">
                  <Check className="mx-auto h-4 w-4 text-success" />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>

      <Grant open={granting} onClose={() => setGranting(false)} />
      {book && <OfficerBook member={book} onClose={() => setBook(null)} />}
    </div>
  );
}

function MemberRow({ m, manage, onBook }: { m: TeamMember; manage: boolean; onBook: () => void }) {
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { busy, run } = useAction();
  const editable = manage && m.canBeEdited && !m.isMe;
  const done = () => qc.invalidateQueries({ queryKey: keys.admin.team });

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <Avatar name={m.name} size={40} />
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-bold">
          {m.name} {m.isMe && <span className="text-ink-3">(you)</span>} {!m.active && <Pill tone="danger" className="ml-1">Suspended</Pill>}
        </p>
        <p className="text-[12.5px] text-ink-3">
          {m.email} · added {asDay(m.addedAt)}
          {m.addedBy ? ` by ${m.addedBy}` : ''} · {m.lastActiveAt ? `active ${relative(m.lastActiveAt)}` : 'not active yet'}
        </p>
      </div>
      {m.active && (
        <Button size="sm" variant="subtle" icon={<Briefcase className="h-4 w-4" />} onClick={onBook}>
          Borrowers
        </Button>
      )}
      {editable ? (
        <Select
          value={m.role}
          onChange={(e) =>
            void run(async () => {
              await adminApi.changeRole(m.id, e.target.value as AdminRole);
              await done();
            }, 'Role changed')
          }
          options={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
        />
      ) : (
        <Pill tone={m.role === 'OWNER' ? 'gold' : 'info'}>{m.roleLabel}</Pill>
      )}
      {editable && (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              const reason = m.active
                ? await dialogs.reason({ title: `Suspend ${m.name}?`, message: 'They lose the panel until restored. Their own account is unaffected.', confirmLabel: 'Suspend', danger: true })
                : '';
              if (reason === null) return;
              await run(async () => {
                await adminApi.setActive(m.id, !m.active, reason || undefined);
                await done();
              }, m.active ? 'Suspended' : 'Restored');
            }}
          >
            {m.active ? 'Suspend' : 'Restore'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              const ok = await dialogs.confirm({
                title: `Remove ${m.name} from the team?`,
                message: 'They lose the panel. If any borrower has them as their only loan officer, give that borrower another officer first.',
                confirmLabel: 'Remove',
                danger: true,
              });
              if (ok) await run(async () => {
                await adminApi.revoke(m.id);
                await done();
              }, 'Removed from the team');
            }}
          >
            Remove
          </Button>
        </>
      )}
    </li>
  );
}

function OfficerBook({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const book = useQuery({ queryKey: ['admin', 'officer-book', member.id], queryFn: () => officersApi.book(member.id) });
  return (
    <Modal open onClose={onClose} size="lg" title={`${member.name}'s borrowers`} description="Lead first in each borrower's list; these are all the borrowers they look after.">
      {book.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : book.data?.length ? (
        <ul className="divide-y divide-stroke">
          {book.data.map((b) => (
            <li key={b.assignmentId}>
              <Link
                to={b.customerId ? `/admin/customers/${b.customerId}` : `/admin/lending/offline/${b.importedLoanId}`}
                onClick={onClose}
                className="flex items-center gap-3 py-3 hover:text-gold"
              >
                <Avatar name={b.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{b.name}</span>
                  <span className="text-[12px] text-ink-3">
                    {b.customerRef ?? 'Not signed up'} · since {asDay(b.assignedAt)}
                  </span>
                </span>
                {b.lead && <Pill>Lead</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">No borrowers yet.</p>
      )}
    </Modal>
  );
}

function Grant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { busy, run } = useAction();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('SUPPORT');
  const grant = async () => {
    const ok = await run(async () => {
      await adminApi.grant(email.trim(), role);
      await qc.invalidateQueries({ queryKey: keys.admin.team });
      return true;
    }, 'Added to the team');
    if (ok) {
      setEmail('');
      onClose();
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to the team"
      description="They need a Kudi9ja account first. They see the panel the next time they sign in."
      footer={<Button block loading={busy} disabled={!/.+@.+\..+/.test(email)} onClick={() => void grant()}>Give access</Button>}
    >
      <div className="space-y-4">
        <Input label="Their account email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <ChoiceTiles<AdminRole>
          columns={2}
          value={role}
          onChange={setRole}
          options={ROLES.filter((r) => r !== 'OWNER').map((r) => ({ value: r, label: roleLabel(r), sub: roleBlurb(r) }))}
        />
      </div>
    </Modal>
  );
}
