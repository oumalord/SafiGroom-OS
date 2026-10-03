import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, MessageSquare, Star } from 'lucide-react';
import { PublicApi } from '../lib/api';
import { Button, Card, Field, Input, LoadingState, Select, Textarea, toast } from '../components/ui';

type EligibleAppointment = { id: string; serviceName: string; staffName: string; date: string; time: string };

export default function PublicReviewForm({ salonId }: { salonId: string }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [appointments, setAppointments] = useState<EligibleAppointment[]>([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [salonName, setSalonName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const findAppointments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() && !phone.trim()) { setError('Enter the email or phone number used when booking.'); return; }
    setLoading(true);
    setError('');
    setSearched(false);
    try {
      const result = await PublicApi.reviewAppointments(salonId, email, phone);
      setAppointments(result.items);
      setSalonName(result.salonName);
      setCustomerName(result.customerName);
      setAppointmentId(result.items[0]?.id || '');
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not find completed appointments.');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!appointmentId) { setError('Select the completed appointment you want to review.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await PublicApi.submitPublicReview({ salonId, email, phone, appointmentId, rating, comment });
      setSubmitted(true);
      toast('Thank you for your review!', 'success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#071a3d] via-[#102951] to-[#087f9f] p-4">
      <Card className="w-full max-w-xl p-5 sm:p-8">
        {submitted ? (
          <div className="py-8 text-center"><CheckCircle2 size={48} className="mx-auto text-[#34C759]" aria-hidden="true" /><h1 className="mt-4 text-2xl font-semibold">Thank you, {customerName}!</h1><p className="mt-2 text-sm text-[#6E6E73]">Your feedback has been shared with {salonName}.</p></div>
        ) : <>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2F6BFF]/10 text-[#2F6BFF]"><MessageSquare size={22} aria-hidden="true" /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2F6BFF]">Customer feedback</p>
          <h1 className="mt-2 text-2xl font-semibold">Review your visit{salonName ? ` at ${salonName}` : ''}</h1>
          <p className="mt-2 text-sm text-[#6E6E73]">Reviews are available for completed appointments. We use your booking details only to find your visit.</p>
          {!searched && <form onSubmit={findAppointments} className="mt-6 space-y-4" autoComplete="on">
            <Field label="Email used for booking" htmlFor="review-email"><Input id="review-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Or phone used for booking" htmlFor="review-phone"><Input id="review-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="0712345678" /></Field>
            {error && <p className="rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-sm text-[#b0201a]" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Finding visit…' : 'Find my completed visit'}</Button>
          </form>}
          {loading && <LoadingState label="Checking completed appointments…" />}
          {searched && !appointments.length && <div className="mt-6 rounded-2xl bg-[#F5F7FA] p-4"><p className="font-medium">No reviewable visits found</p><p className="mt-1 text-sm text-[#6E6E73]">Check the booking email or phone, and make sure your appointment has been marked completed by the salon.</p><Button variant="secondary" size="sm" className="mt-3" onClick={() => setSearched(false)}>Try different details</Button></div>}
          {searched && appointments.length > 0 && <form onSubmit={submitReview} className="mt-6 space-y-4">
            <div className="rounded-2xl bg-[#F5F7FA] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#6E6E73]">Customer details</p><p className="mt-1 font-semibold">{customerName}</p>{email && <p className="text-sm text-[#6E6E73]">{email}</p>}{phone && <p className="text-sm text-[#6E6E73]">{phone}</p>}</div>
            <Field label="Completed appointment" htmlFor="review-appointment"><Select id="review-appointment" value={appointmentId} onChange={event => setAppointmentId(event.target.value)}>{appointments.map(appointment => <option key={appointment.id} value={appointment.id}>{appointment.serviceName} · {appointment.date} {appointment.time} · {appointment.staffName || 'Staff'}</option>)}</Select></Field>
            <Field label="Your rating" htmlFor="review-rating"><Select id="review-rating" value={rating} onChange={event => setRating(Number(event.target.value))}><option value={5}>5 — Excellent</option><option value={4}>4 — Good</option><option value={3}>3 — Okay</option><option value={2}>2 — Needs improvement</option><option value={1}>1 — Poor</option></Select></Field>
            <div className="flex gap-1 text-[#D89B00]" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={20} className={index < rating ? 'fill-current' : 'text-black/15'} aria-hidden="true" />)}</div>
            <Field label="Comments (optional)" htmlFor="review-comment"><Textarea id="review-comment" rows={4} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder="Tell us about your experience…" /></Field>
            {error && <p className="rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-sm text-[#b0201a]" role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Submit review'}</Button><Button type="button" variant="secondary" onClick={() => setSearched(false)}>Change booking details</Button></div>
          </form>}
        </>}
      </Card>
    </div>
  );
}
