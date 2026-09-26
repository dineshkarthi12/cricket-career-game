import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, Crest, StatTile, Tabs } from '@/components';
import { NATIONAL, RANKINGS } from '@/engine/config';
import { NATIONS, NATIONS_BY_NAME, nationTeamId } from '@/data/nations';
import { ROLE_GROUP_LABEL, STATUS_LABEL, competitionForPlaces, roleGroup, weightedForm } from '@/engine/career/squads';
import { nationalEarnings, totalCaps } from '@/engine/pro/national';
import { rankingList, teamRankings, wtcStandings, userRank, type Discipline } from '@/engine/pro/rankings';
import { activePosts } from '@/engine/pro/leadership';
import { FORMAT_LABEL, competitionName, formatLakh } from '@/lib/pro';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { statusTone } from '../career/SelectionScreen';
import { useGameStore } from '@/store/gameStore';
import type { GameState, IntlFormat, TournamentState } from '@/types';
import { INTL_TOURNAMENT } from '@/types';

const TABS = [
  { id: 'squads', label: 'Squads' },
  { id: 'series', label: 'Series' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'contract', label: 'Contract & caps' },
  { id: 'icc', label: 'ICC & WTC' },
];

const FORMATS: IntlFormat[] = ['TEST', 'ODI', 'T20I'];

export default function InternationalScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <International state={state} />;
}

function International({ state }: { state: GameState }) {
  const [tab, setTab] = useState('squads');
  const n = state.pro.national;
  const caps = totalCaps(state);
  const best = (f: IntlFormat) => {
    const b = state.pro.rankings.best[f];
    const ranks = [b.batting, b.bowling, b.allRounder].filter((x): x is number => x !== null);
    return ranks.length ? Math.min(...ranks) : null;
  };
  const bestEver = FORMATS.map(best).filter((x): x is number => x !== null);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">International</h1>
        <p className="text-[13px] text-ink-muted">
          {n.watched
            ? 'The national selectors pick a squad for every series, format by format: ability for the format, form, the year\'s figures, fitness, age - and the rivals already in the side.'
            : 'Not on the national selectors\' radar yet. An India A call-up, a big IPL season or a standout Duleep/Irani season puts you there.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Test caps" value={n.caps.TEST} />
        <StatTile label="ODI caps" value={n.caps.ODI} />
        <StatTile label="T20I caps" value={n.caps.T20I} />
        <StatTile label="Central contract" value={n.contract ? `Grade ${n.contract.grade}` : '-'} />
        <StatTile label="Best ranking" value={bestEver.length ? `No. ${Math.min(...bestEver)}` : '-'} />
        <StatTile label="Earnings (India)" value={formatLakh(nationalEarnings(state))} />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="International sections" />
      {tab === 'squads' ? <Squads state={state} /> : null}
      {tab === 'series' ? <Series state={state} /> : null}
      {tab === 'rankings' ? <Rankings state={state} /> : null}
      {tab === 'contract' ? <ContractCaps state={state} caps={caps} /> : null}
      {tab === 'icc' ? <Icc state={state} /> : null}
    </div>
  );
}

