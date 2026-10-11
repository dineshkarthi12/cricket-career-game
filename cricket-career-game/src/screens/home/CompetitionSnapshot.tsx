/**
 * One competition at a glance, under the road-to-selection chips: how many
 * matches are played and left, the user's group table, and the top three
 * run-scorers and wicket-takers. The full page is a link away.
 */
import { Link } from 'react-router-dom';
import { isKey, type Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { matchProgress, quotient, topRunScorers, topWicketTakers, tournamentOf } from '@/engine/tournament';
import { cn } from '@/lib/cn';
import type { GameState, PlayerTournamentLine, TournamentStanding } from '@/types';

/** Rows shown in the mini table: the whole group when it is small, else the top four and the user's side. */
const FULL_GROUP = 6;
const TOP_ROWS = 4;

export function CompetitionSnapshot({ state, tournamentId, shortName }: { state: GameState; tournamentId: string; shortName: string }) {
  const t = useT();
  const comp = tournamentOf(state, tournamentId);
  if (!comp) return null;
  const progress = matchProgress(state, comp);
  const firstClass = comp.points === 'FIRST_CLASS';
  const group = comp.groups.find((g) => comp.userTeamId && g.teamIds.includes(comp.userTeamId)) ?? comp.groups[0];
  const table = group ? comp.standings.filter((s) => s.groupId === group.id).sort((a, b) => a.position - b.position) : [];
  const rows = table.length <= FULL_GROUP ? table : table.filter((s, i) => i < TOP_ROWS || s.teamId === comp.userTeamId);
  const mine = table.find((s) => s.teamId === comp.userTeamId);
  const name = (id: string) => state.teams[id]?.shortName ?? state.teams[id]?.name ?? id;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Fact label={t('road.snap.played')} value={`${progress.played}/${progress.total}`} />
        <Fact label={t('road.snap.left')} value={comp.complete ? '-' : `${progress.total - progress.played}`} />
        <Fact
          label={comp.userTeamId ? t('road.snap.sideLeft', { team: name(comp.userTeamId) }) : t('road.snap.noSide')}
          value={comp.userTeamId ? `${progress.teamLeft}` : '-'}
          hint={mine && mine.played > 0 ? `#${mine.position}` : undefined}
        />
      </dl>

      {rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <p className="mb-1 text-[12px] font-semibold text-ink">{t('road.snap.table', { group: isKey(`group.${group.name}`) ? t(`group.${group.name}` as Key) : group.name })}</p>
          <table className="w-full text-left text-[12px]">
            <thead className="text-[11px] text-ink-muted">
              <tr>
                <th className="py-0.5 pr-2 font-medium">#</th>
                <th className="py-0.5 pr-2 font-medium">{t('car.col.team')}</th>
                <th className="py-0.5 pr-2 font-medium">P</th>
                <th className="py-0.5 pr-2 font-medium">W</th>
                <th className="py-0.5 pr-2 font-medium">L</th>
                <th className="py-0.5 pr-2 font-medium">Pts</th>
                <th className="py-0.5 font-medium">{firstClass ? 'Quot.' : 'NRR'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <TableRow key={r.teamId} row={r} name={name(r.teamId)} mine={r.teamId === comp.userTeamId} gap={i > 0 && r.position - rows[i - 1].position > 1} firstClass={firstClass} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Leaders title={t('car.t.topRuns')} lines={topRunScorers(comp, 3)} value={(l) => `${l.runs}`} state={state} />
        <Leaders title={t('car.t.topWickets')} lines={topWicketTakers(comp, 3)} value={(l) => `${l.wickets}`} state={state} />
      </div>

      <Link to={`/tournaments/${tournamentId}`} className="mt-2 inline-block text-[12px] font-semibold text-brand-blue">
        {t('road.table', { comp: shortName })}
      </Link>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-tile bg-page px-2 py-1.5">
      <dt className="truncate text-[10.5px] text-ink-muted">{label}</dt>
      <dd className="text-[15px] font-bold text-ink">
        {value}
        {hint ? <span className="ml-1 text-[11px] font-semibold text-brand-blue">{hint}</span> : null}
      </dd>
    </div>
  );
}

function TableRow({ row: r, name, mine, gap, firstClass }: { row: TournamentStanding; name: string; mine: boolean; gap: boolean; firstClass: boolean }) {
  return (
    <tr className={cn('border-t', gap ? 'border-dashed border-ink-soft' : 'border-line', mine && 'bg-brand-blue-soft font-semibold')}>
      <td className="py-1 pr-2 text-ink-muted">{r.position}</td>
      <td className="py-1 pr-2 text-ink">
        {name}
        {r.qualified ? <span className="ml-1 text-[10.5px] text-brand-green">Q</span> : null}
      </td>
      <td className="py-1 pr-2">{r.played}</td>
      <td className="py-1 pr-2">{r.won}</td>
      <td className="py-1 pr-2">{r.lost}</td>
      <td className="py-1 pr-2 font-semibold">{r.points}</td>
      <td className="py-1">{firstClass ? quotient(r).toFixed(2) : `${r.netRunRate >= 0 ? '+' : ''}${r.netRunRate.toFixed(2)}`}</td>
    </tr>
  );
}

function Leaders({ title, lines, value, state }: { title: string; lines: PlayerTournamentLine[]; value: (l: PlayerTournamentLine) => string; state: GameState }) {
  const t = useT();
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[12px] font-semibold text-ink">{title}</p>
      {lines.length === 0 ? <p className="text-[12px] text-ink-muted">{t('car.noMatches')}</p> : null}
      <ol className="flex flex-col gap-0.5">
        {lines.map((l, i) => (
          <li key={l.playerId} className={cn('flex items-center gap-2 rounded-tile px-1.5 py-0.5 text-[12px]', l.playerId === state.player.id && 'bg-brand-blue-soft font-semibold')}>
            <span className="w-4 text-ink-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink">
              {l.playerId === state.player.id ? t('car.you') : l.name}
              <span className="ml-1 text-[10.5px] text-ink-muted">{state.teams[l.teamId]?.shortName ?? ''}</span>
            </span>
            <span className="font-semibold text-ink">{value(l)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
