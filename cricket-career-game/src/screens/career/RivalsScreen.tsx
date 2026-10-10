/**
 * AI rivals: the players competing with you for a place at each of your
 * sides, with their rating, form, fitness and this season's figures. They
 * develop on their own through the simulated seasons.
 */
import { useLang, useT } from '@/i18n/react';
import { tr } from '@/i18n/core';
import { Badge, Card, CardHeader } from '@/components';
import { rivalGroups, type RivalGroup } from '@/engine/career/rivals';
import { roleLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

export default function RivalsScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{tr('common.loadingCareer')}</p>;
  return <Rivals state={state} />;
}

function Rivals({ state }: { state: GameState }) {
  const t = useT();
  const groups = rivalGroups(state);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('nav.rivals')}</h1>
        <p className="text-[13px] text-ink-muted">{t('car.rivals.intro')}</p>
      </div>
      {groups.length === 0 ? (
        <Card>
          <p className="text-[13px] text-ink-muted">{t('car.rivals.none')}</p>
        </Card>
      ) : (
        groups.map((g) => <GroupCard key={g.teamId} group={g} />)
      )}
    </div>
  );
}

function GroupCard({ group }: { group: RivalGroup }) {
  const t = useT();
  const lang = useLang();
  return (
    <Card>
      <CardHeader
        title={group.teamName}
        subtitle={t('car.rivals.rank', { rank: lang === 'ta' ? t('car.rivals.ord', { n: group.userRank }) : ordinal(group.userRank), n: group.rows.length })}
        className="mb-3"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <caption className="sr-only">{t('car.rivals.caption', { team: group.teamName })}</caption>
          <thead className="text-[11px] tracking-wide text-ink-soft uppercase">
            <tr>
              <th scope="col" className="py-1.5 pr-2">#</th>
              <th scope="col" className="py-1.5 pr-2">{t('m.player')}</th>
              <th scope="col" className="py-1.5 pr-2">{t('car.rivals.rating')}</th>
              <th scope="col" className="py-1.5 pr-2">{t('hero.form')}</th>
              <th scope="col" className="py-1.5 pr-2">{t('hero.fitness')}</th>
              <th scope="col" className="py-1.5 pr-2">M</th>
              <th scope="col" className="py-1.5 pr-2">{t('car.rivals.runsAvg')}</th>
              <th scope="col" className="py-1.5 pr-2">{t('car.rivals.wkts')}</th>
              <th scope="col" className="py-1.5">{t('car.col.selectors')}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r, i) => (
              <tr key={r.id} className={cn('border-t border-line', r.isUser && 'bg-brand-gold/15 font-semibold')}>
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2">
                  <span className="text-ink">{r.name}</span>
                  {r.isUser ? <Badge tone="gold" className="ml-1.5 text-[10.5px]">{t('car.you')}</Badge> : null}
                  {r.direct ? <Badge tone="red" className="ml-1.5 text-[10.5px]">{t('car.rivals.direct')}</Badge> : null}
                  {r.injured ? <Badge tone="orange" className="ml-1.5 text-[10.5px]">{t('car.rivals.injured')}</Badge> : null}
                  <span className="block text-[11.5px] font-normal text-ink-muted">
                    {roleLabel(r.role)} · {r.age}
                  </span>
                </td>
                <td className="py-2 pr-2">{r.overall}</td>
                <td className="py-2 pr-2">{r.form}</td>
                <td className="py-2 pr-2">{r.fitness}</td>
                <td className="py-2 pr-2">{r.matches}</td>
                <td className="py-2 pr-2">
                  {r.runs}
                  {r.battingAverage !== null ? ` (${r.battingAverage})` : ''}
                </td>
                <td className="py-2 pr-2">{r.wickets}</td>
                <td className="py-2">{r.selectorFavour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
