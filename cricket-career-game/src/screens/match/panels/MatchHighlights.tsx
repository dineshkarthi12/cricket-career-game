/**
 * The match in its big moments, for batters, bowlers and all-rounders alike:
 * every fifty and hundred, every three-for and five-for, the tight spells,
 * the all-round doubles and any hat-trick - plus your own line, always. Built
 * from the scorecards, so it works for every match, even archived ones.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { Card, CardHeader, Tabs } from '@/components';
import { MATCH_FORMATS } from '@/engine/config';
import { cn } from '@/lib/cn';
import { inningsHighlights } from '@/lib/highlights';
import type { Match } from '@/types';
import { tr } from '@/i18n/core';
import { useT } from '@/i18n/react';

export type ReelKind = 'HUNDRED' | 'FIFTY' | 'FIVE_FOR' | 'THREE_FOR' | 'TIGHT' | 'ALL_ROUND' | 'HAT_TRICK' | 'YOU';

export interface ReelItem {
  kind: ReelKind;
  playerId: string;
  label: string;
  text: string;
  /** Sort weight: the bigger the moment, the higher. */
  weight: number;
}

const TONE: Record<ReelKind, string> = {
  HUNDRED: 'bg-brand-gold text-brand-navy',
  FIFTY: 'bg-brand-blue text-white',
  FIVE_FOR: 'bg-brand-red text-white',
  THREE_FOR: 'bg-brand-red/80 text-white',
  TIGHT: 'bg-brand-green text-white',
  ALL_ROUND: 'bg-brand-gold text-brand-navy',
  HAT_TRICK: 'bg-brand-red text-white',
  YOU: 'bg-brand-navy text-white',
};

/** A spell tight enough to be a highlight, by format: overs at least, economy at most. */
function tightSpell(format: string): { overs: number; economy: number } {
  if (format === 'T20') return { overs: 3, economy: 6 };
  if (format === 'MULTI_DAY' || format === 'TEST') return { overs: 15, economy: 2 };
  return { overs: 7, economy: 4 };
}

