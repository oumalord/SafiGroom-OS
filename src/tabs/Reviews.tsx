import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Download, MessageSquare, QrCode, RefreshCw, Star } from 'lucide-react';
import { BranchesApi, ReviewsApi } from '../lib/api';
import { Badge, Button, Card, EmptyState, LoadingState, toast } from '../components/ui';
import type { Branch, Review } from '../types';

function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [qrError, setQrError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [allReviews, allBranches] = await Promise.all([ReviewsApi.list(), BranchesApi.list()]);
      setReviews([...allReviews].sort((a, b) => b.createdAt - a.createdAt));
      setBranches(allBranches);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not load reviews.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const salonId = branches[0]?.salonId;
  const average = useMemo(() => reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0, [reviews]);
  const recommendationRate = useMemo(() => {
    const answered = reviews.filter(review => typeof review.survey?.wouldReturn === 'boolean');
    return answered.length ? Math.round(answered.filter(review => review.survey?.wouldReturn === true).length * 100 / answered.length) : null;
  }, [reviews]);

  const createQr = async () => {
    if (!salonId) { setQrError('No salon is available for this account.'); return; }
    const url = `${window.location.origin}/?review=${encodeURIComponent(salonId)}`;
    try {
      setReviewUrl(url);
      setQrDataUrl(await QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#102951', light: '#ffffff' } }));
      setQrError('');
    } catch {
      setQrError('Could not generate the review QR code.');
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'safigroom-customer-review-qr.png';
    link.click();
  };

  if (loading) return <LoadingState label="Loading customer reviews…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#2F6BFF]">Customer voice</p><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><MessageSquare size={21} aria-hidden="true" />Reviews</h1><p className="mt-1 text-sm text-[#6E6E73]">Feedback from completed customer appointments.</p></div>
        <Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw size={14} aria-hidden="true" />Refresh</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="p-5"><p className="text-xs text-[#6E6E73]">Reviews received</p><p className="mt-1 text-2xl font-semibold">{reviews.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-[#6E6E73]">Average rating</p><p className="mt-1 flex items-center gap-2 text-2xl font-semibold">{reviews.length ? average.toFixed(1) : '—'}<span className="text-[#D89B00]">★</span></p></Card>
        <Card className="p-5"><p className="text-xs text-[#6E6E73]">Would return</p><p className="mt-1 text-2xl font-semibold">{recommendationRate === null ? '—' : `${recommendationRate}%`}</p></Card>
      </div>

      <Card className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div><div className="flex items-center gap-2"><QrCode size={19} className="text-[#2F6BFF]" aria-hidden="true" /><h2 className="font-semibold">Customer review QR code</h2></div><p className="mt-2 max-w-2xl text-sm text-[#6E6E73]">Download and display this QR code at checkout. Customers scan it, verify their booking by email or phone, then review one of their completed visits.</p>{qrError && <p className="mt-2 text-sm text-[#b0201a]" role="alert">{qrError}</p>}{reviewUrl && <p className="mt-2 break-all text-xs text-[#6E6E73]">{reviewUrl}</p>}</div>
        <div className="flex gap-2 sm:justify-end"><Button onClick={() => void createQr()}><QrCode size={15} aria-hidden="true" />{qrDataUrl ? 'Refresh QR' : 'Generate QR'}</Button>{qrDataUrl && <Button variant="secondary" onClick={downloadQr}><Download size={15} aria-hidden="true" />Download PNG</Button>}</div>
        {qrDataUrl && <img src={qrDataUrl} alt="QR code linking to the customer review form" className="h-36 w-36 rounded-xl border border-black/10 bg-white p-2 sm:col-start-2" />}
      </Card>

      {reviews.length === 0 ? <EmptyState icon={Star} title="No reviews received yet" description="Share the review QR code with customers after completed appointments. Their feedback and survey details will appear here." /> : (
        <div className="space-y-3">
          {reviews.map(review => <Card key={review.id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="font-semibold">{review.customerName}</p><p className="mt-0.5 text-sm text-[#6E6E73]">{review.serviceName || 'Service'}{review.staffName ? ` · ${review.staffName}` : ''}</p></div>
              <div className="flex items-center gap-2"><span className="text-sm tracking-wide text-[#D89B00]">{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}{'☆'.repeat(Math.max(0, 5 - review.rating))}</span><Badge tone="warning">{review.rating}/5</Badge><span className="text-xs text-[#6E6E73]">{new Date(review.createdAt).toLocaleString()}</span></div>
            </div>
            {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#30343b]">{review.comment}</p>}
            {review.survey && <div className="mt-3 flex flex-wrap gap-2">{review.survey.cleanliness !== undefined && <Badge tone="info">Cleanliness: {review.survey.cleanliness}/5</Badge>}{review.survey.friendliness !== undefined && <Badge tone="info">Friendliness: {review.survey.friendliness}/5</Badge>}{typeof review.survey.wouldReturn === 'boolean' && <Badge tone={review.survey.wouldReturn ? 'success' : 'warning'}>{review.survey.wouldReturn ? 'Would return' : 'Would not return'}</Badge>}</div>}
          </Card>)}
        </div>
      )}
    </div>
  );
}

export default Reviews;
