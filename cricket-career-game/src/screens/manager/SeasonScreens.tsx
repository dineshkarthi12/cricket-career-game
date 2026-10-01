/** The season's screens: fixtures and calendar, the points table and playoffs, awards, the season summary and the legacy. */
import { CalendarDays, Landmark, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, EmptyState, ProgressBar } from '@/components';
import { ACHIEVEMENTS, MANAGER, fixtureDate, legacySummary, mvpPoints, netRunRate, rankStandings } from '@/engine/manager';
import type { ManagerFixture } from '@/types/manager';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DataTable, FranchiseCrest, InfoCard, LinkButton, Money, PageHeader, StatLine, ToneBadge, nameOf, shortOf, useManager } from './ui';

const STAGE_LABEL: Record<ManagerFixture['stage'], string> = { LEAGUE: 'League', QUALIFIER_1: 'Qualifier 1', ELIMINATOR: 'Eliminator', QUALIFIER_2: 'Qualifier 2', FINAL: 'Final' };

export function FixturesScreen() {
  const { state } = useManager();
  const mine = state.season.fixtures.filter((f) => f.homeId === state.franchiseId || f.awayId === state.franchiseId);
  if (!state.season.fixtures.length) {
    return (
      <div className="pb-4">
        <PageHeader title="Fixtures & calendar" />
        <EmptyState icon={CalendarDays} title="No fixtures yet" message="The league schedule is published in pre-season, after the auction." />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Fixtures & calendar" subtitle={`Season ${state.season.year} · ${MANAGER.rules.leagueRounds} league rounds, then the playoffs`} />
      <Card>
        <CardHeader title="Your matches" className="mb-2" />
        <ul className="grid gap-2">
          {mine.map((f) => {
            const opponent = f.homeId === state.franchiseId ? f.awayId : f.homeId;
            const r = f.result;
            const won = r?.winnerId === state.franchiseId;
            const ready = !r && ((state.season.phase === 'LEAGUE' && f.round === state.season.round) || (state.season.phase === 'PLAYOFFS' && f.stage !== 'LEAGUE'));
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-page px-3 py-2">
                <span className="w-24 text-[12px] text-ink-muted">{formatLongDate(fixtureDate(state.season.year, f.round))}</span>
                <span className="w-20 text-[12px] font-semibold text-ink-muted">{f.stage === 'LEAGUE' ? `Round ${f.round}` : STAGE_LABEL[f.stage]}</span>
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
                  <LinkButton to={`/manager/match/${f.id}`} className="min-h-9">Prepare</LinkButton>
                ) : (
                  <span className="text-[12px] text-ink-muted">Upcoming</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader title="All results" className="mb-2" />
        <DataTable caption="All fixtures" head={['Round', 'Home', 'Away', 'Result']}>
          {state.season.fixtures.filter((f) => f.result).slice(-30).reverse().map((f) => (
            <tr key={f.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-1.5">{f.stage === 'LEAGUE' ? f.round : STAGE_LABEL[f.stage]}</td>
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
  const { state } = useManager();
  const table = rankStandings(state.season.standings);
  const playoffs = state.season.fixtures.filter((f) => f.stage !== 'LEAGUE');
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Points table & playoffs" subtitle="Two points a win, one for a no-result. Ties on points split by net run rate. The top four go through." />
      <Card>
        {table.length === 0 ? (
          <p className="text-[13px] text-ink-muted">The table starts with the league.</p>
        ) : (
          <DataTable caption={`Points table ${state.season.year}`} head={['#', 'Team', 'P', 'W', 'L', 'NR', 'NRR', 'Pts']}>
            {table.map((r, i) => (
              <tr key={r.franchiseId} className={cn('border-b border-line/60 last:border-0', r.franchiseId === state.franchiseId && 'bg-brand-blue-soft/60 font-semibold')}>
                <td className="px-2 py-2">{i + 1}{i < MANAGER.rules.playoffTeams ? <span className="sr-only"> (playoff place)</span> : null}</td>
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
          <CardHeader title="Playoffs" className="mb-2" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {playoffs.map((f) => (
              <li key={f.id} className="rounded-xl bg-page px-3 py-2">
                <p className="text-[12px] font-semibold text-ink-muted">{STAGE_LABEL[f.stage]}</p>
                <p className="text-[13.5px] font-semibold text-ink">{shortOf(state, f.homeId)} v {shortOf(state, f.awayId)}</p>
                <p className="text-[12.5px] text-ink-muted">{f.result ? `${shortOf(state, f.result.winnerId)} won · ${f.result.summary}` : 'To be played'}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

export function AwardsScreen() {
  const { state } = useManager();
  const history = [...state.awardsHistory].reverse();
  const leaders = Object.values(state.players).filter((p) => p.season.matches > 0);
  const top = (by: (p: (typeof leaders)[number]) => number) => [...leaders].sort((a, b) => by(b) - by(a)).slice(0, 5);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Awards & records" />
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title="Orange Cap race">
          {top((p) => p.season.runs).map((p) => <StatLine key={p.id} label={`${p.name} (${shortOf(state, p.contract?.franchiseId)})`} value={p.season.runs} />)}
        </InfoCard>
        <InfoCard title="Purple Cap race">
          {top((p) => p.season.wickets).map((p) => <StatLine key={p.id} label={`${p.name} (${shortOf(state, p.contract?.franchiseId)})`} value={p.season.wickets} />)}
        </InfoCard>
        <InfoCard title="Most valuable player">
          {top(mvpPoints).map((p) => <StatLine key={p.id} label={`${p.name} (${shortOf(state, p.contract?.franchiseId)})`} value={mvpPoints(p)} />)}
        </InfoCard>
      </div>
      <Card>
        <CardHeader title="Records" className="mb-2" />
        <StatLine label="Highest total by your sides" value={state.records.highestTotal ? `${state.records.highestTotal.runs} (${state.records.highestTotal.season})` : '-'} />
        <StatLine label="Best value signing" value={state.records.bestSigning ? `${nameOf(state, state.records.bestSigning.playerId)} (${state.records.bestSigning.season})` : '-'} />
      </Card>
      <Card>
        <CardHeader title="Honours board" className="mb-2" />
        {history.length === 0 ? (
          <EmptyState icon={Trophy} title="No completed seasons" message="Champions and caps appear here after each final." />
        ) : (
          <DataTable caption="Season awards" head={['Season', 'Champions', 'Runners-up', 'Orange Cap', 'Purple Cap', 'MVP', 'Emerging']}>
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
  const { state } = useManager();
  const last = state.history[state.history.length - 1];
  if (!last) {
    return (
      <div className="pb-4">
        <PageHeader title="Season summary" />
        <EmptyState icon={Trophy} title="No season summary yet" message="Finish a season to see its summary." action={{ label: 'Home', to: '/manager' }} />
      </div>
    );
  }
  const verdictTone = last.boardVerdict === 'PROMOTED' ? 'green' : last.boardVerdict === 'SACKED' ? 'red' : last.boardVerdict === 'WARNED' ? 'orange' : 'blue';
  const awards = state.awardsHistory.find((a) => a.season === last.season);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={`Season ${last.season} summary`} subtitle={`${state.franchises[last.franchiseId].name} · ${MANAGER.ranks.label[last.rank]}`}>
        <LinkButton to="/manager" variant="gold">Continue</LinkButton>
      </PageHeader>
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title="Results">
          <StatLine label="League position" value={last.position || '-'} />
          <StatLine label="Won / lost" value={`${last.won} / ${last.lost}`} />
          <StatLine label="Finish" value={last.result.replace('_', ' ').toLowerCase()} />
          <StatLine label="Champions" value={shortOf(state, awards?.champions)} />
        </InfoCard>
        <InfoCard title="The board">
          <p className="mb-2"><ToneBadge tone={verdictTone}>{last.boardVerdict.toLowerCase()}</ToneBadge></p>
          <StatLine label="Objectives met" value={`${last.objectivesMet} / ${last.objectivesTotal}`} />
          <StatLine label="Reputation change" value={`${last.reputationChange >= 0 ? '+' : ''}${last.reputationChange}`} />
          <StatLine label="Profit" value={<Money lakh={last.profit} className={last.profit < 0 ? 'text-brand-red' : 'text-brand-green'} />} />
        </InfoCard>
        <InfoCard title="Players">
          <StatLine label="Top scorer" value={nameOf(state, last.topScorerId)} hint={last.topScorerId ? `${state.players[last.topScorerId]?.history.at(-1)?.runs ?? state.players[last.topScorerId]?.season.runs ?? 0} runs` : undefined} />
          <StatLine label="Top wicket-taker" value={nameOf(state, last.topWicketTakerId)} />
          <StatLine label="Best signing" value={nameOf(state, last.bestSigningId)} />
          <StatLine label="Orange / Purple Cap" value={`${nameOf(state, awards?.orangeCap?.playerId)} / ${nameOf(state, awards?.purpleCap?.playerId)}`} />
        </InfoCard>
      </div>
      <Card>
        <CardHeader title="Objectives" className="mb-2" />
        <ul className="grid gap-1 text-[13px]">
          {(state.season.year === last.season ? state.season.objectives : []).map((o) => (
            <li key={o.id}>{o.met ? '✓' : '✗'} {o.label}</li>
          ))}
        </ul>
        {state.season.year !== last.season ? <p className="text-[12.5px] text-ink-muted">A new season is under way - see your career page for this season's objectives.</p> : null}
      </Card>
    </div>
  );
}

export function LegacyScreen() {
  const { state } = useManager();
  const l = legacySummary(state);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Legacy" subtitle={state.profile.retired ? `${state.profile.name} retired after the ${state.profile.retiredSeason} season.` : 'Your career so far, season by season.'} />
      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title="Career record">
          <StatLine label="Seasons" value={l.seasons} />
          <StatLine label="Matches won" value={`${l.won} of ${l.played} (${l.winRate}%)`} />
          <StatLine label="Titles / finals / playoffs" value={`${l.titles} / ${l.finals} / ${l.playoffs}`} />
          <StatLine label="Total profit" value={<Money lakh={l.totalProfit} />} />
        </InfoCard>
        <InfoCard title="Reputation">
          <p className="mb-1 text-[22px] font-bold">{Math.round(state.profile.reputation)}</p>
          <ProgressBar value={state.profile.reputation} tone="gold" label="Reputation" />
          <p className="mt-2 text-[12.5px] text-ink-muted">Elite at {MANAGER.milestones.eliteReputation}. Dynasty at {MANAGER.milestones.dynastyTitles} titles.</p>
        </InfoCard>
        <InfoCard title="Achievements">
          {l.achievements.length ? (
            <ul className="grid gap-1 text-[13px]">{l.achievements.map((a) => <li key={a}>🏅 {a}</li>)}</ul>
          ) : (
            <p className="text-[12.5px] text-ink-muted">Still to come: {Object.values(ACHIEVEMENTS).slice(0, 3).join(', ')}…</p>
          )}
        </InfoCard>
      </div>
      <Card>
        <CardHeader title="Season by season" className="mb-2" />
        {state.history.length === 0 ? (
          <EmptyState icon={Landmark} title="The story starts this season" message="Each finished season is written here." />
        ) : (
          <DataTable caption="Season history" head={['Season', 'Franchise', 'Role', 'Pos', 'W-L', 'Finish', 'Profit', 'Board']}>
            {state.history.map((h) => (
              <tr key={h.season} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold">{h.season}</td>
                <td className="px-2 py-2">{shortOf(state, h.franchiseId)}</td>
                <td className="px-2 py-2">{MANAGER.ranks.label[h.rank]}</td>
                <td className="px-2 py-2">{h.position}</td>
                <td className="px-2 py-2">{h.won}-{h.lost}</td>
                <td className="px-2 py-2">{h.result.replace('_', ' ').toLowerCase()}</td>
                <td className="px-2 py-2"><Money lakh={h.profit} /></td>
                <td className="px-2 py-2">{h.boardVerdict.toLowerCase()}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <InfoCard title="Best signing">
          <p className="text-[13px]">{l.bestSigning ? `${l.bestSigning.name} - a bargain in ${state.records.bestSigning?.season}.` : 'Not yet.'}</p>
        </InfoCard>
        <InfoCard title="Scouting discoveries">
          <p className="text-[13px]">{l.discoveries.length ? l.discoveries.map((p) => p.name).join(', ') : 'None yet - find a prospect and sign him from trials.'}</p>
        </InfoCard>
      </div>
    </div>
  );
}
