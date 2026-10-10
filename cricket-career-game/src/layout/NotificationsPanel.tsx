import { useT } from '@/i18n/react';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { relativeInGameDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SENDER_STYLE } from '@/screens/home/InboxCard';

/** How many messages the panel lists (important first, then newest). */
const SHOWN = 30;

/**
 * The bell in the top bar: the unread count, and on a tap (or click) the
 * inbox - selectors, coach, media, franchises. Opening a message marks it
 * read; "Mark all read" clears the count. Closes on a tap outside, Escape
 * or a change of screen.
 */
export function NotificationsPanel() {
  const state = useGameStore((s) => s.state);
  const update = useGameStore((s) => s.update);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const t = useT();
  const inbox = state?.inbox ?? [];
  const unread = inbox.filter((m) => !m.read).length;
  const messages = [...inbox]
    .sort((a, b) => Number(!b.read && b.important) - Number(!a.read && a.important) || b.date.localeCompare(a.date))
    .slice(0, SHOWN);

  const markRead = (id: string) =>
    update((s) => (s.inbox.some((m) => m.id === id && !m.read) ? { ...s, inbox: s.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)) } : s));
  const markAllRead = () => update((s) => (s.inbox.some((m) => !m.read) ? { ...s, inbox: s.inbox.map((m) => (m.read ? m : { ...m, read: true })) } : s));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative grid size-10 place-items-center rounded-xl text-ink transition-colors hover:bg-surface"
        aria-label={t('notify.button', { n: unread })}
      >
        <Bell className="size-[19px]" strokeWidth={1.8} />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-brand-red text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('notify.title')}
          className="fixed top-16 right-3 z-50 flex max-h-[min(calc(var(--vh)*70),560px)] w-[min(380px,calc(var(--vw)*100-24px))] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card md:absolute md:top-12 md:right-0"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-[14px] font-semibold text-ink">
              {t('notify.title')} <span className="font-normal text-ink-muted">{t('notify.unread', { n: unread })}</span>
            </p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-brand-blue hover:bg-brand-blue-soft disabled:text-ink-soft disabled:hover:bg-transparent"
            >
              <CheckCheck className="size-3.5" aria-hidden /> {t('notify.markAll')}
            </button>
          </div>
          {messages.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">{t('notify.none')}</p>
          ) : (
            <ul className="flex-1 overflow-y-auto overscroll-contain p-2">
              {messages.map((m) => {
                const style = SENDER_STYLE[m.sender];
                const isOpen = expanded === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setExpanded(isOpen ? null : m.id);
                        markRead(m.id);
                      }}
                      aria-expanded={isOpen}
                      className={cn('flex w-full items-start gap-2.5 rounded-tile px-2.5 py-2 text-left transition-colors hover:bg-page', !m.read && 'bg-brand-blue-soft/60')}
                    >
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', style.tile)} aria-hidden>
                        <style.icon className="size-[17px]" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-[12.5px] text-ink', m.read ? 'font-medium' : 'font-bold')}>{m.senderName}</span>
                          <span className="shrink-0 text-[10.5px] text-ink-soft">{state ? relativeInGameDate(m.date, state.season.currentDate) : ''}</span>
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-[1.35] text-ink-muted">{m.subject}</span>
                        {isOpen ? <span className="mt-1.5 block text-[12px] leading-[1.45] whitespace-pre-line text-ink">{m.body}</span> : null}
                      </span>
                      <ChevronDown className={cn('mt-1 size-3.5 shrink-0 text-ink-soft transition-transform', isOpen && 'rotate-180')} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
