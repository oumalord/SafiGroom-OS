import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { AuthApi } from '../lib/api';
import { Button, Card, Field, Input, ToastHost, toast } from './ui';

export default function StaffPinGate({ name, onComplete, onLogout }: { name: string; onComplete: () => void; onLogout: () => void }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) { setError('Choose a new PIN with exactly 4 digits.'); return; }
    if (pin !== confirmPin) { setError('The PIN entries do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      await AuthApi.changeStaffPin(pin);
      toast('Your new PIN is saved.', 'success');
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your PIN. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#071a3d] via-[#102951] to-[#087f9f] p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F6BFF]/10 text-[#2F6BFF]"><KeyRound size={22} aria-hidden="true" /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F6BFF]">One-time setup</p>
        <h1 className="mt-2 text-2xl font-semibold">Choose your personal PIN</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6E6E73]">Welcome, {name}. For security, change the temporary PIN before opening your staff portal. Use a private 4-digit PIN you can remember.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" autoComplete="off">
          <Field label="New 4-digit PIN" htmlFor="staff-new-pin"><Input id="staff-new-pin" name="staff-new-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} pattern="[0-9]{4}" required value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} placeholder="••••" /></Field>
          <Field label="Confirm new PIN" htmlFor="staff-confirm-pin"><Input id="staff-confirm-pin" name="staff-confirm-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} pattern="[0-9]{4}" required value={confirmPin} onChange={event => { setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }} placeholder="••••" /></Field>
          {error && <p className="rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-sm text-[#b0201a]" role="alert">{error}</p>}
          <div className="rounded-xl bg-[#0071e3]/[0.07] p-3 text-xs text-[#52627a]"><ShieldCheck size={14} className="mr-1 inline" aria-hidden="true" />Your PIN is stored as a secure hash and can’t be viewed by the salon.</div>
          <Button type="submit" disabled={saving || pin.length !== 4 || confirmPin.length !== 4} className="w-full">{saving ? 'Saving PIN…' : 'Save PIN and continue'}</Button>
        </form>
        <button type="button" onClick={onLogout} className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#6E6E73] hover:text-[#1D1D1F]"><LogOut size={13} aria-hidden="true" />Log out</button>
      </Card>
      <ToastHost />
    </div>
  );
}
