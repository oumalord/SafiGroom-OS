import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarCheck2, Clock3, RefreshCw, TrendingUp, UserRound } from 'lucide-react';
import { Card, Button, EmptyState, LoadingState, StatCard, toast } from '../components/ui';
import { StaffPortalApi, fmtKES } from '../lib/api';
import type { StaffPortalDashboard } from '../types';

function StaffPortal() {
  const [dashboard, setDashboard] = useState<StaffPortalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      setDashboard(await StaffPortalApi.dashboard());
      setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load your staff dashboard.';
      setError(message);
      if (quiet) toast(message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(true); }, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading) return <LoadingState label="Loading your staff dashboard…" />;
  if (error && !dashboard) return <EmptyState icon={Activity} title="Dashboard unavailable" description={error} action={<Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />Try again</Button>} />;
  if (!dashboard) return null;

  const cards = [
    { label: 'Waiting now', value: String(dashboard.waitingNow), sub: 'Clients assigned to you', icon: Clock3, tone: 'warning' as const },
    { label: "Today's earnings", value: fmtKES(dashboard.dailyEarningsKES), sub: `Commission ${fmtKES(dashboard.dailyCommissionKES)} + assistant fees ${fmtKES(dashboard.dailyAssistantFeesKES)}`, icon: TrendingUp, tone: 'success' as const },
    { label: 'Clients served today', value: String(dashboard.clientsServedToday), sub: 'Unique clients with completed sales', icon: UserRound, tone: 'neutral' as const },
    { label: 'This week', value: fmtKES(dashboard.weeklyEarningsKES), sub: 'Commission since Monday', icon: CalendarCheck2, tone: 'neutral' as const },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-7">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-[#102951] via-[#123f70] to-[#087f9f] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Staff portal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {dashboard.staff.name}</h1>
          <p className="mt-1 text-sm text-blue-100">{dashboard.staff.role}{dashboard.staff.chair ? ` · ${dashboard.staff.chair}` : ''}{dashboard.staff.branchName ? ` · ${dashboard.staff.branchName}` : ''}</p>
        </div>
        <Button variant="secondary" onClick={() => void load(true)} disabled={refreshing} className="self-start sm:self-auto">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />{refreshing ? 'Updating…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon, tone }) => <StatCard key={label} label={label} value={value} sub={sub} icon={icon} tone={tone} />)}
      </div>

      <Card className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#34C759]/10 text-[#1c7c34]"><TrendingUp size={19} aria-hidden="true" /></div>
          <div>
            <h2 className="font-semibold">Your earnings at a glance</h2>
            <p className="mt-1 text-sm text-[#6E6E73]">Primary staff earn commission on the service fee after assistant fees. Assistants see the fees assigned to them here.</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#F5F7FA] p-4 sm:p-5">
            <p className="text-xs font-medium text-[#6E6E73]">Today</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{fmtKES(dashboard.dailyEarningsKES)}</p>
            <p className="mt-1 text-xs text-[#6E6E73]">Commission {fmtKES(dashboard.dailyCommissionKES)} + assistant fees {fmtKES(dashboard.dailyAssistantFeesKES)} · {dashboard.clientsServedToday} client{dashboard.clientsServedToday === 1 ? '' : 's'} served</p>
          </div>
          <div className="rounded-2xl bg-[#F5F7FA] p-4 sm:p-5">
            <p className="text-xs font-medium text-[#6E6E73]">Week starting {new Date(dashboard.weekStartsAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{fmtKES(dashboard.weeklyEarningsKES)}</p>
            <p className="mt-1 text-xs text-[#6E6E73]">Commission {fmtKES(dashboard.weeklyCommissionKES)} + assistant fees {fmtKES(dashboard.weeklyAssistantFeesKES)}</p>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-[#8b8f98]">Dashboard refreshes automatically every minute.</p>
      </Card>
    </div>
  );
}

export default StaffPortal;
