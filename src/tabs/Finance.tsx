import { useEffect, useState } from 'react';
import { Download, Plus, Receipt, Send } from 'lucide-react';
import { Card, Button, Badge, Modal, Field, Input, Select, EmptyState, LoadingState, StatCard, toast } from '../components/ui';
import { DashboardApi, ExpensesApi, PayrollApi, PayoutsApi, downloadCSV, fmtMoney } from '../lib/api';
import Earnings from './Earnings';
import type { DashboardData, Expense, PayoutBatch, PayrollRow, PayrollTransferBatch } from '../types';

type Range = 'today' | 'week' | 'month' | 'all';
const currentSalaryMonth = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);

function Finance() {
  const [range, setRange] = useState<Range>('month');
  const [data, setData] = useState<DashboardData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payouts, setPayouts] = useState<PayoutBatch[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(currentSalaryMonth);
  const [paystackReady, setPaystackReady] = useState(false);
  const [payrollBatches, setPayrollBatches] = useState<PayrollTransferBatch[]>([]);
  const [payrollSending, setPayrollSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Supplies', amount: 0, note: '', date: new Date().toISOString().slice(0, 10) });

  const load = () => {
    setLoading(true);
    Promise.all([DashboardApi.get(range), ExpensesApi.list(), PayoutsApi.list()]).then(([d, e, p]) => { setData(d); setExpenses(e); setPayouts(p); }).finally(() => setLoading(false));
  };
  useEffect(load, [range]);

  const period = { from: payFrom || undefined, to: payTo || undefined, salaryMonth };
  const loadPayroll = async () => {
    try {
      const [payroll, provider, batches] = await Promise.all([
        PayrollApi.commissions(period),
        PayrollApi.providerStatus(),
        PayrollApi.batches(),
      ]);
      setPayrollRows(payroll.rows);
      setPaystackReady(provider.ready);
      setPayrollBatches(batches);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not load payroll.', 'error');
    }
  };
  useEffect(() => { void loadPayroll(); }, [payFrom, payTo, salaryMonth]);
  const payrollTotal = payrollRows.reduce((sum, row) => sum + row.totalKES, 0);

  const addExpense = async () => {
    if (!form.category.trim() || form.amount <= 0) { toast('Enter a category and amount greater than zero.', 'error'); return; }
    await ExpensesApi.create(form);
    toast('Expense recorded.', 'success');
    setOpen(false);
    setForm({ category: 'Supplies', amount: 0, note: '', date: new Date().toISOString().slice(0, 10) });
    load();
  };

  const recordPayout = async () => {
    if (!payrollRows.length) { toast('There are no unpaid commissions or salary in this period.', 'error'); return; }
    if (!window.confirm(`Record ${fmtMoney(payrollTotal, 'KES')} as paid for ${payrollRows.length} staff? This records an external/manual payment; it does not send money.`)) return;
    setPaying(true);
    try {
      const { data } = await PayoutsApi.record(period);
      toast(`${data.employeeCount} staff payment recorded: ${fmtMoney(data.totalKES, 'KES')}.`, 'success');
      load();
      void loadPayroll();
    } catch (cause: any) {
      toast(cause?.message || 'Could not record the payout.', 'error');
    } finally {
      setPaying(false);
    }
  };

  const sendPayroll = async () => {
    if (!paystackReady) { toast('Configure a live Paystack secret key on the backend before sending payroll.', 'error'); return; }
    if (!payrollRows.length) { toast('There are no unpaid commissions or salary in this period.', 'error'); return; }
    if (payrollRows.some(row => !/^(?:\+?254|0)[17]\d{8}$/.test((row.phone || '').replace(/\s+/g, '')))) { toast('Every staff member being paid needs a valid Kenyan M-Pesa number.', 'error'); return; }
    if (!window.confirm(`Send ${fmtMoney(payrollTotal, 'KES')} to ${payrollRows.length} staff through Paystack to their registered M-Pesa numbers?`)) return;
    setPayrollSending(true);
    try {
      const { data } = await PayrollApi.send(period);
      toast(`Paystack transfers: ${data.sentCount} pending/accepted, ${data.failedCount} failed. Successful payments are marked paid automatically when Paystack confirms them.`, data.failedCount ? 'info' : 'success');
      void loadPayroll();
    } catch (cause: any) {
      toast(cause?.message || 'Payroll transfer failed.', 'error');
    } finally {
      setPayrollSending(false);
    }
  };

  const downloadPayroll = () => {
    const rows: (string | number)[][] = [
      ['SafiGroom OS - Commission Payroll'],
      ['Period', `${payFrom || 'start'} to ${payTo || 'today'}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Staff', 'Role', 'Phone', 'Clients', 'Commission (KES)', 'Assistant fees (KES)', 'Salary (KES)', 'Total (KES)'],
      ...payrollRows.map(row => [row.name, row.role, row.phone || '', row.clients, row.commissionKES, row.assistantFeesKES, row.salaryKES, row.totalKES]),
      [],
      ['Total (KES)', payrollTotal],
    ];
    downloadCSV(`safigroom-payroll-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading && !data) return <LoadingState label="Loading finance data…" />;

  const revenueKES = data?.revenueByCurrency.KES || 0;
  const commissionsKES = data?.commissionsByCurrency.KES || 0;
  const assistantFeesKES = data?.assistantFeesByCurrency.KES || 0;
  const profitKES = data?.estimatedProfitByCurrency.KES || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Finance</h1><p className="text-sm text-[#6E6E73]">Revenue, commissions, expenses and profitability, computed from real transactions.</p></div>
        <div className="flex items-center gap-2">
          <Select aria-label="Date range" value={range} onChange={e => setRange(e.target.value as Range)} className="w-auto" style={{ width: 'auto' }}>
            <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="all">All Time</option>
          </Select>
          <Button onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" />Add Expense</Button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue" value={fmtMoney(revenueKES, 'KES')} icon={Receipt} tone="success" />
            <StatCard label="Product Cost" value={fmtMoney(data.productCost, 'KES')} icon={Receipt} />
            <StatCard label="Commissions Owed" value={fmtMoney(commissionsKES, 'KES')} icon={Receipt} />
            <StatCard label="Assistant Fees" value={fmtMoney(assistantFeesKES, 'KES')} sub="Deducted from service revenue" icon={Receipt} tone="warning" />
          </div>
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Profitability Breakdown</h2>
            <div className="space-y-2 text-sm max-w-md">
              <div className="flex justify-between"><span className="text-[#6E6E73]">Revenue</span><span>{fmtMoney(revenueKES, 'KES')}</span></div>
              <div className="flex justify-between"><span className="text-[#6E6E73]">− Product cost (inventory consumed)</span><span>-{fmtMoney(data.productCost, 'KES')}</span></div>
              <div className="flex justify-between"><span className="text-[#6E6E73]">− Staff commissions</span><span>-{fmtMoney(commissionsKES, 'KES')}</span></div>
              <div className="flex justify-between"><span className="text-[#6E6E73]">− Assistant fees</span><span>-{fmtMoney(assistantFeesKES, 'KES')}</span></div>
              <div className="flex justify-between"><span className="text-[#6E6E73]">− Recorded expenses</span><span>-{fmtMoney(data.expenseTotal, 'KES')}</span></div>
              <div className="flex justify-between font-semibold text-base border-t border-black/5 pt-2 mt-2"><span>Net Profit</span><span className={profitKES >= 0 ? 'text-[#1c7c34]' : 'text-[#b0201a]'}>{fmtMoney(profitKES, 'KES')}</span></div>
            </div>
            <p className="text-xs text-[#6E6E73] mt-3">Primary staff commission is calculated after assistant fees. Monthly salaries are managed separately in Payroll.</p>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Payment Methods</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {(['Cash', 'Card', 'M-Pesa'] as const).map(method => <div key={method} className="rounded-2xl bg-black/[0.03] p-4"><p className="text-xs text-[#6E6E73]">{method}</p><p className="text-xl font-semibold mt-1">{fmtMoney(data.paymentMethodTotals[method], 'KES')}</p></div>)}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Commission Statement (by staff)</h2>
            {data.topStaff.length === 0 ? <p className="text-sm text-[#6E6E73]">No commission activity for this range.</p> : (
              <table className="w-full text-sm">
                <caption className="sr-only">Commission owed per staff member</caption>
                <thead><tr className="text-left text-xs text-[#6E6E73] border-b border-black/5"><th className="pb-2">Staff</th><th className="pb-2">Services Sold</th><th className="pb-2">Revenue</th><th className="pb-2">Commission</th></tr></thead>
                <tbody>
                  {data.topStaff.map(s => (
                    <tr key={`${s.name}-${s.currency}`} className="border-b border-black/5 last:border-0">
                      <td className="py-2">{s.name}</td><td className="py-2">{s.count}</td><td className="py-2">{fmtMoney(s.revenue, s.currency)}</td><td className="py-2 font-medium">{fmtMoney(s.commission, s.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Earnings />
        </>
      )}

      <Card className="p-6">
        <div className="flex flex-col gap-3 mb-4">
          <div><h2 className="font-semibold">Staff Payroll</h2><p className="text-xs text-[#6E6E73]">Unpaid KES commissions and assistant fees for the selected date range, plus each configured full monthly salary once for the selected month.</p></div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="From" htmlFor="pay-from"><Input id="pay-from" type="date" value={payFrom} max={payTo || undefined} onChange={e => setPayFrom(e.target.value)} /></Field>
            <Field label="To" htmlFor="pay-to"><Input id="pay-to" type="date" value={payTo} min={payFrom || undefined} onChange={e => setPayTo(e.target.value)} /></Field>
            <Field label="Salary month" htmlFor="salary-month"><Input id="salary-month" type="month" max={currentSalaryMonth()} value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} /></Field>
            <Button variant="secondary" onClick={downloadPayroll} disabled={!payrollRows.length}><Download size={16} aria-hidden="true" />CSV</Button>
            <Button onClick={sendPayroll} disabled={payrollSending || !paystackReady || !payrollRows.length}>{payrollSending ? 'Sending…' : <><Send size={15} aria-hidden="true" />Send with Paystack</>}</Button>
            <Button variant="secondary" onClick={recordPayout} disabled={paying || !payrollRows.length}>{paying ? 'Marking…' : 'Mark all paid'}</Button>
          </div>
        </div>
        {!paystackReady && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Paystack live transfers are not configured. Add <code>PAYSTACK_SECRET_KEY</code> as a backend secret and set your Paystack webhook URL to <code>/api/paystack/webhook</code>.</p>}
        {payrollRows.length === 0 ? <p className="text-sm text-[#6E6E73]">No unpaid commissions or salary{payFrom || payTo ? ' in this period' : ''}.</p> : (
          <div className="space-y-2">
            {payrollRows.map(row => <div key={row.staffId} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-black/5 pb-2"><div><p className="text-sm font-medium">{row.name}</p><p className="text-xs text-[#6E6E73]">{row.role} · {row.phone || 'No phone number'}{row.clients ? ` · ${row.clients} client${row.clients === 1 ? '' : 's'}` : ''}{row.commissionKES > 0 ? ` · commission ${fmtMoney(row.commissionKES, 'KES')}` : ''}{row.assistantFeesKES > 0 ? ` + assistant fees ${fmtMoney(row.assistantFeesKES, 'KES')}` : ''}{row.salaryKES > 0 ? ` · salary ${fmtMoney(row.salaryKES, 'KES')}` : ''}</p></div><div className="rounded-xl bg-black/[0.03] px-3 py-2 text-sm font-semibold">{fmtMoney(row.totalKES, 'KES')}</div></div>)}
            <div className="flex justify-between pt-2 text-sm font-semibold"><span>Total to pay</span><span>{fmtMoney(payrollTotal, 'KES')}</span></div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-1">Recent Paystack payroll transfers</h2>
        <p className="text-xs text-[#6E6E73] mb-4">Transfers remain pending until Paystack sends a signed status webhook.</p>
        {!payrollBatches.length ? <p className="text-sm text-[#6E6E73]">No Paystack payroll transfers yet.</p> : <div className="space-y-3">
          {payrollBatches.slice(0, 5).map(batch => (
            <div key={batch.id} className="border-b border-black/5 pb-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{batch.salaryMonth} · {batch.employeeCount} staff · {fmtMoney(batch.totalKES, 'KES')}</span>
                <Badge tone={batch.status === 'success' ? 'success' : batch.status === 'failed' || batch.status === 'partial' ? 'warning' : 'info'}>{batch.status}</Badge>
              </div>
              <div className="mt-2 space-y-1">
                {batch.transfers.map((transfer, index) => <p key={`${transfer.reference}-${index}`} className="text-xs text-[#6E6E73]">{transfer.staffName} · {fmtMoney(transfer.amountKES, 'KES')} · {transfer.status}{transfer.providerMessage ? ` · ${transfer.providerMessage}` : ''}</p>)}
              </div>
            </div>
          ))}
        </div>}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Recorded payouts</h2><p className="text-xs text-[#6E6E73]">Manual payouts record commissions or salary as paid; they do not send money.</p></div></div>
        {payouts.length === 0 ? <p className="text-sm text-[#6E6E73]">No payout batches recorded yet.</p> : <div className="space-y-2">{payouts.slice(0, 5).map(payout => <div key={payout.id} className="flex items-center justify-between border-b border-black/5 pb-2 text-sm"><span className="capitalize">{payout.range} · {payout.employeeCount} employees</span><span className="font-medium">{fmtMoney(payout.totalKES, 'KES')} · recorded</span></div>)}</div>}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Expenses</h2>
        {expenses.length === 0 ? <EmptyState icon={Receipt} title="No expenses recorded" description="Track rent, supplies and other operating costs here." /> : (
          <ul className="divide-y divide-black/5">
            {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
              <li key={e.id} className="py-3 flex items-center justify-between text-sm">
                <div><p className="font-medium">{e.category}</p><p className="text-xs text-[#6E6E73]">{e.note} · {e.date}</p></div>
                <Badge tone="neutral">{fmtMoney(e.amount, 'KES')}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {open && (
        <Modal title="Record Expense" onClose={() => setOpen(false)} footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={addExpense}>Save Expense</Button>
        </>}>
          <div className="space-y-4">
            <Field label="Category" htmlFor="e-cat">
              <Select id="e-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option>Rent</option><option>Utilities</option><option>Supplies</option><option>Salaries</option><option>Marketing</option><option>Other</option>
              </Select>
            </Field>
            <Field label="Amount (KES)" htmlFor="e-amount"><Input id="e-amount" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} /></Field>
            <Field label="Note" htmlFor="e-note"><Input id="e-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></Field>
            <Field label="Date" htmlFor="e-date"><Input id="e-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Finance;
