import { Compass } from 'lucide-react';
import { EmptyState } from '../../components/ui/Bits';
import { Button } from '../../components/ui/Button';
import { usePageTitle } from '../../components/PageHeader';

export default function NotFound({ embedded }: { embedded?: boolean }) {
  usePageTitle('Not found');
  const body = (
    <EmptyState
      icon={<Compass />}
      title="That page is not here"
      message="The link may be old, or the page may have moved."
      action={<Button to={embedded ? '/app' : '/'}>{embedded ? 'Back to my dashboard' : 'Go to the home page'}</Button>}
    />
  );
  return embedded ? body : <div className="grid min-h-screen place-items-center bg-canvas p-6">{body}</div>;
}
