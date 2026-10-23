import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpRight, ClipboardList, FileDown, Gauge, History, Menu, MessagesSquare, SlidersHorizontal, UsersRound, UserCog, Users, X } from 'lucide-react';
import { BrandMark } from '../components/Brand';
import { Pill } from '../components/ui/Bits';
import { useAdminApplications, useOverview } from '../hooks/queries';
import { useSupportLive, useSupportSummary } from '../hooks/support';
import { cn } from '../lib/cn';
import { roleLabel } from '../lib/labels';
import { useIdleLock, useSession } from '../state/session';
import { useSettings } from '../state/settings';

export function AdminLayout() {
  useIdleLock();
  const [open, setOpen] = useState(false);
  const { adminRole, profile } = useSession();
  const settings = useSettings();
  const overview = useOverview();
  const applications = useAdminApplications('PENDING');
  const payments = (overview.data?.queues.pendingPayIns ?? 0) + (overview.data?.queues.pendingWithdrawals ?? 0);
  const pendingApplications = applications.data?.totalItems ?? 0;
  // Customers' messages arrive live wherever the admin is in the panel.
  useSupportLive('staff');
  const support = useSupportSummary();
  const waitingOnTeam = support.data?.open ?? 0;
  const chat = useLocation().pathname.startsWith('/admin/support');

  const nav = [
    { to: '/admin', label: 'Overview', icon: Gauge, end: true },
    { to: '/admin/customers', label: 'Customers', icon: Users },
    { to: '/admin/payments', label: 'Payments', icon: ArrowLeftRight, badge: payments },
    { to: '/admin/lending', label: 'Lending', icon: ClipboardList, badge: pendingApplications },
    { to: '/admin/groups', label: 'Loan groups', icon: UsersRound },
    { to: '/admin/support', label: 'Support', icon: MessagesSquare, badge: waitingOnTeam },
    { to: '/admin/controls', label: 'Controls', icon: SlidersHorizontal },
    { to: '/admin/team', label: 'Team', icon: UserCog },
    { to: '/admin/reports', label: 'Reports', icon: FileDown },
    { to: '/admin/audit', label: 'Audit log', icon: History },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pb-5 pt-6">
        <BrandMark size={34} />
        <div>
          <p className="text-[15px] font-extrabold leading-tight">Kudi9ja Admin</p>
          {adminRole && <Pill tone={adminRole === 'OWNER' ? 'gold' : 'info'} className="mt-1">{roleLabel(adminRole)}</Pill>}
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition',
                isActive ? 'bg-gold/10 text-gold' : 'text-ink-2 hover:bg-surface-alt hover:text-ink',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{label}</span>
            {!!badge && (
              <span className="grid min-w-[22px] place-items-center rounded-full bg-danger px-1.5 text-[11px] font-extrabold leading-[22px] text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 p-4">
        {settings.switches.maintenanceMode && (
          <div className="rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[12px] font-semibold text-gold">Maintenance mode is on</div>
        )}
        <Link
          to="/app"
          className="flex items-center justify-between rounded-xl border border-stroke px-3.5 py-3 text-[13px] font-bold text-ink-2 transition hover:border-gold/40 hover:text-ink"
        >
          Back to my account <ArrowUpRight className="h-4 w-4" />
        </Link>
        <p className="truncate px-1 text-[11.5px] text-ink-3">Signed in as {profile?.email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-stroke bg-surface lg:block">{sidebar}</aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-stroke bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-ink-2" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <BrandMark size={26} />
        <span className="text-[15px] font-extrabold">Admin</span>
        {payments + pendingApplications + waitingOnTeam > 0 && (
          <span className="ml-auto rounded-full bg-danger px-2 text-[11px] font-extrabold leading-5 text-white">
            {payments + pendingApplications + waitingOnTeam} waiting
          </span>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-sheet-in border-r border-stroke bg-surface">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-1.5 text-ink-3" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[260px]">
        <main className={chat ? 'h-[calc(100dvh-56px)] lg:h-dvh' : 'mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-8'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
