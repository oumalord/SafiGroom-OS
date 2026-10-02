import { useEffect, useState } from 'react';
import { Building2, LogIn, UserPlus } from 'lucide-react';
import { AuthApi, PublicApi } from '../lib/api';
import { Button, Card, Field, Input, Select, ToastHost, toast } from './ui';

interface SalonOption { id: string; name: string; }

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (account: any) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', salonId: '', branchId: '' });
  const [salons, setSalons] = useState<SalonOption[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [busy, setBusy] = useState(false);
  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    if (nextMode === 'signup') setForm(previous => ({ ...previous, email: '', password: '', branchId: '' }));
  };

  useEffect(() => { PublicApi.salons().then(setSalons).catch(() => {}); }, []);
  useEffect(() => {
    if (mode !== 'signup' || !form.salonId) { setBranches([]); return; }
    let active = true;
    setLoadingBranches(true);
    PublicApi.branches(form.salonId).then(items => { if (active) setBranches(items); }).catch(cause => { if (active) toast(cause instanceof Error ? cause.message : 'Could not load salon branches.', 'error'); }).finally(() => { if (active) setLoadingBranches(false); });
    return () => { active = false; };
  }, [mode, form.salonId]);

  const submit = async () => {
    if (!form.email.trim() || !form.password) { toast('Email or phone and password/PIN are required.', 'error'); return; }
    if (mode === 'signup' && (!form.salonId || !form.branchId || !form.name.trim() || !form.phone.trim() || !/^\d{4}$/.test(form.password))) { toast('Choose a salon and branch, complete your client details, and enter a 4-digit PIN.', 'error'); return; }
    setBusy(true);
    try {
      const account = mode === 'login' ? await AuthApi.login(form.email, form.password) : await AuthApi.signup(form);
      onAuthenticated(account);
    } catch (cause: any) { toast(cause?.message || 'Authentication failed.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071a3d]">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1600&q=80"
      >
        <source src="https://v1.pinimg.com/videos/iht/expMp4/62/8c/9e/628c9e4a8b30c495271a35ef16b66bbb_720w.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[#071a3d]/60 backdrop-blur-[1px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-3 sm:p-4">
        <Card className="w-full max-w-[92vw] p-4 sm:max-w-md sm:p-7 border border-white/20 bg-white/10 text-white shadow-2xl shadow-[#040b1c]/50 backdrop-blur-md">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2F6BFF] to-[#00A6D6] text-white flex items-center justify-center"><Building2 size={23} aria-hidden="true" /></div>
            <h1 className="text-2xl font-semibold mt-4 text-white">SafiGroom OS</h1>
            <p className="text-sm text-slate-200">Salon operations and customer care</p>
          </div>
          <div className="flex gap-1 bg-black/20 rounded-full p-1 mb-5 border border-white/10">
            <button className={`flex-1 rounded-full py-2 text-sm ${mode === 'login' ? 'bg-white text-[#1D1D1F] shadow-sm font-medium' : 'text-slate-200'}`} onClick={() => switchMode('login')}><LogIn size={14} className="inline mr-1" />Log in</button>
            <button className={`flex-1 rounded-full py-2 text-sm ${mode === 'signup' ? 'bg-white text-[#1D1D1F] shadow-sm font-medium' : 'text-slate-200'}`} onClick={() => switchMode('signup')}><UserPlus size={14} className="inline mr-1" />Client sign up</button>
          </div>
          <form autoComplete="off" onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-4">
            {mode === 'signup' && <>
              <Field label="Salon to visit" htmlFor="auth-salon"><Select id="auth-salon" name="signup-salon" autoComplete="off" value={form.salonId} onChange={e => setForm({ ...form, salonId: e.target.value, branchId: '' })}><option value="">Choose an existing salon</option>{salons.map(salon => <option key={salon.id} value={salon.id} className="text-[#1D1D1F] bg-white">{salon.name}</option>)}</Select></Field>
              <Field label="Branch" htmlFor="auth-branch"><Select id="auth-branch" name="signup-branch" autoComplete="off" disabled={!form.salonId || loadingBranches} value={form.branchId || ''} onChange={e => setForm({ ...form, branchId: e.target.value })}><option value="">{loadingBranches ? 'Loading branches…' : form.salonId ? 'Choose a branch' : 'Choose a salon first'}</option>{branches.map(branch => <option key={branch.id} value={branch.id} className="text-[#1D1D1F] bg-white">{branch.name}</option>)}</Select></Field>
              <Field label="Full name" htmlFor="auth-name"><Input id="auth-name" name="signup-full-name" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Phone" htmlFor="auth-phone"><Input id="auth-phone" name="signup-phone" autoComplete="off" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
            </>}
            <Field label={mode === 'login' ? 'Email or phone' : 'Email'} htmlFor="auth-email"><Input id="auth-email" name={mode === 'signup' ? 'signup-email' : 'login-identifier'} autoComplete="off" type={mode === 'signup' ? 'email' : 'text'} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={mode === 'signup' ? '4-digit PIN' : 'Password / PIN'} htmlFor="auth-password"><Input id="auth-password" name={mode === 'signup' ? 'signup-pin' : 'login-secret'} autoComplete="new-password" inputMode={mode === 'signup' ? 'numeric' : undefined} maxLength={mode === 'signup' ? 4 : undefined} pattern={mode === 'signup' ? '[0-9]{4}' : undefined} type="password" placeholder={mode === 'signup' ? '4 digits' : undefined} value={form.password} onChange={e => setForm({ ...form, password: mode === 'signup' ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value })} /></Field>
            <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create client account'}</Button>
          </form>
          <p className="text-xs text-slate-200 border-t border-white/10 mt-6 pt-5">Salon and employee accounts are created by the platform administrator or salon owner.</p>
        </Card>
        <ToastHost />
      </div>
    </div>
  );
}
