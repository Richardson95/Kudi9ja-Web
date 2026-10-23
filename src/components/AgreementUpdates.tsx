import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useOutstandingAgreements } from '../hooks/queries';
import { meApi } from '../lib/api/endpoints';
import { describeError } from '../lib/api/errors';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { IconBadge } from './ui/Bits';

/**
 * Shown once per visit when a document the customer accepted has a newer
 * version in force: what changed, a link to read it, and accept.
 */
export function AgreementUpdates() {
  const { data } = useOutstandingAgreements();
  const notices = (data ?? []).filter((n) => ['terms', 'privacy', 'lending'].includes(n.id));
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (notices.length === 0) setDismissed(false);
  }, [notices.length]);

  if (notices.length === 0 || dismissed) return null;
  const several = notices.length > 1;

  const accept = async () => {
    setBusy(true);
    try {
      for (const n of notices) await meApi.acceptAgreement(n.id, n.version);
      await qc.invalidateQueries({ queryKey: keys.agreements });
      toast.success(several ? 'Thank you. The new versions are accepted.' : 'Thank you. The new version is accepted.');
    } catch (e) {
      toast.error(describeError(e));
      await qc.invalidateQueries({ queryKey: keys.agreements });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => setDismissed(true)} size="md" locked={busy}>
      <div className="space-y-5 pt-2">
        <div className="flex justify-center">
          <IconBadge size={56}>
            <Gavel />
          </IconBadge>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-extrabold">{several ? 'We have updated our agreements' : `We have updated the ${notices[0]!.title}`}</h2>
          <p className="mt-1.5 text-sm text-ink-2">Here is what changed. Read the new version if you like, then accept it to carry on.</p>
        </div>
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="rounded-2xl border border-stroke bg-canvas/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-extrabold">{n.title}</p>
                <span className="font-mono text-[12px] font-bold text-gold">v{n.version}</span>
              </div>
              {n.changeSummary && n.changeSummary !== 'null' && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{n.changeSummary}</p>}
              <Link to={`/app/legal/${n.id}`} onClick={() => setDismissed(true)} className="mt-2 inline-block text-[13px] font-bold text-gold hover:underline">
                Read the new version
              </Link>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Button block size="lg" loading={busy} onClick={accept}>
            {several ? 'I accept the new versions' : 'I accept'}
          </Button>
          <Button block variant="subtle" disabled={busy} onClick={() => setDismissed(true)}>
            Not now
          </Button>
        </div>
      </div>
    </Modal>
  );
}
