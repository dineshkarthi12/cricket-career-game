import { Lightbulb } from 'lucide-react';
import { useAppSettings } from '@/store/appSettings';
import { cn } from '@/lib/cn';

/** Every tip in the first-time tutorial, in the order a new player meets them. */
export const TUTORIAL_TIPS = {
  dashboard: {
    title: 'Your dashboard',
    body: 'Everything starts here: your next match, form, fitness and the career path. Use Continue at the top to move the calendar on - the game stops for matches, trials and news.',
  },
  training: {
    title: 'Training',
    body: 'Pick drills for each day of the week. Drills raise skills towards your hidden potential, but they tire you - watch fitness and leave rest days, or injuries follow.',
  },
  matchControls: {
    title: 'Playing a match',
    body: 'Play one ball at a time, or jump to the end of the over or the next wicket. Sim sets the pace when you are not involved, and your captain makes the calls until you are captain yourself.',
  },
  aggression: {
    title: 'The aggression bar, 1 to 5',
    body: '1 is survival, 3 is normal cricket, 5 is all-out attack. Higher means more runs and more risk. Match it to the situation: see off the new ball, then push on when the field spreads.',
  },
  selection: {
    title: 'Selection',
    body: 'Selectors compare you with everyone in your role: recent form, skills, fitness and age. Nothing is automatic - the panel shows who is ahead of you and what would change their minds.',
  },
} as const;

export type TipId = keyof typeof TUTORIAL_TIPS;

/**
 * A short guided tip, shown the first time a screen is visited. "Got it"
 * hides it for good; "Skip tutorial" hides every tip. Settings can bring
 * them back.
 */
export function TutorialTip({ id, after, className }: { id: TipId; /** Wait until this tip has been seen. */ after?: TipId; className?: string }) {
  const seen = useAppSettings((s) => s.tipsSeen.includes(id) || (after !== undefined && !s.tipsSeen.includes(after)));
  const seeTip = useAppSettings((s) => s.seeTip);
  const setSettings = useAppSettings((s) => s.set);
  if (seen) return null;
  const tip = TUTORIAL_TIPS[id];
  const ids = Object.keys(TUTORIAL_TIPS);
  const step = ids.indexOf(id) + 1;
  return (
    <aside aria-label={`Tip: ${tip.title}`} className={cn('flex items-start gap-3 rounded-card border border-brand-blue/25 bg-brand-blue-soft px-4 py-3', className)}>
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">
          {tip.title} <span className="font-normal text-ink-muted">· tip {step} of {ids.length}</span>
        </p>
        <p className="mt-0.5 text-[13px] text-ink">{tip.body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => seeTip(id)} className="rounded-lg bg-brand-blue px-3 py-1.5 text-[12.5px] font-semibold text-white">
            Got it
          </button>
          <button type="button" onClick={() => setSettings({ tipsSeen: ids })} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-brand-blue hover:bg-white/60">
            Skip tutorial
          </button>
        </div>
      </div>
    </aside>
  );
}
