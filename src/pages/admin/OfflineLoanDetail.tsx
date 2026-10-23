import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, FilePlus2, HandCoins, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { DocumentGrid } from '../../components/admin/Documents';
import { OfficersPanel } from '../../components/admin/OfficersPanel';
import { RecordRepayment } from '../../components/admin/RecordRepayment';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, Notice, Pill, ProgressBar } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, DetailRows, SectionHeader } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { useAction } from '../../hooks/useAction';
import { keys, useImportedLoanFile, useRefresh } from '../../hooks/queries';
import { adminApi, groupsApi } from '../../lib/api/endpoints';
import { buildSchedule, termPhrase } from '../../lib/finance';
import { asDay, formatAmountInput, maskLast4, naira, parseAmount } from '../../lib/format';
import { can, instalmentLabel, instalmentTone } from '../../lib/labels';
import { GENDERS, NIGERIAN_STATES } from '../../lib/validators';
import { useSession } from '../../state/session';
import type { ImportedLoan, OfflineLoanUpdate } from '../../types/api';

const DOC_LABELS = ['Loan agreement', 'Bank statement', 'ID card', 'Passport photo', 'Utility bill', 'Business photo', 'Guarantor form', 'Receipt', 'Other'];

export default function OfflineLoanDetail() {
  const { id = '' } = useParams();
  const file = useImportedLoanFile(id);
  const labels = useQuery({ queryKey: [...keys.admin.groups, 'labels'], queryFn: groupsApi.labels });
  const groups = (labels.data ?? []).filter((g) => g.importedLoanId === id);
  const ownerId = file.data?.loan.customerId;
  const owner = useQuery({ queryKey: keys.admin.customer(ownerId ?? ''), queryFn: () => adminApi.customer(ownerId!), enabled: !!ownerId });
  const { adminRole } = useSession();
  const qc = useQueryClient();
  const refresh = useRefresh();
  const dialogs = useDialogs();
  const toast = useToast();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [docLabel, setDocLabel] = useState(DOC_LABELS[0]!);
  const [uploading, setUploading] = useState(false);

  if (file.isLoading) return <PageSpinner />;
  if (!file.data) return <EmptyState icon={<NotebookPen />} title="Loan file not found" action={<Button to="/admin/lending">Back</Button>} />;
  const { loan: l, documents, repayments } = file.data;
  const act = can.actOnLoans(adminRole);
  // On an account the customer has taken over, their details are theirs; until then the team can still correct them.
  const activated = l.claimed && !!owner.data && owner.data.accountStatus !== 'PENDING_ACTIVATION';
  const reload = () => qc.invalidateQueries({ queryKey: keys.admin.importFile(id) });
  const schedule = l.disbursedAt ? buildSchedule(l.principal, l.flatRate, l.tenureMonths, new Date(l.disbursedAt), l.amountRepaid, undefined, l.repaymentFrequency) : [];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 12 * 1024 * 1024) {
          toast.error(`${f.name} is over 12MB.`);
          continue;
        }
        await adminApi.attachToImport(id, f, docLabel);
      }
      toast.success('Added to the file');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    const ok = await dialogs.confirm({
      title: 'Delete this loan file?',
      message: 'Only for a loan entered by mistake, before anything has been repaid. The account opened for it goes too if this was all that was on it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok && (await run(() => adminApi.deleteImportedLoan(id), 'Deleted'))) {
      await refresh.admin();
      navigate('/admin/lending', { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back="/admin/customers"
        backLabel="Customers"
        eyebrow="Offline loan"
        title={l.fullName}
        subtitle={`${naira(l.principal)} · ${termPhrase(l.tenureMonths, l.repaymentFrequency)} · ${l.purpose}`}
        actions={
          <>
            <Pill tone={activated ? 'success' : 'info'}>{activated ? 'Signed up' : 'Not activated yet'}</Pill>
            {act && (
              <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {act && !activated && (
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} disabled={busy} onClick={() => void remove()}>
                Delete
              </Button>
            )}
          </>
        }
      />

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          In
          {groups.map((g) => (
            <Link key={g.groupId} to={`/admin/groups/${g.groupId}`}>
              <Pill tone="gold">Group {g.number} — {g.name}</Pill>
            </Link>
          ))}
        </div>
      )}

      {l.customerId && !activated && (
        <Notice tone="info" title={`Account ${owner.data?.customerRef ?? ''} — not activated yet`}>
          {l.fullName} is a customer now, with this loan on their account. They take the account over by signing up with their BVN; until
          then you can correct their details here, BVN included.{' '}
          <Link to={`/admin/customers/${l.customerId}`} className="font-bold underline">Open their profile</Link>
        </Notice>
      )}

      {activated && l.customerId && (
        <Notice tone="success" icon={<BadgeCheck className="h-5 w-5" />} title="This borrower has signed up">
          The loan is on their account now{l.claimedAt ? ` (since ${asDay(l.claimedAt)})` : ''}, and so are this file and its officers.{' '}
          <Link to={`/admin/customers/${l.customerId}`} className="font-bold underline">Open their profile</Link>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader title="Repayment" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[13px] text-ink-3">Outstanding</p>
              <p className="num text-3xl font-extrabold">{naira(l.outstanding)}</p>
              <p className="text-[12.5px] text-ink-3">
                {naira(l.amountRepaid)} of {naira(l.totalRepayable)} repaid · due by {asDay(l.dueDate)}
              </p>
            </div>
            {act && l.outstanding > 0 && (
              <Button icon={<HandCoins className="h-4 w-4" />} onClick={() => setRecording(true)}>
                Record a repayment
              </Button>
            )}
          </div>
          <ProgressBar className="mt-4" value={l.totalRepayable ? l.amountRepaid / l.totalRepayable : 0} />
          {schedule.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {schedule.map((s) => (
                <li key={s.number} className="flex items-center justify-between rounded-xl border border-stroke px-3 py-2 text-[12.5px]">
                  <span>
                    <b>#{s.number}</b> {asDay(s.dueDate)}
                  </span>
                  <Pill tone={instalmentTone(s.status)}>{instalmentLabel(s.status)}</Pill>
                </li>
              ))}
            </ul>
          )}
          {repayments.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-[13px] font-bold">Recorded repayments</p>
              <ul className="divide-y divide-stroke rounded-xl border border-stroke">
                {repayments.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                    <span>
                      {asDay(r.paidAt)} · {r.method.replace('_', ' ').toLowerCase()}
                      {r.reference ? ` · ${r.reference}` : ''}
                      <span className="block text-[11.5px] text-ink-3">by {r.recordedBy ?? 'the team'}{r.note ? ` · ${r.note}` : ''}</span>
                    </span>
                    <span className="num font-bold text-success">{naira(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <OfficersPanel target={l.customerId ? { customerId: l.customerId } : { importId: id }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Borrower" />
          <DetailRows
            rows={[
              ['BVN', maskLast4(l.bvnLast4)],
              ['NIN', maskLast4(l.ninLast4)],
              ['Email', l.email ?? '—'],
              ['Phone', l.phone ?? '—'],
              ['Date of birth', l.dateOfBirth ? asDay(l.dateOfBirth) : '—'],
              ['Gender', l.gender ?? '—'],
              ['Address', [l.address, l.state].filter(Boolean).join(', ') || '—'],
              ['Occupation', l.occupation ?? '—'],
              ['Payout account', l.payoutBank ? `${l.payoutBank} · ${l.payoutAccountNumber ?? ''}` : '—'],
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="Business and loan" />
          <DetailRows
            rows={[
              ['Business', l.businessName ?? '—'],
              ['Business address', l.businessAddress ?? '—'],
              ['Monthly income', l.monthlyIncome ? naira(l.monthlyIncome) : '—'],
              ['Lent', naira(l.principal)],
              ['Flat rate', `${Math.round(l.flatRate * 10000) / 100}%`],
              ['Management fee', naira(l.processingFee)],
              ['Transaction fee', naira(l.transactionFee ?? 0)],
              { label: 'Paid out to the borrower', value: naira(l.netDisbursed ?? l.principal - l.processingFee), tone: 'gold' },
              ['Paid out on', asDay(l.disbursedAt)],
              ['Entered by', `${l.importedBy ?? '—'}${l.importedAt ? ` · ${asDay(l.importedAt)}` : ''}`],
            ]}
          />
          {l.notes && <p className="mt-4 rounded-xl bg-surface-alt/60 p-3 text-[13px] text-ink-2">{l.notes}</p>}
        </Card>
      </div>

      {(l.guarantors?.length ?? 0) > 0 && (
        <Card>
          <SectionHeader title="Guarantors" />
          <div className="grid gap-4 md:grid-cols-2">
            {l.guarantors!.map((g, i) => (
              <DetailRows
                key={i}
                className="rounded-xl border border-stroke p-4"
                rows={[
                  ['Name', g.fullName],
                  g.relationship ? ['Relationship', g.relationship] : null,
                  g.phone ? ['Phone', g.phone] : null,
                  g.bvn ? ['BVN', g.bvn] : null,
                  g.address ? ['Address', [g.address, g.localGovernment, g.state].filter(Boolean).join(', ')] : null,
                  g.landmark ? ['Landmark', g.landmark] : null,
                  g.occupation ? ['Occupation', g.occupation] : null,
                  g.email ? ['Email', g.email] : null,
                ]}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[15px] font-extrabold">Documents ({documents.length})</h2>
          {act && (
            <div className="flex flex-wrap items-end gap-2">
              <Select value={docLabel} onChange={(e) => setDocLabel(e.target.value)} options={DOC_LABELS} />
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl gold-gradient px-4 text-sm font-bold text-on-gold">
                <FilePlus2 className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Add files'}
                <input type="file" multiple disabled={uploading} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => {
                  void upload(e.target.files);
                  e.target.value = '';
                }} />
              </label>
            </div>
          )}
        </div>
        <DocumentGrid
          items={documents.map((d) => ({
            key: d.id,
            label: d.label,
            url: d.url,
            contentType: d.contentType,
            sizeBytes: d.sizeBytes,
            note: d.uploadedBy ? `by ${d.uploadedBy}` : undefined,
            date: d.uploadedAt,
            onRemove: act
              ? async () => {
                  const ok = await dialogs.confirm({ title: `Remove “${d.label}”?`, message: 'It is taken off the file.', confirmLabel: 'Remove', danger: true });
                  if (ok && (await run(() => adminApi.removeDocument(d.id), 'Removed'))) await reload();
                }
              : undefined,
          }))}
        />
      </Card>

      <RecordRepayment
        open={recording}
        onClose={() => setRecording(false)}
        outstanding={l.outstanding}
        onSave={async (input) => {
          await adminApi.recordOnImport(id, input);
          await reload();
          await refresh.admin();
        }}
      />
      {editing && (
        <EditFile
          loan={l}
          activated={activated}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await reload();
            if (ownerId) await qc.invalidateQueries({ queryKey: keys.admin.customer(ownerId) });
          }}
        />
      )}
    </div>
  );
}

function EditFile({
  loan: l,
  activated,
  onClose,
  onSaved,
}: {
  loan: ImportedLoan;
  activated: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { busy, run } = useAction();
  const [f, setF] = useState({
    bvn: '', fullName: l.fullName, email: l.email ?? '', phone: l.phone ?? '', dateOfBirth: l.dateOfBirth ?? '', gender: l.gender ?? '',
    address: l.address ?? '', state: l.state ?? '', occupation: l.occupation ?? '', businessName: l.businessName ?? '',
    businessAddress: l.businessAddress ?? '', monthlyIncome: l.monthlyIncome ? formatAmountInput(String(l.monthlyIncome)) : '',
    payoutBank: l.payoutBank ?? '', payoutAccountNumber: l.payoutAccountNumber ?? '', purpose: l.purpose, notes: l.notes ?? '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const save = async () => {
    const update: OfflineLoanUpdate = {
      // Who they are can change only until they sign up and it becomes theirs.
      ...(activated
        ? {}
        : {
            ...(f.bvn ? { bvn: f.bvn } : {}),
            fullName: f.fullName.trim(),
            email: f.email.trim(),
            phone: f.phone.trim(),
            dateOfBirth: f.dateOfBirth || undefined,
            gender: f.gender,
            payoutBank: f.payoutBank,
            payoutAccountNumber: f.payoutAccountNumber.trim(),
          }),
      address: f.address.trim(),
      state: f.state,
      occupation: f.occupation.trim(),
      businessName: f.businessName.trim(),
      businessAddress: f.businessAddress.trim(),
      monthlyIncome: parseAmount(f.monthlyIncome) || undefined,
      purpose: f.purpose.trim(),
      notes: f.notes.trim(),
    };
    const ok = await run(async () => {
      await adminApi.updateImportedLoan(l.id, update);
      await onSaved();
      return true;
    }, 'Saved');
    if (ok) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit loan file"
      description={
        activated
          ? 'They have signed up, so who they are is theirs to keep up to date now. The loan figures cannot change.'
          : 'They have not signed up yet, so you can still correct who they are. The loan figures cannot change; delete and re-enter if they are wrong.'
      }
      footer={<Button block loading={busy} onClick={() => void save()}>Save changes</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!activated && (
          <>
            <Input
              label="Correct the BVN"
              inputMode="numeric"
              maxLength={11}
              placeholder={`Now ending ${l.bvnLast4?.slice(-4) ?? '—'}`}
              value={f.bvn}
              onChange={(e) => set('bvn')(e.target.value.replace(/\D/g, ''))}
              hint="Leave blank to keep it. This is how they are recognised when they sign up."
            />
            <Input label="Full name" value={f.fullName} onChange={(e) => set('fullName')(e.target.value)} />
            <Input label="Email" value={f.email} onChange={(e) => set('email')(e.target.value)} />
            <Input label="Phone" value={f.phone} onChange={(e) => set('phone')(e.target.value)} />
            <Input label="Date of birth" type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth')(e.target.value)} />
            <Select label="Gender" placeholder="—" value={f.gender} onChange={(e) => set('gender')(e.target.value)} options={GENDERS} />
          </>
        )}
        <Input label="Address" value={f.address} onChange={(e) => set('address')(e.target.value)} />
        <Select label="State" placeholder="—" value={f.state} onChange={(e) => set('state')(e.target.value)} options={NIGERIAN_STATES} />
        <Input label="Occupation" value={f.occupation} onChange={(e) => set('occupation')(e.target.value)} />
        <Input label="Business name" value={f.businessName} onChange={(e) => set('businessName')(e.target.value)} />
        <Input label="Business address" value={f.businessAddress} onChange={(e) => set('businessAddress')(e.target.value)} />
        <Input label="Monthly income (₦)" value={f.monthlyIncome} onChange={(e) => set('monthlyIncome')(formatAmountInput(e.target.value))} />
        {!activated && (
          <>
            <Input label="Payout bank" value={f.payoutBank} onChange={(e) => set('payoutBank')(e.target.value)} />
            <Input label="Account number" maxLength={10} value={f.payoutAccountNumber} onChange={(e) => set('payoutAccountNumber')(e.target.value.replace(/\D/g, ''))} />
          </>
        )}
        <Input label="Purpose" value={f.purpose} onChange={(e) => set('purpose')(e.target.value)} />
      </div>
      <Textarea className="mt-4" label="Notes" value={f.notes} onChange={(e) => set('notes')(e.target.value)} rows={3} />
    </Modal>
  );
}
