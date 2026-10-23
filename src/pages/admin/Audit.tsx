import { useState } from 'react';
import { History, Search } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, IconBadge, Segmented } from '../../components/ui/Bits';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Spinner';
import { useAudit } from '../../hooks/queries';
import { asDayTime } from '../../lib/format';
import { auditStyle } from '../../lib/labels';
import type { AuditCategory } from '../../types/api';

const CATEGORIES: (AuditCategory | 'ALL')[] = ['ALL', 'CUSTOMER', 'LOAN', 'COMPLIANCE', 'SETTINGS', 'TEAM', 'DATA_ACCESS', 'GENERAL'];

/** Everything the team did, and everything the system did on its own. Append-only. */
export default function Audit() {
  const [category, setCategory] = useState<AuditCategory | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const log = useAudit(category, query.trim());

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" subtitle="Every action on the panel and every automatic one, as it happened. Nothing here can be edited." />
      <div className="flex flex-wrap items-center gap-3">
        <Input wrapperClassName="min-w-[240px] flex-1" placeholder="Search actions, people or references" value={query} onChange={(e) => setQuery(e.target.value)} icon={<Search className="h-4 w-4" />} />
      </div>
      <Segmented<AuditCategory | 'ALL'>
        size="sm"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: c === 'ALL' ? 'All' : auditStyle[c].label }))}
      />
      <Card padded={false}>
        {log.isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : log.data?.items.length ? (
          <ul className="divide-y divide-stroke">
            {log.data.items.map((a) => {
              const st = auditStyle[a.category];
              const Icon = st.icon;
              return (
                <li key={a.id} className="flex gap-3 px-4 py-3">
                  <IconBadge size={34} tone={st.tone}>
                    <Icon />
                  </IconBadge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.action}</p>
                    <p className="break-words text-[12.5px] text-ink-2">{a.detail}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">
                      {a.actor} · {asDayTime(a.date)} · {a.categoryLabel}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<History />} title="Nothing matches" />
        )}
      </Card>
    </div>
  );
}
