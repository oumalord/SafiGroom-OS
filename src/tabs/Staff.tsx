import { useEffect, useState } from 'react';
import { Plus, User, UserX, Star, Trash2 } from 'lucide-react';
import { Card, Button, Badge, Modal, Field, Input, Select, LoadingState, EmptyState, toast } from '../components/ui';
import { BranchesApi, StaffApi, ReviewsApi } from '../lib/api';
import type { Branch, Role, Staff, Review } from '../types';

function StaffTab({ role = 'owner' }: { role?: Role }) {
  const canManageStaff = role === 'owner' || role === 'manager';
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffCredentialsUnlocked, setStaffCredentialsUnlocked] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => { StaffApi.list().then(setStaff).catch(() => toast('Could not load staff.', 'error')).finally(() => setLoading(false)); };
  useEffect(load, []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ name: '', role: 'Barber', chair: '', phone: '', pin: '', branchId: '', monthlySalary: '' });
  useEffect(() => { if (role === 'owner' || role === 'manager') ReviewsApi.list().then(setReviews).catch(() => {}); BranchesApi.list().then(loaded => { setBranches(loaded); setForm(current => ({ ...current, branchId: current.branchId || window.localStorage.getItem('safigroom_selected_branch') || loaded[0]?.id || '' })); }).catch(() => {}); }, [role]);
  const avgRating = (staffId: string) => {
    const mine = reviews.filter(r => r.staffId === staffId);
    if (mine.length === 0) return null;
    return { avg: mine.reduce((s, r) => s + r.rating, 0) / mine.length, count: mine.length };
  };

  const isReceptionRole = (value: string) => value.toLowerCase().includes('reception');

  const addStaff = async (submitted: { name: string; role: string; chair: string; phone: string; pin: string; branchId: string; monthlySalary: string }) => {
    if (saving) return;
    if (!submitted.name.trim()) { setFormError('Name is required.'); return; }
    if (!submitted.phone.trim()) { setFormError('Enter a phone number for the staff login.'); return; }
    if (!/^\d{4}$/.test(submitted.pin)) { setFormError('Enter a 4-digit staff PIN.'); return; }
    if (!submitted.branchId) { setFormError('Choose a branch for this staff member.'); return; }
    if (isReceptionRole(submitted.role) && (!Number.isFinite(Number(submitted.monthlySalary)) || Number(submitted.monthlySalary) <= 0)) { setFormError('Enter the receptionist’s monthly salary in KES.'); return; }
    setFormError('');
    setSaving(true);
    try {
      await StaffApi.create({ ...submitted, compensationType: isReceptionRole(submitted.role) ? 'salary' : 'commission', monthlySalary: isReceptionRole(submitted.role) ? Number(submitted.monthlySalary) : undefined, commissionPct: isReceptionRole(submitted.role) ? 0 : 40, accountStatus: 'active', specialties: [], status: 'available' });
      toast('Staff member and worker account created.', 'success');
      setOpen(false);
      setStaffCredentialsUnlocked(false);
      setForm({ name: '', role: 'Barber', chair: '', phone: '', pin: '', branchId: branches[0]?.id || '', monthlySalary: '' });
      load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not add staff. Please check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (s: Staff, status: Staff['status']) => { await StaffApi.update(s.id, { status }); load(); };
  const changeEmployment = async (s: Staff) => {
    const laidOff = s.employmentStatus !== 'laid-off';
    await StaffApi.update(s.id, { employmentStatus: laidOff ? 'laid-off' : 'active', status: laidOff ? 'off' : 'available' });
    toast(laidOff ? `${s.name} has been marked laid off.` : `${s.name} has been reactivated.`, 'success');
    load();
  };
  const deleteStaff = async (member: Staff) => {
    if (!window.confirm(`Permanently delete ${member.name} and their staff login? Historical appointments, queue entries, and reviews will remain without the staff link. This cannot be undone.`)) return;
    try {
      await StaffApi.delete(member.id);
      toast(`${member.name} and their staff login were permanently deleted.`, 'success');
      load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not delete staff member.', 'error');
    }
  };

  const toneFor = (status: Staff['status']) => status === 'available' ? 'success' : status === 'in-service' ? 'warning' : status === 'break' ? 'info' : 'neutral';

  const STATUS_STYLES: Record<Staff['status'], string> = {
    available: 'bg-[#34C759]/10 text-[#1c7c34] border-[#34C759]/30',
    'in-service': 'bg-[#FF9500]/10 text-[#9a5c00] border-[#FF9500]/30',
    break: 'bg-[#0071e3]/10 text-[#0058b0] border-[#0071e3]/30',
    off: 'bg-black/10 text-[#6E6E73] border-black/10',
  };

  if (loading) return <LoadingState label="Loading staff…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Staff & Chairs</h1><p className="text-sm text-[#6E6E73]">Manage your team and station availability.</p></div>
        {canManageStaff && <Button onClick={() => { setForm({ name: '', role: 'Barber', chair: '', phone: '', pin: '', branchId: branches[0]?.id || '', monthlySalary: '' }); setFormError(''); setStaffCredentialsUnlocked(false); setOpen(true); }}><Plus size={16} aria-hidden="true" />Add Staff</Button>}
      </div>

      <div>
        <h2 className="font-semibold mb-3 text-sm text-[#6E6E73]">Chair / Station Board</h2>
        {staff.length === 0 ? <EmptyState icon={User} title="No staff members yet" description="Your staff roster is empty. Add your first team member to see them here." action={canManageStaff ? <Button onClick={() => { setForm({ name: '', role: 'Barber', chair: '', phone: '', pin: '', branchId: branches[0]?.id || '', monthlySalary: '' }); setFormError(''); setStaffCredentialsUnlocked(false); setOpen(true); }}><Plus size={15} aria-hidden="true" />Add Staff</Button> : undefined} /> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {staff.map(s => (
            <Card key={s.id} className="p-4 text-center">
              <p className="text-xs text-[#6E6E73] mb-1">{s.chair || 'Unassigned'}</p>
              <p className="font-medium text-sm">{s.name}</p>
              <div className="mt-2"><Badge tone={toneFor(s.status)}>{s.status.replace('-', ' ')}</Badge></div>
            </Card>
          ))}
        </div>}
      </div>

      <div className="space-y-3">
        {staff.map(s => (
          <Card key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0"><User size={18} className="text-[#6E6E73]" aria-hidden="true" /></div>
            <div className="flex-1">
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-[#6E6E73]">{s.role} · {s.branchName || s.branch} · {s.chair} · {s.compensationType === 'salary' ? `KES ${Number(s.monthlySalary || 0).toLocaleString()} monthly salary` : `${s.commissionPct ?? 40}% commission`}</p>
              <p className="text-xs text-[#6E6E73]">Worker login: {s.phone || 'Not created'}</p>
              {avgRating(s.id) && <p className="text-xs text-[#6E6E73] flex items-center gap-1 mt-0.5"><Star size={11} className="fill-[#FF9500] text-[#FF9500]" aria-hidden="true" />{avgRating(s.id)!.avg.toFixed(1)} ({avgRating(s.id)!.count} review{avgRating(s.id)!.count === 1 ? '' : 's'})</p>}
            </div>
            {role === 'owner' && <Button size="sm" variant={s.employmentStatus === 'laid-off' ? 'secondary' : 'danger'} onClick={() => changeEmployment(s)}><UserX size={14} aria-hidden="true" />{s.employmentStatus === 'laid-off' ? 'Reactivate' : 'Lay off'}</Button>}
            {role === 'owner' && <Button size="sm" variant="danger" aria-label={`Permanently delete ${s.name}`} onClick={() => deleteStaff(s)}><Trash2 size={14} aria-hidden="true" />Delete</Button>}
            {canManageStaff && <select
              aria-label={`Status for ${s.name}`}
              value={s.status}
              disabled={s.employmentStatus === 'laid-off'}
              onChange={e => changeStatus(s, e.target.value as Staff['status'])}
              className={`rounded-full border text-xs font-semibold px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] flex-shrink-0 ${STATUS_STYLES[s.status]}`}
              style={{ width: 'auto' }}
            >
              <option value="available">Available</option>
              <option value="in-service">In Service</option>
              <option value="break">On Break</option>
              <option value="off">Off Duty</option>
            </select>}
          </Card>
        ))}
      </div>

      {open && (
        <Modal title="Add Staff Member" onClose={() => setOpen(false)} footer={<>
          <Button variant="secondary" onClick={() => { setOpen(false); setStaffCredentialsUnlocked(false); }}>Cancel</Button>
          <Button type="submit" form="staff-create-form" disabled={saving}>{saving ? 'Adding…' : 'Add Staff'}</Button>
        </>}>
          <form id="staff-create-form" autoComplete="off" onSubmit={event => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const submitted = {
              name: String(values.get('new-staff-full-name') || form.name),
              role: String(values.get('new-staff-role') || form.role),
              chair: String(values.get('new-staff-chair') || form.chair),
              phone: String(values.get('new-staff-login-phone') || form.phone),
              pin: String(values.get('new-staff-login-pin') || form.pin),
              branchId: String(values.get('new-staff-branch') || form.branchId),
              monthlySalary: String(values.get('new-staff-monthly-salary') || form.monthlySalary),
            };
            setForm(submitted);
            void addStaff(submitted);
          }} className="space-y-4">
            <input type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px opacity-0" />
            <Field label="Full name" htmlFor="s-name"><Input id="s-name" name="new-staff-full-name" autoComplete="off" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Role" htmlFor="s-role">
              <Select id="s-role" name="new-staff-role" autoComplete="off" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, monthlySalary: e.target.value.toLowerCase().includes('reception') ? f.monthlySalary : '' }))}>
                <option>Barber</option><option>Hair Stylist</option><option>Nail Technician</option><option>Spa Therapist</option><option>Makeup Artist</option><option>Receptionist</option>
              </Select>
            </Field>
            {isReceptionRole(form.role) && <Field label="Monthly salary (KES)" htmlFor="s-monthly-salary"><Input id="s-monthly-salary" name="new-staff-monthly-salary" type="number" min="1" step="1" autoComplete="off" value={form.monthlySalary} onChange={e => setForm(f => ({ ...f, monthlySalary: e.target.value }))} placeholder="e.g. 25000" /></Field>}
            <Field label="Chair / Station" htmlFor="s-chair"><Input id="s-chair" name="new-staff-chair" autoComplete="off" value={form.chair} onChange={e => setForm(f => ({ ...f, chair: e.target.value }))} placeholder="e.g. Chair 3" /></Field>
            <Field label="Branch" htmlFor="s-branch"><Select id="s-branch" name="new-staff-branch" autoComplete="off" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>
            <Field label="Login phone number" htmlFor="s-phone"><Input id="s-phone" name="new-staff-login-phone" type="tel" inputMode="tel" autoComplete="off" readOnly={!staffCredentialsUnlocked} onFocus={() => setStaffCredentialsUnlocked(true)} value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setFormError(''); }} placeholder="+254…" /></Field>
            <Field label="4-digit login PIN" htmlFor="s-account-pin"><Input id="s-account-pin" name="new-staff-login-pin" inputMode="numeric" maxLength={4} type="password" autoComplete="new-password" readOnly={!staffCredentialsUnlocked} onFocus={() => setStaffCredentialsUnlocked(true)} value={form.pin} onChange={e => { setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })); setFormError(''); }} placeholder="4-digit PIN" /></Field>
            {formError && <p className="rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-sm text-[#b0201a]" role="alert">{formError}</p>}
            <p className="text-sm rounded-xl bg-[#0071e3]/10 text-[#0058b0] px-3 py-2">{isReceptionRole(form.role) ? 'Receptionists are paid a fixed monthly salary and do not earn service commission.' : 'Staff earn 40% commission on completed service work.'}</p>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default StaffTab;
