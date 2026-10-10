/** The season's screens: fixtures and calendar, the points table and playoffs, awards, the season summary and the legacy. */
import { CalendarDays, Landmark, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, EmptyState, ProgressBar } from '@/components';
import { ACHIEVEMENTS, MANAGER, fixtureDate, legacySummary, mvpPoints, netRunRate, rankStandings } from '@/engine/manager';
import type { ManagerFixture } from '@/types/manager';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { isKey, tr, type Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { DataTable, FranchiseCrest, InfoCard, LinkButton, Money, PageHeader, StatLine, ToneBadge, nameOf, rankLabel, shortOf, useManager } from './ui';

/** A fixture's stage: "League", "Qualifier 1", "Final". */
const stageLabel = (stage: ManagerFixture['stage']) => tr(`mgr.stage.${stage}` as Key);
/** An achievement, by id or (older saves) by its English label. */
const achievementLabel = (id: string) => (isKey(`mgr.ach.${id}`) ? tr(`mgr.ach.${id}` as Key) : (ACHIEVEMENTS[id] ?? id));

export function FixturesScreen() {
  const t = useT();
  const { state } = useManager();
  const mine = state.season.fixtures.filter((f) => f.homeId === state.franchiseId || f.awayId === state.franchiseId);
  if (!state.season.fixtures.length) {
    return (
      <div className="pb-4">
        <PageHeader title={t('mgr.fix.title')} />
        <EmptyState icon={CalendarDays} title={t('mgr.fix.none')} message={t('mgr.fix.noneBody')} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.fix.title')} subtitle={`${t('mgr.seasonN', { year: state.season.year })} · ${t('mgr.fix.rounds', { n: MANAGER.rules.leagueRounds })}`} />
      <Card>
        <CardHeader title={t('mgr.fix.yours')} className="mb-2" />
        <ul className="grid gap-2">
          {mine.map((f) => {
            const opponent = f.homeId === state.franchiseId ? f.awayId : f.homeId;
            const r = f.result;
            const won = r?.winnerId === state.franchiseId;
            const ready = !r && ((state.season.phase === 'LEAGUE' && f.round === state.season.round) || (state.season.phase === 'PLAYOFFS' && f.stage !== 'LEAGUE'));
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-page px-3 py-2">
                <span className="w-24 text-[12px] text-ink-muted">{formatLongDate(fixtureDate(state.season.year, f.round))}</span>
                <span className="w-20 text-[12px] font-semibold text-ink-muted">{f.stage === 'LEAGUE' ? t('mgr.roundN', { n: f.round }) : stageLabel(f.stage)}</span>
                <span className="flex flex-1 items-center gap-2 text-[13px] font-semibold text-ink">
                  <FranchiseCrest franchise={state.franchises[opponent]} size={24} />
                  {f.homeId === state.franchiseId ? 'v' : '@'} {shortOf(state, opponent)}
                </span>
                {r ? (
                  <Link to={`/manager/match/${f.id}/report`} className="flex items-center gap-2 text-[12.5px]">
                    <ToneBadge tone={r.noResult ? 'grey' : won ? 'green' : 'red'}>{r.noResult ? 'NR' : won ? 'W' : 'L'}</ToneBadge>
                    <span className="text-ink-muted">{r.summary}</span>
                  </Link>
                ) : ready ? (
                  <LinkButton to={`/manager/match/${f.id}`} className="min-h-9">{t('mgr.fix.prepare')}</LinkButton>
                ) : (
                  <span className="text-[12px] text-ink-muted">{t('mgr.fix.upcoming')}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t('mgr.fix.allResults')} className="mb-2" />
        <DataTable caption={t('mgr.fix.allCaption')} head={[t('mgr.col.round'), t('mgr.col.home'), t('mgr.col.away'), t('mgr.col.result')]}>
          {state.season.fixtures.filter((f) => f.result).slice(-30).reverse().map((f) => (
            <tr key={f.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-1.5">{f.stage === 'LEAGUE' ? f.round : stageLabel(f.stage)}</td>
              <td className="px-2 py-1.5">{shortOf(state, f.homeId)} {f.result!.homeRuns}/{f.result!.homeWickets}</td>
              <td className="px-2 py-1.5">{shortOf(state, f.awayId)} {f.result!.awayRuns}/{f.result!.awayWickets}</td>
              <td className="px-2 py-1.5 text-ink-muted">{f.result!.winnerId ? `${shortOf(state, f.result!.winnerId)} ${f.result!.summary.toLowerCase()}` : f.result!.summary}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

export function TableScreen() {
  const t = useT();
  const { state } = useManager();
  const table = rankStandings(state.season.standings);
  const playoffs = state.season.fixtures.filter((f) => f.stage !== 'LEAGUE');
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.table.title')} subtitle={t('mgr.table.sub')} />
      <Card>
        {table.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t('mgr.home.tableLater')}</p>
        ) : (
          <DataTable caption={`${t('mgr.pointsTable')} ${state.season.year}`} head={['#', t('mgr.col.team'), 'P', 'W', 'L', 'NR', 'NRR', 'Pts']}>
            {table.map((r, i) => (
              <tr key={r.franchiseId} className={cn('border-b border-line/60 last:border-0', r.franchiseId === state.franchiseId && 'bg-brand-blue-soft/60 font-semibold')}>
                <td className="px-2 py-2">{i + 1}{i < MANAGER.rules.playoffTeams ? <span className="sr-only"> {t('mgr.table.playoffPlace')}</span> : null}</td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    <FranchiseCrest franchise={state.franchises[r.franchiseId]} size={22} />
                    {state.franchises[r.franchiseId].name}
                    {i < MANAGER.rules.playoffTeams ? <ToneBadge tone="green">Q</ToneBadge> : null}
                  </span>
                </td>
                <td className="px-2 py-2 tabular-nums">{r.played}</td>
                <td className="px-2 py-2 tabular-nums">{r.won}</td>
                <td className="px-2 py-2 tabular-nums">{r.lost}</td>
                <td className="px-2 py-2 tabular-nums">{r.noResult}</td>
                <td className="px-2 py-2 tabular-nums">{netRunRate(r) >= 0 ? '+' : ''}{netRunRate(r).toFixed(3)}</td>
                <td className="px-2 py-2 font-bold tabular-nums">{r.points}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      {playoffs.length ? (
        <Card>
          <CardHeader title={t('mgr.phase.PLAYOFFS')} className="mb-2" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {playoffs.map((f) => (
              <li key={f.id} className="rounded-xl bg-page px-3 py-2">
                <p className="text-[12px] font-semibold text-ink-muted">{stageLabel(f.stage)}</p>
                <p className="text-[13.5px] font-semibold text-ink">{shortOf(state, f.homeId)} v {shortOf(state, f.awayId)}</p>
                <p className="text-[12.5px] text-ink-muted">{f.result ? `${t('mgr.table.won', { team: shortOf(state, f.result.winnerId) })} · ${f.result.summary}` : t('mgr.table.toPlay')}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export function AwardsScreen() {
  const t = useT();
  const { state } = useManager();
  const history = [...state.awardsHistory].reverse();
  const leaders = Object.values(state.players).filter((p) => p.season.matches > 0);
  const top = (by: (p: (typeof leaders)[number]) => number) => [...leaders].sort((a, b) => by(b) - by(a)).slice(0, 5);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.aw.title')} />
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title={t('mgr.aw.orangeRace')}>
          {top((p) => p.season.runs).map((p) => <StatLine key={p.id} label={`${p.name} (${shortOf(state, p.contract?.franchiseId)})`} value={p.season.runs} />)}
        </InfoCard>
        <InfoCard title={t('mgr.aw.purpleRace')}>
          {top((p) => p.season.wickets).map((p) => <StatLine key={p.id} label={`${p.name} (${shortOf(state, p.contract?.franchiseId)})`} value={p.season.wickets} />)}
        </InfoCard>
        <InfoCard title={t('mgr.aw.mvp')}>
          {top(mvpPoints).map((p) => <StatLine key={p.id} label={`${p.name} (${shortOf(state, p.contract?.franchiseId)})`} value={mvpPoints(p)} />)}
        </InfoCard>
      </div>
      <Card>
        <CardHeader title={t('mgr.aw.records')} className="mb-2" />
        <StatLine label={t('mgr.aw.highest')} value={state.records.highestTotal ? `${state.records.highestTotal.runs} (${state.records.highestTotal.season})` : '-'} />
        <StatLine label={t('mgr.aw.bestValue')} value={state.records.bestSigning ? `${nameOf(state, state.records.bestSigning.playerId)} (${state.records.bestSigning.season})` : '-'} />
      </Card>
      <Card>
        <CardHeader title={t('mgr.aw.honours')} className="mb-2" />
        {history.length === 0 ? (
          <EmptyState icon={Trophy} title={t('mgr.aw.none')} message={t('mgr.aw.noneBody')} />
        ) : (
          <DataTable caption={t('mgr.home.seasonAwards')} head={[t('mgr.col.season'), t('mgr.champions'), t('mgr.aw.runnersUp'), t('mgr.orangeCap'), t('mgr.purpleCap'), 'MVP', t('mgr.aw.emerging')]}>
            {history.map((a) => (
              <tr key={a.season} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold">{a.season}</td>
                <td className="px-2 py-2">{shortOf(state, a.champions)}</td>
                <td className="px-2 py-2">{shortOf(state, a.runnersUp)}</td>
                <td className="px-2 py-2">{nameOf(state, a.orangeCap?.playerId)} {a.orangeCap ? `(${a.orangeCap.runs})` : ''}</td>
                <td className="px-2 py-2">{nameOf(state, a.purpleCap?.playerId)} {a.purpleCap ? `(${a.purpleCap.wickets})` : ''}</td>
                <td className="px-2 py-2">{nameOf(state, a.mvp?.playerId)}</td>
                <td className="px-2 py-2">{nameOf(state, a.emerging?.playerId)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}

export function SeasonSummaryScreen() {
  const t = useT();
  const { state } = useManager();
  const last = state.history[state.history.length - 1];
  if (!last) {
    return (
      <div className="pb-4">
        <PageHeader title={t('mgr.sum.title')} />
        <EmptyState icon={Trophy} title={t('mgr.sum.none')} message={t('mgr.sum.noneBody')} action={{ label: t('mgr.nav.home'), to: '/manager' }} />
      </div>
    );
  }
  const verdictTone = last.boardVerdict === 'PROMOTED' ? 'green' : last.boardVerdict === 'SACKED' ? 'red' : last.boardVerdict === 'WARNED' ? 'orange' : 'blue';
  const awards = state.awardsHistory.find((a) => a.season === last.season);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.sum.titleN', { year: last.season })} subtitle={`${state.franchises[last.franchiseId].name} · ${rankLabel(last.rank)}`}>
        <LinkButton to="/manager" variant="gold">{t('mgr.cont.continue')}</LinkButton>
      </PageHeader>
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title={t('mgr.sum.results')}>
          <StatLine label={t('mgr.sum.position')} value={last.position || '-'} />
          <StatLine label={t('mgr.sum.wonLost')} value={`${last.won} / ${last.lost}`} />
          <StatLine label={t('mgr.sum.finish')} value={t(`mgr.finish.${last.result}`)} />
          <StatLine label={t('mgr.champions')} value={shortOf(state, awards?.champions)} />
        </InfoCard>
        <InfoCard title={t('mgr.sum.board')}>
          <p className="mb-2"><ToneBadge tone={verdictTone}>{t(`mgr.verdictB.${last.boardVerdict}`)}</ToneBadge></p>
          <StatLine label={t('mgr.sum.objMet')} value={`${last.objectivesMet} / ${last.objectivesTotal}`} />
          <StatLine label={t('mgr.sum.repChange')} value={`${last.reputationChange >= 0 ? '+' : ''}${last.reputationChange}`} />
          <StatLine label={t('mgr.sum.profit')} value={<Money lakh={last.profit} className={last.profit < 0 ? 'text-brand-red' : 'text-brand-green'} />} />
        </InfoCard>
        <InfoCard title={t('mgr.nav.players')}>
          <StatLine label={t('mgr.sum.topScorer')} value={nameOf(state, last.topScorerId)} hint={last.topScorerId ? t('mgr.sum.runsN', { n: state.players[last.topScorerId]?.history.at(-1)?.runs ?? state.players[last.topScorerId]?.season.runs ?? 0 }) : undefined} />
          <StatLine label={t('mgr.sum.topWickets')} value={nameOf(state, last.topWicketTakerId)} />
          <StatLine label={t('mgr.sum.bestSigning')} value={nameOf(state, last.bestSigningId)} />
          <StatLine label={t('mgr.sum.caps')} value={`${nameOf(state, awards?.orangeCap?.playerId)} / ${nameOf(state, awards?.purpleCap?.playerId)}`} />
        </InfoCard>
      </div>
      <Card>
        <CardHeader title={t('mgr.sum.objectives')} className="mb-2" />
        <ul className="grid gap-1 text-[13px]">
          {(state.season.year === last.season ? state.season.objectives : []).map((o) => (
            <li key={o.id}>{o.met ? '✓' : '✗'} {o.label}</li>
          ))}
        </ul>
        {state.season.year !== last.season ? <p className="text-[12.5px] text-ink-muted">{t('mgr.sum.newSeason')}</p> : null}
      </Card>
    </div>
  );
}

export function LegacyScreen() {
  const t = useT();
  const { state } = useManager();
  const l = legacySummary(state);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.nav.legacy')} subtitle={state.profile.retired ? t('mgr.leg.retired', { name: state.profile.name, year: state.profile.retiredSeason ?? '' }) : t('mgr.leg.sub')} />
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title={t('mgr.leg.record')}>
          <StatLine label={t('mgr.leg.seasons')} value={l.seasons} />
          <StatLine label={t('mgr.leg.won')} value={t('mgr.leg.wonOf', { won: l.won, played: l.played, pct: l.winRate })} />
          <StatLine label={t('mgr.prof.tfp')} value={`${l.titles} / ${l.finals} / ${l.playoffs}`} />
          <StatLine label={t('mgr.leg.totalProfit')} value={<Money lakh={l.totalProfit} />} />
        </InfoCard>
        <InfoCard title={t('mgr.reputation')}>
          <p className="mb-1 text-[22px] font-bold">{Math.round(state.profile.reputation)}</p>
          <ProgressBar value={state.profile.reputation} tone="gold" label={t('mgr.reputation')} />
          <p className="mt-2 text-[12.5px] text-ink-muted">{t('mgr.leg.elite', { rep: MANAGER.milestones.eliteReputation, n: MANAGER.milestones.dynastyTitles })}</p>
        </InfoCard>
        <InfoCard title={t('mgr.leg.achievements')}>
          {state.profile.achievements.length ? (
            <ul className="grid gap-1 text-[13px]">{state.profile.achievements.map((a) => <li key={a}>🏅 {achievementLabel(a)}</li>)}</ul>
          ) : (
            <p className="text-[12.5px] text-ink-muted">{t('mgr.leg.toCome', { list: Object.keys(ACHIEVEMENTS).slice(0, 3).map(achievementLabel).join(', ') })}</p>
          )}
        </InfoCard>
      </div>
      <Card>
        <CardHeader title={t('mgr.leg.bySeason')} className="mb-2" />
        {state.history.length === 0 ? (
          <EmptyState icon={Landmark} title={t('mgr.leg.story')} message={t('mgr.leg.storyBody')} />
        ) : (
          <DataTable caption={t('mgr.leg.history')} head={[t('mgr.col.season'), t('mgr.start.franchise'), t('mgr.col.role'), t('mgr.col.pos'), 'W-L', t('mgr.sum.finish'), t('mgr.sum.profit'), t('mgr.board')]}>
            {state.history.map((h) => (
              <tr key={h.season} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold">{h.season}</td>
                <td className="px-2 py-2">{shortOf(state, h.franchiseId)}</td>
                <td className="px-2 py-2">{rankLabel(h.rank)}</td>
                <td className="px-2 py-2">{h.position}</td>
                <td className="px-2 py-2">{h.won}-{h.lost}</td>
                <td className="px-2 py-2">{t(`mgr.finish.${h.result}`)}</td>
                <td className="px-2 py-2"><Money lakh={h.profit} /></td>
                <td className="px-2 py-2">{t(`mgr.verdictB.${h.boardVerdict}`)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <InfoCard title={t('mgr.sum.bestSigning')}>
          <p className="text-[13px]">{l.bestSigning ? t('mgr.leg.bargain', { name: l.bestSigning.name, year: state.records.bestSigning?.season ?? '' }) : t('mgr.leg.notYet')}</p>
        </InfoCard>
        <InfoCard title={t('mgr.leg.discoveries')}>
          <p className="text-[13px]">{l.discoveries.length ? l.discoveries.map((p) => p.name).join(', ') : t('mgr.leg.noDiscoveries')}</p>
        </InfoCard>
      </div>
    </div>
  );
}
