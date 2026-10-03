import { useEffect, useRef, useState } from 'react';
import { LockKeyhole, MessageSquare, MoreVertical, Reply, Send, ShieldCheck, X } from 'lucide-react';
import { Button, Card, LoadingState, Textarea, toast } from '../components/ui';
import { MessagesApi } from '../lib/api';
import type { ChatChannel, ChatMessage, Role } from '../types';

function roleLabel(role: string) {
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  if (role === 'receptionist') return 'Reception';
  if (role === 'barber') return 'Staff';
  return role;
}

function Messages({ role, accountId }: { role: Role; accountId: string }) {
  const [channel, setChannel] = useState<ChatChannel>('team');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const canSeeManagement = role === 'owner' || role === 'receptionist';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    const load = async () => {
      try {
        const loaded = await MessagesApi.list(channel);
        if (alive) {
          setMessages(loaded);
          void MessagesApi.markRead().catch(() => {});
        }
      } catch (cause) {
        if (alive) setLoadError(cause instanceof Error ? cause.message : 'Could not load messages.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => { void load(); }, 4000);
    return () => { alive = false; window.clearInterval(id); };
  }, [channel]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await MessagesApi.send({ channel, text: trimmed, replyToId: replyTo?.id });
      setText('');
      setReplyTo(null);
      setLoadError('');
      setMessages(await MessagesApi.list(channel));
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Message could not be sent. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#2F6BFF]">Team workspace</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><MessageSquare size={21} aria-hidden="true" />Messages</h1>
          <p className="mt-1 text-sm text-[#6E6E73]">Quick updates and coordination between your team, reception, and the owner.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-3 py-1.5 text-xs font-medium text-[#1c7c34]"><span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />Team chat active</span>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2F6BFF]/10 to-[#00A6D6]/15 text-[#2F6BFF]">
              {channel === 'management' ? <ShieldCheck size={20} aria-hidden="true" /> : <MessageSquare size={20} aria-hidden="true" />}
            </div>
            <div>
              <h2 className="font-semibold">{channel === 'management' ? 'Management' : 'Team Chat'}</h2>
              <p className="text-xs text-[#6E6E73]">{channel === 'management' ? 'A private room for the owner and reception.' : 'Shared with staff, reception, managers, and the owner.'}</p>
            </div>
          </div>
          <div className="flex w-fit gap-1 rounded-full bg-black/5 p-1" role="group" aria-label="Message channel">
            <button type="button" onClick={() => setChannel('team')} aria-pressed={channel === 'team'} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${channel === 'team' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}>Team</button>
            {canSeeManagement && <button type="button" onClick={() => setChannel('management')} aria-pressed={channel === 'management'} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${channel === 'management' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}><LockKeyhole size={13} aria-hidden="true" />Management</button>}
          </div>
        </div>

        {channel === 'management' && <div className="flex items-center gap-2 bg-[#2F6BFF]/[0.04] px-4 py-2.5 text-xs text-[#52627a] sm:px-6"><LockKeyhole size={13} aria-hidden="true" />Only the owner and receptionist can view or send messages here.</div>}

        <div className="bg-[#FAFAFC] px-3 py-4 sm:px-6 sm:py-5">
          {loadError && <p className="mb-3 rounded-xl bg-[#FF3B30]/[0.08] px-3 py-2 text-xs text-[#b0201a]" role="alert">{loadError} <button type="button" className="ml-2 underline" onClick={() => MessagesApi.list(channel).then(loaded => { setMessages(loaded); setLoadError(''); }).catch(cause => setLoadError(cause instanceof Error ? cause.message : 'Could not load messages.'))}>Retry</button></p>}
          {loading ? <LoadingState label="Loading conversation…" /> : (
            <div className="flex min-h-[320px] max-h-[58vh] flex-col gap-4 overflow-y-auto px-1 py-2" role="log" aria-label={`${channel === 'management' ? 'Management' : 'Team'} messages`} aria-live="polite">
              {messages.length === 0 && <div className="m-auto max-w-xs py-12 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#2F6BFF] shadow-sm"><MessageSquare size={21} aria-hidden="true" /></div><p className="font-medium">Start the conversation</p><p className="mt-1 text-sm text-[#6E6E73]">Send the first update to your team.</p></div>}
              {messages.map(message => {
                const ownMessage = message.senderId === accountId;
                return (
                  <div key={message.id} className={`group flex touch-pan-y ${ownMessage ? 'justify-end' : 'justify-start'}`} onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; touchStartY.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={event => {
                    const startX = touchStartX.current;
                    const startY = touchStartY.current;
                    const endX = event.changedTouches[0]?.clientX;
                    const endY = event.changedTouches[0]?.clientY;
                    if (startX !== null && startY !== null && endX !== undefined && endY !== undefined && Math.abs(endX - startX) > 60 && Math.abs(endX - startX) > Math.abs(endY - startY)) setReplyTo(message);
                    touchStartX.current = null;
                    touchStartY.current = null;
                  }}>
                    <div className={`max-w-[88%] sm:max-w-[75%] ${ownMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`mb-1 flex items-baseline gap-2 px-1 ${ownMessage ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-semibold text-[#30343b]">{ownMessage ? 'You' : message.senderName}</span>
                        <span className="text-[10px] text-[#8b8f98]">{roleLabel(message.senderRole)} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${ownMessage ? 'rounded-br-md bg-gradient-to-br from-[#2F6BFF] to-[#1478d4] text-white shadow-sm' : 'rounded-bl-md border border-black/5 bg-white text-[#1D1D1F] shadow-sm'}`}>
                          {message.replyToText && <span className={`mb-2 block border-l-2 pl-2 text-xs ${ownMessage ? 'border-white/70 text-white/80' : 'border-[#2F6BFF] text-[#6E6E73]'}`}><span className="block font-semibold">{message.replyToSenderName || 'Message'}</span>{message.replyToText}</span>}
                          {message.text}
                        </p>
                        <details className="relative shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <summary aria-label={`Message actions for ${message.senderName}`} className="list-none cursor-pointer rounded-full p-1.5 text-[#6E6E73] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6BFF]"><MoreVertical size={15} aria-hidden="true" /></summary>
                          <div role="menu" className={`absolute top-full z-20 mt-1 w-36 rounded-xl border border-black/10 bg-white p-1 shadow-lg ${ownMessage ? 'right-0' : 'left-0'}`}>
                            <button type="button" role="menuitem" onClick={event => { setReplyTo(message); event.currentTarget.closest('details')?.removeAttribute('open'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#1D1D1F] hover:bg-black/5"><Reply size={14} aria-hidden="true" />Reply</button>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={event => { event.preventDefault(); void send(); }} className="border-t border-black/5 bg-white p-3 sm:p-4">
          {replyTo && <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border-l-2 border-[#2F6BFF] bg-[#F5F7FA] px-3 py-2"><div className="min-w-0"><p className="text-xs font-semibold text-[#2F6BFF]">Replying to {replyTo.senderName}</p><p className="truncate text-xs text-[#6E6E73]">{replyTo.text}</p></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="rounded-full p-1 hover:bg-black/5"><X size={15} /></button></div>}
          <div className="flex items-end gap-2 sm:gap-3">
            <Textarea aria-label="Message text" placeholder={replyTo ? 'Write a reply…' : 'Write a message to your team…'} rows={1} maxLength={2000} value={text} onChange={event => setText(event.target.value)} className="max-h-32 min-h-[44px] resize-y rounded-2xl bg-[#FAFAFC] py-3" />
            <Button type="submit" aria-label="Send message" disabled={!text.trim() || sending} className="h-11 w-11 shrink-0 rounded-2xl p-0"><Send size={17} aria-hidden="true" /></Button>
          </div>
        </form>
        <div className="flex justify-between gap-3 px-5 pb-3 text-[10px] text-[#8b8f98] sm:px-6"><span>Updates automatically · messages are permanently deleted after 7 days</span><span className="shrink-0">{text.length}/2000</span></div>
      </Card>
    </div>
  );
}

export default Messages;