/** The reel for a match, biggest moments first. */
export function matchReel(match: Match, teamNameOf: (id: string) => string, userId: string | null): ReelItem[] {
  const out: ReelItem[] = [];
  const totals = new Map<string, { name: string; runs: number; balls: number; wickets: number; conceded: number; overs: number }>();
  const tally = (id: string, name: string) => {
    const t = totals.get(id) ?? { name, runs: 0, balls: 0, wickets: 0, conceded: 0, overs: 0 };
    totals.set(id, t);
    return t;
  };
  const tight = tightSpell(match.format);
  const limited = MATCH_FORMATS[match.format]?.overs !== null;

  for (const inn of match.innings) {
    const side = teamNameOf(inn.battingTeamId);
    for (const b of inn.batting) {
      const t = tally(b.playerId, b.name);
      t.runs += b.runs;
      t.balls += b.balls;
      if (b.runs >= 50) {
        const hundred = b.runs >= 100;
        out.push({
          kind: hundred ? 'HUNDRED' : 'FIFTY',
          playerId: b.playerId,
          label: hundred ? '100' : '50',
          text: `${b.name} ${b.runs}${b.out ? '' : '*'} (${b.balls}) · ${b.fours}x4, ${b.sixes}x6${limited ? ` · SR ${b.balls ? Math.round((b.runs / b.balls) * 100) : 0}` : ''}${tr('reel.for', { side })}`,
          weight: b.runs,
        });
      }
    }
    for (const w of inn.bowling) {
      const t = tally(w.playerId, w.name);
      t.wickets += w.wickets;
      t.conceded += w.runsConceded;
      t.overs += w.balls / 6;
      const figures = `${w.wickets}/${w.runsConceded} (${w.overs})`;
      if (w.wickets >= 3) {
        out.push({
          kind: w.wickets >= 5 ? 'FIVE_FOR' : 'THREE_FOR',
          playerId: w.playerId,
          label: `${w.wickets}W`,
          text: `${w.name} ${figures}${w.maidens ? tr(w.maidens === 1 ? 'reel.maiden' : 'reel.maidens', { n: w.maidens }) : ''} · ${tr('reel.econ', { e: w.economy.toFixed(2) })}`,
          weight: 40 + w.wickets * 14,
        });
      } else if (w.balls / 6 >= tight.overs && w.economy <= tight.economy) {
        out.push({ kind: 'TIGHT', playerId: w.playerId, label: tr('reel.label.TIGHT'), text: tr('reel.squeezed', { name: w.name, figures, e: w.economy.toFixed(2) }), weight: 35 });
      }
    }
    // Hat-tricks need the ball-by-ball, which only recent matches keep.
    if (inn.deliveries.length) {
      for (const list of inningsHighlights(inn.deliveries).values()) {
        for (const h of list) {
          if (h.kind === 'HAT_TRICK' && h.playerId) {
            out.push({ kind: 'HAT_TRICK', playerId: h.playerId, label: tr('reel.label.HAT_TRICK'), text: tr('reel.hatTrick', { name: totals.get(h.playerId)?.name ?? tr('reel.aBowler') }), weight: 200 });
          }
        }
      }
    }
  }

  for (const [id, t] of totals) {
    if (t.runs >= 50 && t.wickets >= 3) {
      out.push({ kind: 'ALL_ROUND', playerId: id, label: tr('reel.label.ALL_ROUND'), text: tr('reel.double', { name: t.name, runs: t.runs, wickets: t.wickets }), weight: 150 });
    } else if (t.runs >= 30 && t.wickets >= 2) {
      out.push({ kind: 'ALL_ROUND', playerId: id, label: tr('reel.label.BOTH'), text: tr('reel.both', { name: t.name, runs: t.runs, figures: `${t.wickets}/${t.conceded}` }), weight: 45 });
    }
  }

  // Your line, always there even on a quiet day.
  if (userId) {
    const t = totals.get(userId);
    if (t && !out.some((r) => r.playerId === userId)) {
      const bat = t.balls > 0 ? `${t.runs} (${t.balls})` : null;
      const bowl = t.overs > 0 ? `${t.wickets}/${t.conceded} (${tr('reel.ov', { n: Math.round(t.overs * 10) / 10 })})` : null;
      out.push({ kind: 'YOU', playerId: userId, label: tr('reel.label.YOU'), text: tr('reel.you', { line: [bat, bowl].filter(Boolean).join(' & ') || tr('reel.nothing') }), weight: 0 });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

const FILTERS = [{ id: 'all' }, { id: 'bat' }, { id: 'bowl' }, { id: 'you' }] as const;

const BAT: ReelKind[] = ['HUNDRED', 'FIFTY', 'ALL_ROUND'];
const BOWL: ReelKind[] = ['FIVE_FOR', 'THREE_FOR', 'TIGHT', 'HAT_TRICK', 'ALL_ROUND'];

/**
 * `replay` (the animated reel, for matches that kept their ball-by-ball)
 * becomes a tab beside the big moments, and opens first.
 */
export function MatchHighlights({ match, teamNameOf, userId, replay }: { match: Match; teamNameOf: (id: string) => string; userId: string | null; replay?: ReactNode }) {
  const t = useT();
  const reel = useMemo(() => matchReel(match, teamNameOf, userId), [match, teamNameOf, userId]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [view, setView] = useState<'replay' | 'moments'>(replay ? 'replay' : 'moments');
  const shown = reel.filter((r) =>
    filter === 'all' ? true : filter === 'you' ? r.playerId === userId : filter === 'bat' ? BAT.includes(r.kind) : BOWL.includes(r.kind),
  );

  return (
    <Card>
      <CardHeader title={t('reel.title')} subtitle={replay && view === 'replay' ? t('reel.subReplay') : t('reel.subMoments')} />
      {replay ? (
        <Tabs
          tabs={[
            { id: 'replay', label: t('reel.tab.replay') },
            { id: 'moments', label: t('reel.tab.moments') },
          ]}
          value={view}
          onChange={(id) => setView(id as 'replay' | 'moments')}
          label={t('reel.view')}
          className="mt-2.5 [&>button]:px-3 [&>button]:text-[12.5px]"
        />
      ) : null}
      {replay && view === 'replay' ? <div className="mt-3">{replay}</div> : (
      <>
      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={t('reel.filter')}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors',
              filter === f.id ? 'bg-brand-blue text-white' : 'border border-line bg-surface text-ink hover:bg-page',
            )}
          >
            {t(`reel.f.${f.id}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-muted">{t('reel.empty')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {shown.slice(0, 14).map((r, i) => (
            <li
              key={`${r.kind}-${r.playerId}-${i}`}
              className={cn('flex items-center gap-2.5 rounded-lg bg-page px-2.5 py-2', r.playerId === userId && 'ring-2 ring-brand-gold')}
            >
              <span className={cn('flex min-w-[52px] shrink-0 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-bold', TONE[r.kind])}>
                {r.kind !== 'YOU' && r.kind !== 'TIGHT' ? <Star className="size-3 fill-current" aria-hidden /> : null}
                {r.label}
              </span>
              <span className="min-w-0 text-[12.5px] leading-snug text-ink">{r.text}</span>
              {r.playerId === userId && r.kind !== 'YOU' ? <span className="ml-auto shrink-0 text-[10px] font-bold tracking-wide text-[#8a6a00]">{t('m.you')}</span> : null}
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </Card>
  );
}
