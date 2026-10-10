import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useT } from '@/i18n/react';
import { isKey, tr, type Key } from '@/i18n/core';
import { Badge, Card, CardHeader, Tabs } from '@/components';
import { quotient, rankOf, topRunScorers, topWicketTakers } from '@/engine/tournament';
import { formatDayMonth } from '@/lib/format';
import { summaryText } from '@/lib/matchText';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { GameState, PlayerTournamentLine, TournamentState } from '@/types';

/** A tournament stage ("Semi-final") in the app's language. */
function stageLabel(t: (key: Key) => string, stage: string): string {
  return isKey(`car.tstage.${stage}`) ? t(`car.tstage.${stage}` as Key) : stage;
}

export default function TournamentScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{tr('common.loadingCareer')}</p>;
  return <Tournaments state={state} />;
}

function Tournaments({ state }: { state: GameState }) {
  const tx = useT();
  const { tournamentId } = useParams();
  const current = state.season.tournaments.filter((t) => t.seasonYear === state.season.year);
  const [selected, setSelected] = useState(tournamentId && current.some((t) => t.tournamentId === tournamentId) ? tournamentId : current[0]?.tournamentId);
  const t = current.find((x) => x.tournamentId === selected) ?? current[0];
  const past = state.seasonHistory.flatMap((s) => s.tournaments).filter((x) => x.complete).reverse();

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{tx('nav.tournaments')}</h1>
        <p className="text-[13px] text-ink-muted">{tx('car.t.intro', { season: state.season.label })}</p>
      </div>
      {current.length === 0 ? (
        <Card><p className="text-[13px] text-ink-muted">{tx('car.t.none')}</p></Card>
      ) : (
        <Tabs tabs={current.map((x) => ({ id: x.tournamentId, label: x.name }))} value={t?.tournamentId ?? ''} onChange={setSelected} label={tx('road.competitions')} />
      )}
      {t ? <TournamentView state={state} t={t} /> : null}
      {past.length ? (
        <Card>
          <CardHeader title={tx('car.t.pastWinners')} className="mb-2" />
          <ul className="flex flex-col gap-1 text-[13px]">
            {past.slice(0, 12).map((x) => (
              <li key={`${x.tournamentId}-${x.seasonYear}`} className="flex flex-wrap gap-2">
                <span className="w-16 text-ink-muted">{x.seasonYear}-{String((x.seasonYear + 1) % 100).padStart(2, '0')}</span>
                <span className="text-ink">{x.name}:</span>
                <span className={cn('font-semibold', x.winnerTeamId === x.userTeamId ? 'text-brand-green' : 'text-ink')}>{state.teams[x.winnerTeamId ?? '']?.name ?? '-'}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function teamName(state: GameState, id: string | null) {
  return id ? (state.teams[id]?.name ?? id) : tr('nextMatch.tbc');
}

function TournamentView({ state, t }: { state: GameState; t: TournamentState }) {
  const tx = useT();
  const [onlyMine, setOnlyMine] = useState(true);
  const userId = state.player.id;
  const runRank = rankOf(t, userId, 'runs');
  const wicketRank = rankOf(t, userId, 'wickets');
  const mine = t.stats[userId];
  const firstClass = t.points === 'FIRST_CLASS';
  const fixtures = Object.values(state.fixtures)
    .filter((f) => f.tournamentId === t.tournamentId && f.kind === 'MATCH' && f.id.startsWith(`fx-${t.seasonYear}-`))
    .filter((f) => !onlyMine || f.homeTeamId === t.userTeamId || f.awayTeamId === t.userTeamId || f.homeTeamId === null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[18px] font-bold text-ink">{t.name}</h2>
          <Badge tone="blue">{t.format === 'MULTI_DAY' ? tx('format.MULTI_DAY') : t.format === 'T20' ? 'T20' : tx('car.t.oneDay')}</Badge>
          <Badge tone={t.complete ? 'green' : 'orange'}>{t.complete ? tx('car.t.complete') : stageLabel(tx, t.currentStage)}</Badge>
          {t.winnerTeamId ? (
            <Badge tone="gold">
              <Trophy className="size-3" aria-hidden /> {teamName(state, t.winnerTeamId)}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          {tx('car.t.yourSide', { team: teamName(state, t.userTeamId) })} ·{' '}
          {firstClass ? tx('car.t.pointsFc') : tx('car.t.pointsLimited')}
        </p>
        {mine ? (
          <p className="mt-2 text-[13px] text-ink">
            {tx('car.t.you', { runs: mine.runs, innings: mine.innings })}
            {runRank ? tx('car.t.runRank', { n: runRank }) : ''}
            {mine.wickets || mine.ballsBowled ? `${tx('car.t.wickets', { n: mine.wickets })}${wicketRank ? ` (#${wicketRank})` : ''}` : ''}.
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-ink-muted">{tx('car.t.notPlayed')}</p>
        )}
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        {t.groups.map((g) => {
          const rows = t.standings.filter((s) => s.groupId === g.id).sort((a, b) => a.position - b.position);
          return (
            <Card key={g.id}>
              <CardHeader title={g.name} className="mb-2" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-[13px]">
                  <thead className="text-[12px] text-ink-muted">
                    <tr>
                      <th className="py-1 pr-2 font-medium">#</th>
                      <th className="py-1 pr-2 font-medium">{tx('car.col.team')}</th>
                      <th className="py-1 pr-2 font-medium">P</th>
                      <th className="py-1 pr-2 font-medium">W</th>
                      <th className="py-1 pr-2 font-medium">L</th>
                      <th className="py-1 pr-2 font-medium">{firstClass ? 'D' : 'T'}</th>
                      <th className="py-1 pr-2 font-medium">NR</th>
                      {firstClass ? <th className="py-1 pr-2 font-medium">{tx('car.t.firstInn')}</th> : null}
                      <th className="py-1 pr-2 font-medium">Pts</th>
                      <th className="py-1 font-medium">{firstClass ? 'Quot.' : 'NRR'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.teamId} className={cn('border-t border-line', r.teamId === t.userTeamId && 'bg-brand-blue-soft font-semibold')}>
                        <td className="py-1.5 pr-2 text-ink-muted">{r.position}</td>
                        <td className="py-1.5 pr-2 text-ink">
                          {teamName(state, r.teamId)}
                          {r.qualified ? <span className="ml-1 text-[11px] text-brand-green">Q</span> : null}
                        </td>
                        <td className="py-1.5 pr-2">{r.played}</td>
                        <td className="py-1.5 pr-2">{r.won}</td>
                        <td className="py-1.5 pr-2">{r.lost}</td>
                        <td className="py-1.5 pr-2">{firstClass ? r.drawn : r.tied}</td>
                        <td className="py-1.5 pr-2">{r.noResult}</td>
                        {firstClass ? <td className="py-1.5 pr-2">{r.bonusPoints}</td> : null}
                        <td className="py-1.5 pr-2 font-semibold">{r.points}</td>
                        <td className="py-1.5">{firstClass ? quotient(r).toFixed(2) : `${r.netRunRate >= 0 ? '+' : ''}${r.netRunRate.toFixed(3)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      {t.knockouts.length ? (
        <Card>
          <CardHeader title={tx('car.t.knockouts')} className="mb-2" />
          <ul className="grid gap-2 md:grid-cols-2">
            {t.knockouts.map((k) => {
              const result = t.results[k.fixtureId];
              return (
                <li key={k.id} className="rounded-tile bg-page p-3 text-[13px]">
                  <p className="text-[12px] text-ink-muted">{k.label}</p>
                  <p className="font-semibold text-ink">
                    {teamName(state, k.homeTeamId)} {tx('m.v')} {teamName(state, k.awayTeamId)}
                  </p>
                  {result ? (
                    <p className="text-ink-muted">
                      {tx('car.t.won', { team: teamName(state, result.winnerTeamId) })} · {summaryText(result.summary)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <Leaders
          title={tx('car.t.topRuns')}
          lines={topRunScorers(t, 10)}
          value={(l) => `${l.runs}`}
          detail={(l) => tx('car.t.innsHs', { n: l.innings, hs: l.highScore })}
          state={state}
          t={t}
        />
        <Leaders
          title={tx('car.t.topWickets')}
          lines={topWicketTakers(t, 10)}
          value={(l) => `${l.wickets}`}
          detail={(l) =>
            tx('car.t.avgBest', {
              avg: l.ballsBowled ? (l.runsConceded / Math.max(1, l.wickets)).toFixed(1) : '-',
              w: l.bestWickets,
              r: l.bestRuns,
            })
          }
          state={state}
          t={t}
        />
      </div>

      <Card>
        <CardHeader title={tx('car.t.fixtures')} className="mb-2" />
        <label className="mb-2 flex items-center gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          {tx('car.t.onlyMine')}
        </label>
        <ul className="flex flex-col divide-y divide-line">
          {fixtures.map((f) => {
            const result = t.results[f.id];
            return (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="w-16 text-ink-muted">{formatDayMonth(f.date)}</span>
                <span className="flex-1 text-ink">
                  {teamName(state, f.homeTeamId)} {tx('m.v')} {teamName(state, f.awayTeamId)}
                  <span className="ml-1 text-[12px] text-ink-muted">{f.stage && f.stage !== 'GROUP' ? stageLabel(tx, f.stage) : ''}</span>
                </span>
                <span className="text-ink-muted">
                  {result ? (
                    result.matchId ? (
                      <Link to={`/matches/${result.matchId}`} className="text-brand-blue">{summaryText(result.summary)}</Link>
                    ) : (
                      summaryText(result.summary)
                    )
                  ) : f.involvesUser ? (
                    <Badge tone="blue">{tx('road.youPlay')}</Badge>
                  ) : (
                    tx('car.t.toPlay')
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {t.awards ? (
        <Card>
          <CardHeader title={tx('car.awards')} className="mb-2" />
          <ul className="flex flex-col gap-1 text-[13px] text-ink">
            <li>{tx('car.t.champions', { team: teamName(state, t.awards.championTeamId), runnerUp: teamName(state, t.awards.runnerUpTeamId) })}</li>
            {t.awards.playerOfTournament ? <li>{tx('car.t.pot', { name: t.awards.playerOfTournament.name, detail: t.awards.playerOfTournament.detail })}</li> : null}
            {t.awards.topScorer ? <li>{tx('car.t.topScorer', { name: t.awards.topScorer.name, detail: t.awards.topScorer.detail })}</li> : null}
            {t.awards.topWicketTaker ? <li>{tx('car.t.topWicketTaker', { name: t.awards.topWicketTaker.name, detail: t.awards.topWicketTaker.detail })}</li> : null}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function Leaders({
  title,
  lines,
  value,
  detail,
  state,
  t,
}: {
  title: string;
  lines: PlayerTournamentLine[];
  value: (l: PlayerTournamentLine) => string;
  detail: (l: PlayerTournamentLine) => string;
  state: GameState;
  t: TournamentState;
}) {
  const tx = useT();
  return (
    <Card>
      <CardHeader title={title} className="mb-2" />
      {lines.length === 0 ? <p className="text-[13px] text-ink-muted">{tx('car.noMatches')}</p> : null}
      <ol className="flex flex-col gap-1">
        {lines.map((l, i) => (
          <li key={l.playerId} className={cn('flex items-center gap-2 rounded-tile px-2 py-1 text-[13px]', l.playerId === state.player.id && 'bg-brand-blue-soft font-semibold')}>
            <span className="w-5 text-ink-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 text-ink">
              {l.playerId === state.player.id ? tx('car.you') : l.name}
              <span className="ml-1 text-[11px] text-ink-muted">{state.teams[l.teamId]?.shortName ?? ''}</span>
            </span>
            <span className="text-[12px] text-ink-muted">{detail(l)}</span>
            <span className="w-10 text-right font-semibold text-ink">{value(l)}</span>
          </li>
        ))}
      </ol>
      {!lines.some((l) => l.playerId === state.player.id) && t.stats[state.player.id] ? (
        <p className="mt-2 text-[12px] text-ink-muted">{tx('car.t.further')}</p>
      ) : null}
    </Card>
  );
}
