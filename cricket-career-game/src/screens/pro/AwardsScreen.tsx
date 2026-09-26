import { useState } from 'react';
import { Award, Crown, Globe, Lock, Medal, Star, Target, Trophy as TrophyIcon, type LucideIcon } from 'lucide-react';
import { Badge, Card, CardHeader, StatTile, Tabs, type BadgeTone } from '@/components';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { AwardKind, GameState, Trophy, TrophyTier } from '@/types';

const ICONS: Record<string, LucideIcon> = { Trophy: TrophyIcon, Award, Crown, Globe, Medal, Star, Target };

const TIER_TONE: Record<TrophyTier, BadgeTone> = { BRONZE: 'orange', SILVER: 'grey', GOLD: 'gold', PLATINUM: 'blue' };

const KIND_LABEL: Record<AwardKind, string> = {
  PLAYER_OF_SERIES: 'Player of the series',
  PLAYER_OF_TOURNAMENT: 'Player of the tournament',
  TOURNAMENT_TOP_SCORER: 'Top scorer',
  TOURNAMENT_TOP_WICKETS: 'Leading wicket-taker',
  PLAYER_OF_YEAR: 'Cricketer of the Year',
  TEST_PLAYER_OF_YEAR: 'Test Player of the Year',
  ODI_PLAYER_OF_YEAR: 'ODI Player of the Year',
  T20I_PLAYER_OF_YEAR: 'T20I Player of the Year',
  EMERGING_PLAYER: 'Emerging Player',
  IPL_MVP: 'IPL MVP',
  IPL_ORANGE_CAP: 'Orange Cap',
  IPL_PURPLE_CAP: 'Purple Cap',
  DOMESTIC_CRICKETER_OF_YEAR: 'Domestic Cricketer of the Year',
};

const TABS = [
  { id: 'cabinet', label: 'Trophy cabinet' },
  { id: 'awards', label: 'Awards' },
  { id: 'seasons', label: 'By season' },
  { id: 'milestones', label: 'Milestones' },
];

export default function AwardsScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Awards state={state} />;
}

function Awards({ state }: { state: GameState }) {
  const [tab, setTab] = useState('cabinet');
  const unlocked = state.trophies.filter((t) => t.unlocked);
  const awards = state.pro?.awards ?? [];
  const titles = unlocked.filter((t) => t.kind === 'TEAM_TITLE').length;
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Awards</h1>
        <p className="text-[13px] text-ink-muted">The trophy cabinet, individual awards, and the milestones along the way.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Trophies" value={`${unlocked.length}/${state.trophies.length}`} />
        <StatTile label="Titles" value={titles} />
        <StatTile label="Individual awards" value={awards.length} />
        <StatTile label="Player of the match" value={state.player.record.manOfTheMatch} />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Award sections" />
      {tab === 'cabinet' ? <Cabinet trophies={state.trophies} /> : null}
      {tab === 'awards' ? (
        <Card>
          <CardHeader title="Individual awards" subtitle="Series, tournaments, the IPL and the annual awards night" className="mb-2" />
          {awards.length === 0 ? <p className="text-[13px] text-ink-muted">No individual awards yet - player of the series, the Orange and Purple Caps and the annual awards come with the professional game.</p> : null}
          <ul className="flex flex-col gap-1.5">
            {[...awards].reverse().map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-tile bg-page px-3 py-2 text-[13px]">
                <Badge tone={a.kind.includes('YEAR') ? 'gold' : a.kind.startsWith('IPL') ? 'orange' : 'blue'}>{KIND_LABEL[a.kind]}</Badge>
                <span className="font-semibold text-ink">{a.title}</span>
                <span className="text-ink-muted">{a.detail}</span>
                <span className="ml-auto text-[12px] text-ink-muted">{formatLongDate(a.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === 'seasons' ? (
        <Card>
          <CardHeader title="Season by season" className="mb-2" />
          {state.career.seasonReviews.length === 0 ? <p className="text-[13px] text-ink-muted">Awards are listed here at the end of each season.</p> : null}
          <ul className="flex flex-col gap-2">
            {[...state.career.seasonReviews].reverse().map((r) => (
              <li key={r.seasonYear} className="rounded-tile bg-page px-3 py-2 text-[13px]">
                <span className="font-semibold text-ink">{r.label}</span> <span className="text-ink-muted">· {r.headline}</span>
                {r.awards.length ? <p className="mt-1 text-ink">{r.awards.join(' · ')}</p> : <p className="mt-1 text-ink-muted">No awards.</p>}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === 'milestones' ? (
        <Card>
          <CardHeader title="Milestones" subtitle="Debuts, caps, contracts, captaincy and records" className="mb-2" />
          <ul className="flex flex-col gap-1.5">
            {[...state.career.events].filter((e) => ['DEBUT', 'MILESTONE', 'CONTRACT', 'CAPTAINCY', 'AWARD', 'RETIREMENT', 'PROMOTION'].includes(e.kind)).reverse().slice(0, 60).map((e) => (
              <li key={e.id} className="flex gap-3 text-[13px]">
                <span className="w-28 shrink-0 text-ink-muted">{formatLongDate(e.date)}</span>
                <span className="text-ink"><span className="font-semibold">{e.title}</span> - {e.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Cabinet({ trophies }: { trophies: Trophy[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {trophies.map((t) => {
        const Icon = ICONS[t.icon] ?? TrophyIcon;
        return (
          <Card key={t.id} className={cn('flex flex-col items-center gap-1.5 text-center', !t.unlocked && 'opacity-80')}>
            {t.unlocked ? <Icon className="size-9 text-[#C79400]" strokeWidth={1.6} aria-hidden /> : <Lock className="size-9 text-ink-soft" strokeWidth={1.6} aria-hidden />}
            <p className={cn('text-[13px] font-semibold', t.unlocked ? 'text-ink' : 'text-ink-muted')}>{t.name}</p>
            <Badge tone={TIER_TONE[t.tier]} className="text-[11px]">{t.tier.toLowerCase()}</Badge>
            <p className="text-[11.5px] text-ink-muted">{t.unlocked ? `${t.description}${t.seasonYear ? ` (${t.seasonYear})` : ''}` : t.hint}</p>
          </Card>
        );
      })}
    </div>
  );
}
