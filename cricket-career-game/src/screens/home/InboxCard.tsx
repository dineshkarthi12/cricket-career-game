import {
  Building2,
  Landmark,
  Megaphone,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { relativeInGameDate } from '@/lib/format';
import { unreadCount } from '@/lib/selectors';
import { cn } from '@/lib/cn';
import type { GameState, InboxSender } from '@/types';

const SENDER_STYLE: Record<InboxSender, { icon: LucideIcon; tile: string }> = {
  SELECTOR: { icon: Landmark, tile: 'bg-brand-navy text-white' },
  COACH: { icon: UserRound, tile: 'bg-page text-ink-muted' },
  MEDIA: { icon: Megaphone, tile: 'bg-brand-red text-white' },
  FRANCHISE: { icon: Building2, tile: 'bg-brand-blue text-white' },
  TEAM: { icon: Users, tile: 'bg-brand-blue-soft text-brand-blue' },
  PHYSIO: { icon: Stethoscope, tile: 'bg-brand-green/15 text-brand-green' },
  AGENT: { icon: UserRound, tile: 'bg-brand-gold/25 text-[#8a6a00]' },
  FAN: { icon: Users, tile: 'bg-page text-ink-muted' },
  SYSTEM: { icon: Landmark, tile: 'bg-page text-ink-muted' },
};

export function InboxCard({ state }: { state: GameState }) {
  const messages = [...state.inbox]
    .sort((a, b) => Number(b.important) - Number(a.important) || b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader
        title={`Inbox / News (${unreadCount(state)})`}
        action={{ label: 'View All', to: '/selection' }}
        className="mb-2.5"
      />
      <ul className="flex flex-col gap-1.5">
        {messages.map((message) => {
          const style = SENDER_STYLE[message.sender];
          return (
            <li
              key={message.id}
              className="flex items-start gap-2.5 rounded-tile bg-page/70 px-2.5 py-2"
            >
              <span
                className={cn('grid size-8 shrink-0 place-items-center rounded-full', style.tile)}
                aria-hidden
              >
                <style.icon className="size-[17px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-ink">
                    {message.senderName}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-ink-soft">
                    {relativeInGameDate(message.date, state.season.currentDate)}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-[1.35] text-ink-muted">
                  {message.subject}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
