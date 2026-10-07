import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, RotateCcw, TrendingUp } from 'lucide-react';
import { AdminApi, EarningsApi, fmtMoney } from '../lib/api';
import { Badge, Button, Card, Field, Input, LoadingState, Modal, Select, StatCard, toast } from '../components/ui';
import type { EarningEntry, EarningSummary } from '../types';

type Range = 'today' | 'week' | 'month' | 'all';
type SalonOption = { id: string; name: string; status?: string };

function rangeStart(range: Range) {
  const now = new Date();
  if (range === 'today') { now.setHours(0, 0, 0, 0); return now.getTime(); }
  if (range === 'week') return Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (range === 'month') return Date.now() - 30 * 24 * 60 * 60 * 1000;
  return 0;
}

function Earnings({ platformAdmin = false }: { platformAdmin?: boolean }) {
  const [salons, setSalons] = useState<SalonOption[]>([]);
  const [salonId, setSalonId] = useState('');
  const [salonName, setSalonName] = useState('');
  const [summaries, setSummaries] = useState<EarningSummary[]>([]);
  const [entries, setEntries] = useState<EarningEntry[]>([]);
  const [range, setRange] = useState<Range>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openedStaff, setOpenedStaff] = useState<EarningSummary | null>(null);
  const [adjusting, setAdjusting] = useState<{ entry: EarningEntry; reversed: boolean } | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({ amount: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!platformAdmin) return;
    AdminApi.directory().then(directory => {
      const activeSalons = (directory.salons || []) as SalonOption[];
      setSalons(activeSalons);
      setSalonId(current => current || activeSalons.find(salon => salon.status === 'active')?.id || activeSalons[0]?.id || '');
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load salons.'));
  }, [platformAdmin]);

  const load = async () => {
    if (platformAdmin && !salonId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const data = await EarningsApi.list(platformAdmin ? salonId : undefined);
      setSummaries(data.summaries);
      setEntries(data.entries);
      setSalonName(data.salonName || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load earnings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [platformAdmin, salonId]);

  const visibleEntries = useMemo(() => {
    const since = rangeStart(range);
    return entries.filter(entry => entry.createdAt >= since);
  }, [entries, range]);

  const visibleSummaries = useMemo(() => {
    const rows = new Map<string, EarningSummary & { clientIds: Set<string> }>();
    for (const summary of summaries) rows.set(summary.staffId, {
      ...summary, clients: 0, entryCount: 0, serviceRevenueByCurrency: {}, commissionByCurrency: {}, assistantFeesByCurrency: {}, totalByCurrency: {}, clientIds: new Set<string>(),
    });
    for (const entry of visibleEntries) {
      const row = rows.get(entry.staffId) || {
        staffId: entry.staffId, staffName: entry.staffName, staffRole: entry.staffRole, clients: 0, entryCount: 0,
        serviceRevenueByCurrency: {}, commissionByCurrency: {}, assistantFeesByCurrency: {}, totalByCurrency: {}, clientIds: new Set<string>(),
      };
      row.clientIds.add(String(entry.customerId || entry.customerName));
      row.entryCount += 1;
      const currency = entry.currency || 'KES';
      row.serviceRevenueByCurrency[currency] = (row.serviceRevenueByCurrency[currency] || 0) + Number(entry.serviceRevenue || 0);
      const target = entry.payoutType === 'assistant_fee' ? row.assistantFeesByCurrency : row.commissionByCurrency;
      target[currency] = (target[currency] || 0) + Number(entry.amount || 0);
      row.totalByCurrency[currency] = (row.totalByCurrency[currency] || 0) + Number(entry.amount || 0);
      rows.set(entry.staffId, row);
    }
    return Array.from(rows.values()).map(({ clientIds, ...row }) => ({ ...row, clients: clientIds.size })).sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [summaries, visibleEntries]);

  const totalOwedKES = visibleSummaries.reduce((sum, row) => sum + Number(row.totalByCurrency.KES || 0), 0);
  const totalClients = visibleSummaries.reduce((sum, row) => sum + row.clients, 0);
  const staffEntries = openedStaff ? visibleEntries.filter(entry => entry.staffId === openedStaff.staffId).sort((a, b) => b.createdAt - a.createdAt) : [];

  const beginAdjustment = (entry: EarningEntry, reversed: boolean) => {
    setAdjusting({ entry, reversed });
    setAdjustmentForm({ amount: String(entry.amount), note: '' });
  };

  const saveAdjustment = async () => {
    if (!adjusting || !adjustmentForm.note.trim()) { toast('Enter a reason for this change.', 'error'); return; }
    if (!adjusting.reversed && (!Number.isFinite(Number(adjustmentForm.amount)) || Number(adjustmentForm.amount) < 0)) { toast('Enter a valid earning amount.', 'error'); return; }
    setSaving(true);
    try {
      await EarningsApi.adjust({
        earningKey: adjusting.entry.earningKey,
        amount: Number(adjustmentForm.amount),
        reversed: adjusting.reversed,
        note: adjustmentForm.note.trim(),
        salonId: platformAdmin ? salonId : undefined,
      });
      toast(adjusting.reversed ? 'Earning reversed. The change is recorded in the audit trail.' : 'Earning amount updated and recorded in the audit trail.', 'success');
      setAdjusting(null);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not adjust the earning.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !entries.length) return <LoadingState label="Loading staff earnings…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#2F6BFF]">Earnings ledger</p>
          <h2 className="text-xl font-semibold">Staff earnings{salonName ? ` · ${salonName}` : ''}</h2>
          <p className="mt-1 text-sm text-[#6E6E73]">Open a staff member to see every client and service. Owner/admin adjustments are audited; recorded-paid earnings are locked.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {platformAdmin && <Field label="Salon" htmlFor="earnings-salon"><Select id="earnings-salon" value={salonId} onChange={event => setSalonId(event.target.value)}><option value="">Choose a salon</option>{salons.map(salon => <option key={salon.id} value={salon.id}>{salon.name}</option>)}</Select></Field>}
          <Select aria-label="Earnings date range" value={range} onChange={event => setRange(event.target.value as Range)} className="w-auto" style={{ width: 'auto' }}><option value="today">Today</option><option value="week">7 days</option><option value="month">30 days</option><option value="all">All time</option></Select>
        </div>
      </div>

      {error && <p className="rounded-xl bg-[#FF3B30]/10 px-4 py-3 text-sm text-[#b0201a]" role="alert">{error} <button className="ml-2 underline" onClick={() => void load()}>Retry</button></p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Staff" value={String(visibleSummaries.length)} icon={TrendingUp} />
        <StatCard label="Client visits" value={String(totalClients)} icon={Eye} />
        <StatCard label="Current earnings (KES)" value={fmtMoney(totalOwedKES, 'KES')} icon={TrendingUp} tone="success" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">Staff earning summary and per-client drilldown</caption>
            <thead className="bg-[#F8F9FB]"><tr className="text-left text-xs text-[#6E6E73]"><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Clients</th><th className="px-4 py-3">Service revenue</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Assistant fees</th><th className="px-4 py-3">Total earnings</th><th className="px-4 py-3">Details</th></tr></thead>
            <tbody>{visibleSummaries.map(row => <tr key={row.staffId} className="border-t border-black/5"><td className="px-4 py-3"><p className="font-medium">{row.staffName}</p><p className="text-xs text-[#6E6E73]">{row.staffRole || 'Staff'}</p></td><td className="px-4 py-3">{row.clients}</td><td className="px-4 py-3">{fmtMoney(row.serviceRevenueByCurrency.KES || 0, 'KES')}</td><td className="px-4 py-3">{fmtMoney(row.commissionByCurrency.KES || 0, 'KES')}</td><td className="px-4 py-3">{fmtMoney(row.assistantFeesByCurrency.KES || 0, 'KES')}</td><td className="px-4 py-3 font-semibold">{fmtMoney(row.totalByCurrency.KES || 0, 'KES')}</td><td className="px-4 py-3"><Button variant="secondary" size="sm" onClick={() => setOpenedStaff(row)}><Eye size={14} aria-hidden="true" />Open</Button></td></tr>)}
              {!visibleSummaries.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#6E6E73]">{platformAdmin && !salonId ? 'Choose a salon to inspect its earnings.' : 'No client earnings for this period.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {openedStaff && <Modal title={`${openedStaff.staffName} · client breakdown`} onClose={() => setOpenedStaff(null)} footer={<Button variant="secondary" onClick={() => setOpenedStaff(null)}>Close</Button>}>
        <div className="space-y-3 pb-5">
          <p className="text-sm text-[#6E6E73]">Every service earning in the selected period. Changes require a reason and create a new audit entry; paid earnings cannot be edited.</p>
          {!staffEntries.length && <p className="py-8 text-center text-sm text-[#6E6E73]">No client earnings in this period.</p>}
          {staffEntries.map(entry => <div key={entry.earningKey} className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><p className="font-semibold">{entry.customerName}</p><p className="mt-0.5 text-sm text-[#6E6E73]">{entry.serviceName} · {entry.payoutType === 'assistant_fee' ? 'Assistant fee' : `${entry.commissionPct ?? 0}% commission`}</p><p className="mt-1 text-xs text-[#6E6E73]">{new Date(entry.createdAt).toLocaleString()} · Order {entry.orderId.slice(0, 8)} · Service revenue {fmtMoney(entry.serviceRevenue, entry.currency)}</p></div>
              <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end"><p className="font-semibold">{fmtMoney(entry.amount, entry.currency)}</p>{entry.reversed && <Badge tone="danger">Reversed</Badge>}{entry.paid && <Badge tone="success">Paid / recorded</Badge>}{entry.adjustedAt && !entry.reversed && <Badge tone="warning">Adjusted</Badge>}</div>
            </div>
            {entry.adjustmentNote && <p className="mt-2 text-xs text-[#6E6E73]">Adjustment: {entry.adjustmentNote}</p>}
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={entry.paid} onClick={() => beginAdjustment(entry, false)}><Pencil size={13} aria-hidden="true" />Edit earning</Button><Button size="sm" variant="danger" disabled={entry.paid || entry.reversed} onClick={() => beginAdjustment(entry, true)}><RotateCcw size={13} aria-hidden="true" />Undo earning</Button></div>
          </div>)}
        </div>
      </Modal>}

      {adjusting && <Modal title={adjusting.reversed ? 'Undo earning' : 'Edit earning'} onClose={() => setAdjusting(null)} footer={<><Button variant="secondary" onClick={() => setAdjusting(null)} disabled={saving}>Cancel</Button><Button variant={adjusting.reversed ? 'danger' : 'primary'} onClick={() => void saveAdjustment()} disabled={saving}>{saving ? 'Saving…' : adjusting.reversed ? 'Reverse earning' : 'Save earning'}</Button></>}>
        <div className="space-y-4 pb-5"><div className="rounded-xl bg-[#F5F7FA] p-3"><p className="font-medium">{adjusting.entry.customerName} · {adjusting.entry.serviceName}</p><p className="text-xs text-[#6E6E73]">Current earning: {fmtMoney(adjusting.entry.amount, adjusting.entry.currency)}</p></div>
          {!adjusting.reversed && <Field label={`Correct earning amount (${adjusting.entry.currency})`} htmlFor="earning-adjust-amount"><Input id="earning-adjust-amount" type="number" min="0" step="0.01" value={adjustmentForm.amount} onChange={event => setAdjustmentForm(current => ({ ...current, amount: event.target.value }))} /></Field>}
          <Field label="Reason (required for audit history)" htmlFor="earning-adjust-note"><Input id="earning-adjust-note" maxLength={500} value={adjustmentForm.note} onChange={event => setAdjustmentForm(current => ({ ...current, note: event.target.value }))} placeholder={adjusting.reversed ? 'Why is this earning being reversed?' : 'Why is this amount changing?'} /></Field>
          {adjusting.reversed && <p className="text-sm text-[#9a5c00]">This records a zero-value reversal. The original POS sale stays unchanged in the audit trail.</p>}
        </div>
      </Modal>}
    </div>
  );
}

export default Earnings;
