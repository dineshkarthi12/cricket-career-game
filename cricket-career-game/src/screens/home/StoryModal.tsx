import {
  Award,
  Flag,
  HeartPulse,
  Medal,
  Milestone,
  Star,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Modal } from '@/components';
import { CAREER_STAGES_BY_ID } from '@/data/stages';
import { formatLongDate } from '@/lib/format';
import type { CareerEvent, GameState } from '@/types';

const EVENT_ICONS: Record<CareerEvent['kind'], LucideIcon> = {
  DEBUT: Flag,
  PROMOTION: TrendingUp,
  SELECTION: Star,
  DROPPED: TrendingUp,
  INJURY: HeartPulse,
  RECOVERY: HeartPulse,
  AWARD: Award,
  MILESTONE: Milestone,
  CONTRACT: Medal,
  CAPTAINCY: Star,
  RETIREMENT: Flag,
};

/** "Watch Story" - the career so far, told through its turning points. */
export function StoryModal({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: GameState;
}) {
  const events = [...state.career.events].sort((a, b) => a.date.localeCompare(b.date));
  const name = `${state.player.firstName} ${state.player.lastName}`.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${name}'s story`}
      subtitle={`${events.length} moments on the way to ${CAREER_STAGES_BY_ID[state.career.currentStageId]?.name ?? 'the top'}`}
    >
      <ol className="relative flex flex-col gap-5 pl-7">
        <span className="absolute top-2 bottom-2 left-[13px] w-px bg-line" aria-hidden />
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.kind];
          const stage = CAREER_STAGES_BY_ID[event.stageId];
          return (
            <li key={event.id} className="relative">
              <span
                className="absolute top-0.5 -left-7 grid size-[26px] place-items-center rounded-full bg-brand-blue-soft text-brand-blue ring-4 ring-surface"
                aria-hidden
              >
                <Icon className="size-3.5" strokeWidth={2.2} />
              </span>
              <p className="text-[12px] font-medium text-ink-soft">
                {formatLongDate(event.date)}
                {stage ? ` · ${stage.shortLabel}` : ''}
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-ink">{event.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{event.detail}</p>
            </li>
          );
        })}
      </ol>

      <p className="font-hand mt-6 text-center text-[22px] text-ink-muted">
        Every great player was once a beginner.
      </p>
    </Modal>
  );
}