function Squads({ state }: { state: GameState }) {
  const posts = activePosts(state).filter((p) => p.level === 'INDIA');
  const other = ['india-a-tour', 'india-a-one-day', 'duleep-trophy', 'irani-cup'].map((id) => state.career.squads[id]).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {!state.pro.national.watched ? (
        <Card><p className="text-[13px] text-ink-muted">No national squads to be considered for yet.</p></Card>
      ) : (
        FORMATS.map((f) => <FormatSquad key={f} state={state} format={f} captain={posts.find((p) => p.format === f)?.role ?? null} />)
      )}
      {other.length ? (
        <Card>
          <CardHeader title="India A and the zones" className="mb-2" />
          <ul className="flex flex-col gap-2">
            {other.map((p) => (
              <li key={p!.tournamentId} className="rounded-tile bg-page p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{competitionName(p!.tournamentId)}</span>
                  <Badge tone={statusTone(p!.status)}>{STATUS_LABEL[p!.status]}</Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-muted">{p!.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function FormatSquad({ state, format, captain }: { state: GameState; format: IntlFormat; captain: 'CAPTAIN' | 'VICE_CAPTAIN' | null }) {
  const tid = INTL_TOURNAMENT[format];
  const place = state.career.squads[tid];
  const india = nationTeamId('India');
  const ranked = useMemo(() => (state.teams[india]?.squad.length ? competitionForPlaces(state, india, [tid]).slice(0, 10) : []), [state, india, tid]);
  const group = ROLE_GROUP_LABEL[roleGroup(state.player.role)];
  return (
    <Card>
      <CardHeader title={`India - ${FORMAT_LABEL[format]}`} subtitle={`${state.pro.national.caps[format]} caps${captain ? ` · ${captain === 'CAPTAIN' ? 'Captain' : 'Vice-captain'}` : ''}`} action={{ label: 'Series', to: `/tournaments/${tid}` }} className="mb-2" />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={place ? statusTone(place.status) : 'grey'}>{place ? STATUS_LABEL[place.status] : 'Not considered yet'}</Badge>
        <p className="text-[13px] text-ink">{place?.reason ?? 'The selectors meet a week before each series.'}</p>
      </div>
      {ranked.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12.5px]">
            <thead className="text-[11.5px] text-ink-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">{group}s for {FORMAT_LABEL[format]}</th>
                <th className="py-1 pr-2 font-medium">Age</th>
                <th className="py-1 pr-2 font-medium">{format} rating</th>
                <th className="py-1 pr-2 font-medium">Form</th>
                <th className="py-1 pr-2 font-medium">Selectors</th>
                <th className="py-1 font-medium">Place</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.candidate.id} className={cn('border-t border-line', r.candidate.isUser && 'bg-brand-blue-soft font-semibold')}>
                  <td className="py-1 pr-2 text-ink-muted">{i + 1}</td>
                  <td className="py-1 pr-2 text-ink">{r.candidate.isUser ? 'You' : r.candidate.name}{r.candidate.outside ? <span className="ml-1 text-[11px] font-normal text-ink-muted">(domestic)</span> : null}</td>
                  <td className="py-1 pr-2 text-ink">{r.candidate.age}</td>
                  <td className="py-1 pr-2 text-ink">{Math.round(r.candidate.overall)}</td>
                  <td className="py-1 pr-2 text-ink">{weightedForm(r.candidate.ratings)}</td>
                  <td className="py-1 pr-2 text-ink">{r.score.toFixed(1)}</td>
                  <td className="py-1">{r.holdsSpot ? <Badge tone="green">XI</Badge> : r.inSquad ? <Badge tone="blue">Squad</Badge> : <Badge tone="grey">Outside</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}

function seriesOf(state: GameState, t: TournamentState) {
  return t.groups.map((g) => {
    const prefix = `fx-${t.seasonYear}-${t.tournamentId}-${g.id.toLowerCase()}-`;
    const results = Object.values(t.results).filter((r) => r.fixtureId.startsWith(prefix));
    const fixtures = Object.values(state.fixtures).filter((f) => f.id.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
    const [a, b] = g.teamIds;
    return { group: g, results, fixtures, wins: [results.filter((r) => r.winnerTeamId === a).length, results.filter((r) => r.winnerTeamId === b).length], a, b };
  });
}

function Series({ state }: { state: GameState }) {
  return (
    <div className="flex flex-col gap-3">
      <OwnSeries state={state} />
      <AroundTheWorld state={state} />
    </div>
  );
}

/** Other nations' series this season: result, top scorers and wicket-takers. */
function AroundTheWorld({ state }: { state: GameState }) {
  const results = state.pro.worldResults ?? [];
  if (results.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Around the world" subtitle="Other nations' matches this season - the top scorers and wicket-takers" className="mb-2" />
      <ul className="grid gap-2 md:grid-cols-2">
        {results.slice(0, 12).map((r, i) => (
          <li key={`${r.date}-${i}`} className="rounded-tile bg-page px-3 py-2 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="grey">{r.format === 'TEST' ? 'Test' : r.format}</Badge>
              <span className="font-semibold text-ink">{r.home} v {r.away}</span>
              <span className="ml-auto text-ink-muted">{formatLongDate(r.date)}</span>
            </div>
            <p className="mt-1 text-ink">{r.summary}</p>
            <p className="mt-0.5 text-ink-muted">
              {r.batting.map((b) => `${b.name} ${b.runs} (${b.balls})`).join(' · ')}
              {r.bowling.length ? ` | ${r.bowling.map((b) => `${b.name} ${b.wickets}/${b.runs}`).join(' · ')}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OwnSeries({ state }: { state: GameState }) {
  const tournaments = state.season.tournaments.filter((t) => t.seasonYear === state.season.year && (t.tournamentId.startsWith('intl-') || t.tournamentId.startsWith('india-a')));
  if (tournaments.length === 0) return <Card><p className="text-[13px] text-ink-muted">No international or India A cricket in your calendar this season.</p></Card>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {tournaments.flatMap((t) =>
        seriesOf(state, t).map((s) => {
          const opp = state.teams[s.b];
          const host = s.fixtures[0]?.venueId ? state.venues[s.fixtures[0].venueId] : undefined;
          const nation = host ? NATIONS_BY_NAME[host.country] : undefined;
          return (
            <Card key={`${t.tournamentId}-${s.group.id}`}>
              <div className="flex items-center gap-3">
                {opp ? <Crest crest={opp.crest} size={34} label={opp.name} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{competitionName(t.tournamentId)} {s.group.name}</p>
                  <p className="text-[12px] text-ink-muted">{nation ? nation.conditions : ''}</p>
                </div>
                <Badge tone={s.wins[0] > s.wins[1] ? 'green' : s.wins[0] < s.wins[1] ? 'red' : 'grey'}>{s.wins[0]}-{s.wins[1]}</Badge>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-[12.5px]">
                {s.fixtures.map((f) => {
                  const r = t.results[f.id];
                  return (
                    <li key={f.id} className="flex justify-between gap-2 rounded bg-page px-2.5 py-1">
                      <span className="text-ink-muted">{formatLongDate(f.date)} · {state.venues[f.venueId ?? '']?.city ?? ''}</span>
                      <span className="text-right text-ink">{r ? r.summary || (r.winnerTeamId ? `${state.teams[r.winnerTeamId]?.shortName} won` : 'Drawn') : f.involvesUser ? 'Yours to play' : 'To play'}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        }),
      )}
    </div>
  );
}

function Rankings({ state }: { state: GameState }) {
  const [format, setFormat] = useState<IntlFormat>('TEST');
  const [discipline, setDiscipline] = useState<Discipline>('batting');
  const list = rankingList(state, format, discipline, 15);
  const mine = userRank(state, format, discipline);
  const teams = teamRankings(state, format);
  const k = RANKINGS;
  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title="World player rankings" subtitle={mine ? `You: No. ${mine}` : 'You are not ranked in this list yet'} className="mb-2" />
        <div className="mb-2 flex flex-wrap gap-2">
          <Tabs tabs={FORMATS.map((f) => ({ id: f, label: FORMAT_LABEL[f] }))} value={format} onChange={(v) => setFormat(v as IntlFormat)} label="Format" />
          <Tabs tabs={[{ id: 'batting', label: 'Batting' }, { id: 'bowling', label: 'Bowling' }, { id: 'allRounder', label: 'All-rounders' }]} value={discipline} onChange={(v) => setDiscipline(v as Discipline)} label="Discipline" />
        </div>
        {list.length === 0 ? <p className="text-[13px] text-ink-muted">No ranked players yet - rankings fill in as international cricket is played.</p> : null}
        <ol className="flex flex-col">
          {list.map((e) => (
            <li key={e.playerId} className={cn('flex items-center justify-between gap-2 border-t border-line py-1.5 text-[13px]', e.playerId === state.player.id && 'bg-brand-blue-soft font-semibold')}>
              <span className="text-ink"><span className="inline-block w-7 text-ink-muted">{e.rank}</span>{e.playerId === state.player.id ? 'You' : e.name} <span className="text-[12px] text-ink-muted">{NATIONS_BY_NAME[e.nation]?.short ?? e.nation}</span></span>
              <span className="font-semibold text-ink">{e.rating}</span>
            </li>
          ))}
        </ol>
        <details className="mt-3 text-[12px] text-ink-muted">
          <summary className="cursor-pointer font-semibold text-ink">How the rankings work</summary>
          <p className="mt-1">
            Every international match earns batting points ({k.bat[format].base} + {k.bat[format].perRun} a run, +{k.bat[format].fifty} for fifty, +{k.bat[format].hundred} for a hundred{format !== 'TEST' ? `, ±${k.bat[format].perSr} per strike-rate point against ${k.bat[format].parSr}` : ''}) and bowling points ({k.bowl[format].base} + {k.bowl[format].perWicket} a wicket, −{k.bowl[format].perEconomy} per run of economy over {k.bowl[format].parEconomy}), scaled by the opposition's strength and +5% in a win, capped at 1,000.
            A rating moves {Math.round(k.weight * 100)}% of the way to each match's points (faster over the first five matches), so it reflects about the last ten. {k.minMatches} matches to be ranked. All-rounder index = batting × bowling ÷ 1,000.
          </p>
        </details>
      </Card>
      <Card>
        <CardHeader title={`Team rankings - ${FORMAT_LABEL[format]}`} className="mb-2" />
        <ol className="flex flex-col">
          {teams.map((t) => (
            <li key={t.nation} className={cn('flex justify-between border-t border-line py-1.5 text-[13px]', t.nation === 'India' && 'font-semibold')}>
              <span className="text-ink"><span className="inline-block w-6 text-ink-muted">{t.rank}</span>{t.nation}</span>
              <span className="text-ink">{t.rating}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function ContractCaps({ state, caps }: { state: GameState; caps: number }) {
  const n = state.pro.national;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="Central contract" subtitle="Announced each April from the last twelve months" className="mb-2" />
        {n.contract ? (
          <p className="text-[14px] text-ink"><Badge tone="gold">Grade {n.contract.grade}</Badge> <span className="ml-2">Retainer {formatLakh(n.contract.retainer)} a year</span></p>
        ) : (
          <p className="text-[13px] text-ink-muted">No central contract.</p>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] text-ink-muted">
          <li className="rounded bg-page p-2">A+ · all three formats: {formatLakh(NATIONAL.retainer['A+'])}</li>
          <li className="rounded bg-page p-2">A · two formats: {formatLakh(NATIONAL.retainer.A)}</li>
          <li className="rounded bg-page p-2">B · one format: {formatLakh(NATIONAL.retainer.B)}</li>
          <li className="rounded bg-page p-2">C · capped this year: {formatLakh(NATIONAL.retainer.C)}</li>
        </ul>
        <p className="mt-3 text-[13px] text-ink">Match fees earned: <span className="font-semibold">{formatLakh(n.matchFees)}</span> (Test {formatLakh(NATIONAL.matchFee.TEST)}, ODI {formatLakh(NATIONAL.matchFee.ODI)}, T20I {formatLakh(NATIONAL.matchFee.T20I)})</p>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">Workload management</h3>
        {n.rested.length === 0 ? <p className="text-[13px] text-ink-muted">Never rested by the board.</p> : null}
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {n.rested.map((r) => (
            <li key={r.date} className="rounded bg-page px-2.5 py-1 text-ink">{formatLongDate(r.date)} · {FORMAT_LABEL[r.format]}: {r.reason}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Caps" subtitle={`${caps} international matches · ${n.campInvites} national camp${n.campInvites === 1 ? '' : 's'}`} className="mb-2" />
        {n.debuts.length === 0 ? <p className="text-[13px] text-ink-muted">Uncapped. The camp, then a squad, then the XI.</p> : null}
        <ul className="flex flex-col gap-1.5">
          {n.debuts.map((d) => (
            <li key={d.format} className="rounded-tile bg-page px-3 py-2 text-[13px]">
              <span className="font-semibold text-ink">{FORMAT_LABEL[d.format]} cap No. {d.capNumber}</span> · v {d.opponent} · {formatLongDate(d.date)}{d.venue ? ` · ${d.venue}` : ''}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-muted">{NATIONAL.regularCaps} caps makes a regular international (stage 17).</p>
      </Card>
    </div>
  );
}

function Icc({ state }: { state: GameState }) {
  const table = wtcStandings(state);
  const icc = state.season.tournaments.filter((t) => t.seasonYear === state.season.year && ['t20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'].includes(t.tournamentId));
  const wtc = state.pro.wtc;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="World Test Championship" subtitle={`Cycle ${wtc.startYear}-${wtc.startYear + 2}: 12 points a win, 4 a draw; the top two by percentage meet in a June final`} className="mb-2" />
        {table.length === 0 ? <p className="text-[13px] text-ink-muted">The cycle has just begun.</p> : null}
        <table className="w-full text-left text-[12.5px]">
          <thead className="text-[11.5px] text-ink-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">Team</th>
              <th className="py-1 pr-2 font-medium">P</th>
              <th className="py-1 pr-2 font-medium">W</th>
              <th className="py-1 pr-2 font-medium">L</th>
              <th className="py-1 pr-2 font-medium">D</th>
              <th className="py-1 pr-2 font-medium">Pts</th>
              <th className="py-1 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.nation} className={cn('border-t border-line', r.nation === 'India' && 'font-semibold', i < 2 && 'bg-brand-green/8')}>
                <td className="py-1 pr-2 text-ink">{r.nation}</td>
                <td className="py-1 pr-2 text-ink">{r.played}</td>
                <td className="py-1 pr-2 text-ink">{r.won}</td>
                <td className="py-1 pr-2 text-ink">{r.lost}</td>
                <td className="py-1 pr-2 text-ink">{r.drawn}</td>
                <td className="py-1 pr-2 text-ink">{r.points}</td>
                <td className="py-1 text-ink">{r.pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {wtc.finals.length ? (
          <ul className="mt-3 flex flex-col gap-1 text-[12.5px]">
            {wtc.finals.map((f) => (
              <li key={f.seasonYear} className="text-ink">Final {f.seasonYear}: <span className="font-semibold">{f.winner}</span> beat {f.runnerUp}{f.userPlayed ? ' (you played)' : ''}</li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card>
        <CardHeader title="ICC events" subtitle="Groups, semi-finals and a final at neutral venues in the host's conditions" className="mb-2" />
        {icc.length === 0 ? <p className="text-[13px] text-ink-muted">No ICC event in your calendar this season.</p> : null}
        <ul className="flex flex-col gap-1.5">
          {icc.map((t) => (
            <li key={t.tournamentId} className="flex items-center justify-between gap-2 rounded-tile bg-page px-3 py-2 text-[13px]">
              <span className="text-ink">{t.name}</span>
              <Link to={`/tournaments/${t.tournamentId}`} className="font-semibold text-brand-blue">{t.complete ? `Won by ${state.teams[t.winnerTeamId ?? '']?.name ?? '-'}` : 'Table'}</Link>
            </li>
          ))}
        </ul>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">Your ICC record</h3>
        {state.pro.national.iccEvents.length === 0 ? <p className="text-[13px] text-ink-muted">No ICC events yet.</p> : null}
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {state.pro.national.iccEvents.map((e) => (
            <li key={`${e.tournamentId}-${e.seasonYear}`} className="text-ink">{competitionName(e.tournamentId)} {e.seasonYear}: {e.matches} matches {e.won ? <Badge tone="gold">Champions</Badge> : null}</li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-ink-muted">Hosts' conditions: {NATIONS.filter((n) => n.name !== 'India').slice(0, 6).map((n) => `${n.name} - ${n.conditions}`).join(' ')}</p>
      </Card>
    </div>
  );
}

