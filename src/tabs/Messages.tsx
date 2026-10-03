import { useEffect, useRef, useState } from 'react';
import { FileText, LockKeyhole, MessageSquare, MoreVertical, Paperclip, Reply, Send, ShieldCheck, X } from 'lucide-react';
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

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/3gpp', 'audio/x-m4a',
  'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/octet-stream',
]);

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Messages({ role, accountId }: { role: Role; accountId: string }) {
  const [channel, setChannel] = useState<ChatChannel>('team');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<{ name: string; mimeType: string; size: number; data: string } | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentData, setAttachmentData] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestedMedia = useRef(new Set<string>());
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

  const loadMedia = async (attachmentId: string) => {
    if (requestedMedia.current.has(attachmentId)) return;
    requestedMedia.current.add(attachmentId);
    setLoadingMedia(current => ({ ...current, [attachmentId]: true }));
    try {
      const media = await MessagesApi.media(attachmentId);
      setAttachmentData(current => ({ ...current, [attachmentId]: `data:${media.mimeType};base64,${media.data}` }));
    } catch (cause) {
      requestedMedia.current.delete(attachmentId);
      toast(cause instanceof Error ? cause.message : 'Could not open this attachment.', 'error');
    } finally {
      setLoadingMedia(current => ({ ...current, [attachmentId]: false }));
    }
  };

  const chooseAttachment = (file?: File) => {
    if (!file) return;
    const mimeType = file.type || 'application/octet-stream';
    if (!ACCEPTED_ATTACHMENT_TYPES.has(mimeType)) {
      toast('This file type is not supported. Choose an image, audio/video file, PDF, or common document.', 'error');
      return;
    }
    if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
      toast('Attachments must be 2 MB or smaller.', 'error');
      return;
    }
    setAttachmentLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma < 0) {
        toast('Could not read this attachment.', 'error');
        setAttachmentLoading(false);
        return;
      }
      setAttachment({ name: file.name, mimeType, size: file.size, data: result.slice(comma + 1) });
      setAttachmentLoading(false);
    };
    reader.onerror = () => {
      toast('Could not read this attachment.', 'error');
      setAttachmentLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const send = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || sending || attachmentLoading) return;
    setSending(true);
    try {
      await MessagesApi.send({ channel, text: trimmed, replyToId: replyTo?.id, attachment: attachment || undefined });
      setText('');
      setReplyTo(null);
      setAttachment(null);
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
                          {message.text && <span className={message.attachment ? 'block' : undefined}>{message.text}</span>}
                          {message.attachment && <div className={message.text ? 'mt-2' : undefined}>
                            {attachmentData[message.attachment.id] ? <>
                              {message.attachment.mimeType.startsWith('image/') && <a href={attachmentData[message.attachment.id]} download={message.attachment.name} className="block"><img src={attachmentData[message.attachment.id]} alt={message.attachment.name} className="max-h-64 max-w-full rounded-xl object-contain" /></a>}
                              {message.attachment.mimeType.startsWith('video/') && <video controls preload="metadata" src={attachmentData[message.attachment.id]} className="max-h-64 max-w-full rounded-xl" />}
                              {message.attachment.mimeType.startsWith('audio/') && <audio controls preload="metadata" src={attachmentData[message.attachment.id]} className="max-w-full" />}
                              {!message.attachment.mimeType.startsWith('image/') && !message.attachment.mimeType.startsWith('video/') && !message.attachment.mimeType.startsWith('audio/') && <a href={attachmentData[message.attachment.id]} download={message.attachment.name} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs underline ${ownMessage ? 'bg-white/10 text-white' : 'bg-black/5 text-[#1D1D1F]'}`}><FileText size={16} aria-hidden="true" /><span>{message.attachment.name} · {formatFileSize(message.attachment.size)}</span></a>}
                            </> : <button type="button" disabled={loadingMedia[message.attachment.id]} onClick={() => void loadMedia(message.attachment!.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs underline disabled:opacity-60 ${ownMessage ? 'bg-white/10 text-white' : 'bg-black/5 text-[#1D1D1F]'}`}><FileText size={15} aria-hidden="true" />{loadingMedia[message.attachment.id] ? `Loading ${message.attachment.name}…` : `Open ${message.attachment.name} · ${formatFileSize(message.attachment.size)}`}</button>}
                          </div>}
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
          {attachment && <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[#F5F7FA] px-3 py-2"><div className="flex min-w-0 items-center gap-2 text-xs text-[#30343b]"><FileText size={16} className="shrink-0 text-[#2F6BFF]" aria-hidden="true" /><span className="truncate">{attachment.name} · {formatFileSize(attachment.size)}</span></div><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="rounded-full p-1 hover:bg-black/5"><X size={15} /></button></div>}
          <div className="flex items-end gap-2 sm:gap-3">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,video/*,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onChange={event => { chooseAttachment(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            <button type="button" aria-label="Attach a file or media" title="Attach a file or media (max 2 MB)" onClick={() => fileInputRef.current?.click()} disabled={sending || attachmentLoading} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[#6E6E73] hover:bg-black/5 disabled:opacity-40"><Paperclip size={18} aria-hidden="true" /></button>
            <Textarea aria-label="Message text" placeholder={replyTo ? 'Write a reply…' : 'Write a message to your team…'} rows={1} maxLength={2000} value={text} onChange={event => setText(event.target.value)} className="max-h-32 min-h-[44px] resize-y rounded-2xl bg-[#FAFAFC] py-3" />
            <Button type="submit" aria-label="Send message" disabled={(!text.trim() && !attachment) || sending || attachmentLoading} className="h-11 w-11 shrink-0 rounded-2xl p-0">{sending || attachmentLoading ? <span className="text-xs">…</span> : <Send size={17} aria-hidden="true" />}</Button>
          </div>
          <p className="mt-2 text-[10px] text-[#8b8f98]">Attach images, audio, video, PDFs, or common documents up to 2 MB.</p>
        </form>
        <div className="flex justify-between gap-3 px-5 pb-3 text-[10px] text-[#8b8f98] sm:px-6"><span>Updates automatically · messages are permanently deleted after 7 days</span><span className="shrink-0">{text.length}/2000</span></div>
      </Card>
    </div>
  );
}

export default Messages;
