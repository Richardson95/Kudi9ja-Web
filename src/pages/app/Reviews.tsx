import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, EmptyState } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Card';
import { useDialogs } from '../../components/ui/Dialogs';
import { Textarea } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Spinner';
import { useAction } from '../../hooks/useAction';
import { keys, useMyReview, useReviewSummary } from '../../hooks/queries';
import { reviewsApi } from '../../lib/api/endpoints';
import { cn } from '../../lib/cn';
import { relative } from '../../lib/format';
import { useSession } from '../../state/session';

export default function Reviews() {
  const summary = useReviewSummary();
  const mine = useMyReview();
  const list = useQuery({ queryKey: keys.reviews, queryFn: () => reviewsApi.list(0, 50), enabled: useSession().stage === 'unlocked' });
  const qc = useQueryClient();
  const dialogs = useDialogs();
  const { busy, run } = useAction();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (mine.data) {
      setRating(mine.data.rating);
      setComment(mine.data.comment);
    }
  }, [mine.data]);

  const s = summary.data;
  const refreshAll = () => Promise.all([keys.reviews, keys.reviewSummary, keys.myReview].map((k) => qc.invalidateQueries({ queryKey: k })));
  const bars = s ? [s.fiveStar, s.fourStar, s.threeStar, s.twoStar, s.oneStar] : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Reviews" subtitle="What customers say about Kudi9ja — and your chance to say it too." />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="space-y-4">
          <div className="text-center">
            <p className="num text-5xl font-extrabold">{s?.average != null ? s.average.toFixed(1) : '—'}</p>
            <Stars value={Math.round(s?.average ?? 0)} className="mt-2 justify-center" />
            <p className="mt-1 text-[12.5px] text-ink-3">{s?.count ?? 0} reviews</p>
          </div>
          <ul className="space-y-1.5">
            {bars.map((n, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className="w-3 text-ink-3">{5 - i}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-high">
                  <div className="h-full rounded-full gold-gradient" style={{ width: `${s?.count ? (n / s.count) * 100 : 0}%` }} />
                </div>
                <span className="w-6 text-right text-ink-3">{n}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4">
          <SectionHeader title={mine.data ? 'Your review' : 'Write a review'} />
          <Stars value={rating} onChange={setRating} size={30} />
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={4} placeholder="What has using Kudi9ja been like?" />
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              disabled={!rating || comment.trim().length < 3}
              onClick={() => void run(async () => {
                await reviewsApi.submit(rating, comment.trim());
                await refreshAll();
              }, mine.data ? 'Review updated' : 'Thanks for your review')}
            >
              {mine.data ? 'Update review' : 'Post review'}
            </Button>
            {mine.data && (
              <Button
                variant="subtle"
                onClick={async () => {
                  const ok = await dialogs.confirm({ title: 'Remove your review?', message: 'It disappears from the list for everyone.', confirmLabel: 'Remove', danger: true });
                  if (ok) await run(async () => {
                    await reviewsApi.withdraw();
                    setRating(0);
                    setComment('');
                    await refreshAll();
                  }, 'Review removed');
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-[12px] text-ink-3">Shown with your first name and last initial.</p>
        </Card>
      </div>

      <section>
        <SectionHeader title="Latest reviews" />
        {list.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : list.data?.items.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {list.data.items.map((r) => (
              <Card key={r.id} accent={r.mine ? 'gold' : undefined}>
                <div className="flex items-center gap-3">
                  <Avatar name={r.displayName} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {r.displayName} {r.mine && <span className="text-ink-3">(you)</span>}
                    </p>
                    <p className="text-[11.5px] text-ink-3">
                      {relative(r.writtenAt)}
                      {r.edited ? ' · edited' : ''}
                    </p>
                  </div>
                  <Stars value={r.rating} size={14} />
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{r.comment}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Star />} title="No reviews yet" message="Be the first to say what you think." />
          </Card>
        )}
      </section>
    </div>
  );
}

function Stars({ value, onChange, size = 18, className }: { value: number; onChange?: (n: number) => void; size?: number; className?: string }) {
  return (
    <div className={cn('flex gap-1', className)} role={onChange ? 'radiogroup' : undefined} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = <Star style={{ width: size, height: size }} className={on ? 'fill-gold text-gold' : 'text-ink-3'} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="transition hover:scale-110">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
