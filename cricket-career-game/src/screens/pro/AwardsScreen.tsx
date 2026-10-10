import { useState } from 'react';
import { Award, Crown, Globe, Lock, Medal, Star, Target, Trophy as TrophyIcon, type LucideIcon } from 'lucide-react';
import { Badge, Card, CardHeader, StatTile, Tabs, type BadgeTone } from '@/components';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import type { AwardKind, GameState, Trophy, TrophyTier } from '@/types';

const ICONS: Record<string, LucideIcon> = { Trophy: TrophyIcon, Award, Crown, Globe, Medal, Star, Target };

const TIER_TONE: Record<TrophyTier, BadgeTone> = { BRONZE: 'orange', SILVER: 'grey', GOLD: 'gold', PLATINUM: 'blue' };

/** An award's name, by kind: `pro.award.<kind>`. */
const kindKey = (kind: AwardKind) => `pro.award.${kind}` as Key;

const TABS: { id: string; key: Key }[] = [
  { id: 'cabinet', key: 'pro.aw.tab.cabinet' },
  { id: 'awards', key: 'nav.awards' },
  { id: 'seasons', key: 'pro.aw.tab.seasons' },
  { id: 'milestones', key: 'pro.aw.tab.milestones' },
];

export default function AwardsScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
  return <Awards state={state} />;
}

function Awards({ state }: { state: GameState }) {
  const [tab, setTab] = useState('cabinet');
  const t = useT();
  const unlocked = state.trophies.filter((t) => t.unlocked);
  const awards = state.pro?.awards ?? [];
  const titles = unlocked.filter((t) => t.kind === 'TEAM_TITLE').length;
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('nav.awards')}</h1>
        <p className="text-[13px] text-ink-muted">{t('pro.aw.intro')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label={t('pro.aw.trophies')} value={`${unlocked.length}/${state.trophies.length}`} />
        <StatTile label={t('pro.aw.titles')} value={titles} />
        <StatTile label={t('pro.aw.individual')} value={awards.length} />
        <StatTile label={t('pro.aw.potm')} value={state.player.record.manOfTheMatch} />
      </div>
      <Tabs tabs={TABS.map((x) => ({ id: x.id, label: t(x.key) }))} value={tab} onChange={setTab} label={t('pro.aw.tabsLabel')} />
      {tab === 'cabinet' ? <Cabinet trophies={state.trophies} /> : null}
      {tab === 'awards' ? (
        <Card>
          <CardHeader title={t('pro.aw.individual')} subtitle={t('pro.aw.individualSub')} className="mb-2" />
          {awards.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.aw.none')}</p> : null}
          <ul className="flex flex-col gap-1.5">
            {[...awards].reverse().map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-tile bg-page px-3 py-2 text-[13px]">
                <Badge tone={a.kind.includes('YEAR') ? 'gold' : a.kind.startsWith('IPL') ? 'orange' : 'blue'}>{t(kindKey(a.kind))}</Badge>
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
          <CardHeader title={t('pro.aw.seasonBySeason')} className="mb-2" />
          {state.career.seasonReviews.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.aw.listedEnd')}</p> : null}
          <ul className="flex flex-col gap-2">
            {[...state.career.seasonReviews].reverse().map((r) => (
              <li key={r.seasonYear} className="rounded-tile bg-page px-3 py-2 text-[13px]">
                <span className="font-semibold text-ink">{r.label}</span> <span className="text-ink-muted">· {r.headline}</span>
                {r.awards.length ? <p className="mt-1 text-ink">{r.awards.join(' · ')}</p> : <p className="mt-1 text-ink-muted">{t('pro.aw.noAwards')}</p>}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === 'milestones' ? (
        <Card>
          <CardHeader title={t('pro.aw.tab.milestones')} subtitle={t('pro.aw.milestonesSub')} className="mb-2" />
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
  const tx = useT();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {trophies.map((t) => {
        const Icon = ICONS[t.icon] ?? TrophyIcon;
        return (
          <Card key={t.id} className={cn('flex flex-col items-center gap-1.5 text-center', !t.unlocked && 'opacity-80')}>
            {t.unlocked ? <Icon className="size-9 text-[#C79400]" strokeWidth={1.6} aria-hidden /> : <Lock className="size-9 text-ink-soft" strokeWidth={1.6} aria-hidden />}
            <p className={cn('text-[13px] font-semibold', t.unlocked ? 'text-ink' : 'text-ink-muted')}>{t.name}</p>
            <Badge tone={TIER_TONE[t.tier]} className="text-[11px]">{tx(`pro.trophyTier.${t.tier}` as Key)}</Badge>
            <p className="text-[11.5px] text-ink-muted">{t.unlocked ? `${t.description}${t.seasonYear ? ` (${t.seasonYear})` : ''}` : t.hint}</p>
          </Card>
        );
      })}
    </div>
  );
}
