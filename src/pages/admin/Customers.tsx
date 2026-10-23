import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, Users, UsersRound } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, EmptyState, Pill, Segmented } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Spinner';
import { keys, useCustomers, useImportedLoans } from '../../hooks/queries';
import { groupsApi } from '../../lib/api/endpoints';
import { asDay, maskLast4, naira, relative } from '../../lib/format';
import { accountTone, can } from '../../lib/labels';
import { useSession } from '../../state/session';
import type { AccountStatus, GroupLabel } from '../../types/api';

type Show = 'everyone' | 'accounts' | 'offline';

/** One row, whether the person has an account yet or not. */
interface Row {
  key: string;
  to: string;
  name: string;
  contact: string;
  account: string | null;
  signedUp: boolean;
  status?: { label: string; tone: ReturnType<typeof accountTone> };
  money: { label: string; value: number };
  when: string;
  groups: GroupLabel[];
}

/**
 * Everyone Kudi9ja lends to or holds money for, in one list: customers with an
 * account, and borrowers entered by hand who have not signed up yet. Group
 * members are labelled with their group; clicking anyone opens everything
 * about them.
 */
export default function Customers() {
  const [show, setShow] = useState<Show>('everyone');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AccountStatus | 'ALL'>('ALL');
  const [group, setGroup] = useState('');
  const { adminRole, stage, isAdmin } = useSession();
  // "Not signed up yet" means accounts the team opened that are not activated.
  const customers = useCustomers(query.trim(), show === 'offline' ? 'PENDING_ACTIVATION' : status === 'ALL' ? undefined : status);
  const notActivated = useCustomers('', 'PENDING_ACTIVATION');
  const imports = useImportedLoans();
  const labels = useQuery({ queryKey: [...keys.admin.groups, 'labels'], queryFn: groupsApi.labels, enabled: stage === 'unlocked' && isAdmin });
  const groupList = useQuery({ queryKey: keys.admin.groups, queryFn: groupsApi.list, enabled: stage === 'unlocked' && isAdmin });

  const waiting = useMemo(() => (imports.data ?? []).filter((l) => !l.claimed), [imports.data]);

  const rows = useMemo(() => {
    const byCustomer = new Map<string, GroupLabel[]>();
    const byImport = new Map<string, GroupLabel[]>();
    for (const l of labels.data ?? []) {
      if (l.customerId) byCustomer.set(l.customerId, [...(byCustomer.get(l.customerId) ?? []), l]);
      else if (l.importedLoanId) byImport.set(l.importedLoanId, [...(byImport.get(l.importedLoanId) ?? []), l]);
    }
    const q = query.trim().toLowerCase();
    const out: Row[] = [];
    {
      for (const c of customers.data?.items ?? []) {
        if (show === 'accounts' && c.accountStatus === 'PENDING_ACTIVATION') continue;
        out.push({
          key: `c-${c.id}`,
          to: `/admin/customers/${c.id}`,
          name: c.fullName,
          contact: c.email ?? c.phone ?? 'No email or phone yet',
          account: c.customerRef,
          signedUp: true,
          status: { label: c.accountStatusLabel, tone: accountTone(c.accountStatus) },
          money: { label: 'Balance', value: c.balance },
          when: c.accountStatus === 'PENDING_ACTIVATION' ? 'Waiting for them to sign up' : c.lastActiveAt ? `Active ${relative(c.lastActiveAt)}` : 'Not active yet',
          groups: byCustomer.get(c.id) ?? [],
        });
      }
    }
    // Account-status filters only make sense for people with accounts.
    if (show !== 'accounts' && status === 'ALL') {
      for (const l of waiting) {
        const matches = !q || l.fullName.toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q) || (l.phone ?? '').includes(q);
        if (!matches) continue;
        out.push({
          key: `i-${l.id}`,
          to: `/admin/lending/offline/${l.id}`,
          name: l.fullName,
          contact: l.email ?? l.phone ?? `BVN ${maskLast4(l.bvnLast4)}`,
          account: null,
          signedUp: false,
          money: { label: 'Owes', value: l.outstanding },
          when: l.dueDate ? `Due ${asDay(l.dueDate)}` : '',
          groups: byImport.get(l.id) ?? [],
        });
      }
    }
    const filtered = group ? out.filter((r) => r.groups.some((g) => g.groupId === group)) : out;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers.data, waiting, labels.data, show, status, query, group]);

  const loading = customers.isLoading || imports.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${notActivated.data?.totalItems ?? 0} not activated yet — opened by the team, waiting for the customer to sign up`}
        actions={
          can.actOnLoans(adminRole) && (
            <Button to="/admin/lending/offline/new" icon={<UserPlus className="h-4 w-4" />}>
              Add loan customer
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Show>
          value={show}
          onChange={setShow}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'accounts', label: 'Activated' },
            { value: 'offline', label: 'Not activated yet', count: (notActivated.data?.totalItems ?? 0) + waiting.length },
          ]}
        />
        <Input
          wrapperClassName="min-w-[220px] flex-1"
          placeholder="Name, email, phone or account number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
        {(groupList.data?.length ?? 0) > 0 && (
          <Select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            options={[{ value: '', label: 'All groups' }, ...(groupList.data ?? []).map((g) => ({ value: g.id, label: `Group ${g.number} — ${g.name}` }))]}
            icon={<UsersRound className="h-4 w-4" />}
          />
        )}
      </div>
      {show !== 'offline' && (
        <Segmented<AccountStatus | 'ALL'>
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'Any status' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'FLAGGED', label: 'Flagged' },
            { value: 'FROZEN', label: 'Frozen' },
            { value: 'DORMANT', label: 'Dormant' },
            { value: 'CLOSED', label: 'Closed' },
            { value: 'PENDING_ACTIVATION', label: 'Not activated' },
          ]}
        />
      )}

      <Card padded={false} className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length ? (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-stroke text-[12px] uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Group</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Money</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {rows.map((r) => (
                <tr key={r.key} className="transition hover:bg-surface-alt/50">
                  <td className="px-4 py-3">
                    <Link to={r.to} className="flex items-center gap-3">
                      <Avatar name={r.name} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate font-bold hover:text-gold">{r.name}</span>
                        <span className="block truncate text-[12px] text-ink-3">{r.contact}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {r.account ? <span className="font-mono text-[12.5px] text-gold">{r.account}</span> : <Pill tone="info">Not signed up</Pill>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.groups.length
                        ? r.groups.map((g) => (
                            <Link key={g.groupId} to={`/admin/groups/${g.groupId}`} title={g.name}>
                              <Pill tone="gold">
                                Group {g.number} — {g.name}
                              </Pill>
                            </Link>
                          ))
                        : <span className="text-[12px] text-ink-3">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.status ? <Pill tone={r.status.tone}>{r.status.label}</Pill> : <span className="text-[12px] text-ink-3">Loan on file</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="num block font-bold">{naira(r.money.value)}</span>
                    <span className="text-[11.5px] text-ink-3">{r.money.label}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-3">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon={show === 'offline' ? <UserPlus /> : <Users />}
            title="Nobody matches"
            message={show === 'offline' ? 'Loans entered for people without an account appear here until they sign up.' : undefined}
          />
        )}
      </Card>
    </div>
  );
}
