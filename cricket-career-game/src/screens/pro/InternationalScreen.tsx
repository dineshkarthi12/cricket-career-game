import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, Crest, StatTile, Tabs } from '@/components';
import { NATIONAL, RANKINGS } from '@/engine/config';
import { NATIONS, NATIONS_BY_NAME, nationTeamId } from '@/data/nations';
import { ROLE_GROUP_LABEL, competitionForPlaces, roleGroup, weightedForm } from '@/engine/career/squads';
import { nationalEarnings, totalCaps } from '@/engine/pro/national';
import { rankingList, teamRankings, wtcStandings, userRank, type Discipline } from '@/engine/pro/rankings';
import { activePosts } from '@/engine/pro/leadership';
import { competitionName, formatLakh } from '@/lib/pro';
import { rich, useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { statusTone } from '../career/SelectionScreen';
import { useGameStore } from '@/store/gameStore';
import type { GameState, IntlFormat, SquadStatus, TournamentState } from '@/types';
import { INTL_TOURNAMENT } from '@/types';

const TABS = ['squads', 'series', 'rankings', 'contract', 'icc'];

const FORMATS: IntlFormat[] = ['TEST', 'ODI', 'T20I'];

const fmtKey = (f: IntlFormat) => `pro.fmt.${f}` as Key;
const statusKey = (s: SquadStatus) => `status.${s}` as Key;

export default function InternationalScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
  return <International state={state} />;
}

function International({ state }: { state: GameState }) {
  const [tab, setTab] = useState('squads');
  const t = useT();
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
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('pro.intl.title')}</h1>
        <p className="text-[13px] text-ink-muted">
          {n.watched ? t('pro.intl.watched') : t('pro.intl.notWatched')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t('pro.intl.testCaps')} value={n.caps.TEST} />
        <StatTile label={t('pro.intl.odiCaps')} value={n.caps.ODI} />
        <StatTile label={t('pro.intl.t20iCaps')} value={n.caps.T20I} />
        <StatTile label={t('pro.intl.central')} value={n.contract ? t('pro.intl.grade', { grade: n.contract.grade }) : '-'} />
        <StatTile label={t('pro.intl.bestRanking')} value={bestEver.length ? t('pro.intl.no', { n: Math.min(...bestEver) }) : '-'} />
        <StatTile label={t('pro.intl.earnings')} value={formatLakh(nationalEarnings(state))} />
      </div>
      <Tabs tabs={TABS.map((id) => ({ id, label: id === 'icc' ? 'ICC & WTC' : t(`pro.intl.tab.${id}` as Key) }))} value={tab} onChange={setTab} label={t('pro.intl.tabsLabel')} />
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
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      {!state.pro.national.watched ? (
        <Card><p className="text-[13px] text-ink-muted">{t('pro.intl.noSquads')}</p></Card>
      ) : (
        FORMATS.map((f) => <FormatSquad key={f} state={state} format={f} captain={posts.find((p) => p.format === f)?.role ?? null} />)
      )}
      {other.length ? (
        <Card>
          <CardHeader title={t('pro.intl.indiaA')} className="mb-2" />
          <ul className="flex flex-col gap-2">
            {other.map((p) => (
              <li key={p!.tournamentId} className="rounded-tile bg-page p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{competitionName(p!.tournamentId)}</span>
                  <Badge tone={statusTone(p!.status)}>{t(statusKey(p!.status))}</Badge>
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
  const t = useT();
  const group = t(`group.${ROLE_GROUP_LABEL[roleGroup(state.player.role)]}` as Key);
  const fmt = t(fmtKey(format));
  return (
    <Card>
      <CardHeader title={t('pro.intl.indiaFmt', { format: fmt })} subtitle={`${t('pro.intl.caps', { n: state.pro.national.caps[format] })}${captain ? ` · ${captain === 'CAPTAIN' ? t('m.captain') : t('pro.viceCaptain')}` : ''}`} action={{ label: t('pro.intl.tab.series'), to: `/tournaments/${tid}` }} className="mb-2" />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={place ? statusTone(place.status) : 'grey'}>{place ? t(statusKey(place.status)) : t('pro.intl.notConsidered')}</Badge>
        <p className="text-[13px] text-ink">{place?.reason ?? t('pro.intl.selectorsMeet')}</p>
      </div>
      {ranked.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12.5px]">
            <thead className="text-[11.5px] text-ink-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">{t('pro.intl.colGroup', { group, format: fmt })}</th>
                <th className="py-1 pr-2 font-medium">{t('pro.intl.col.age')}</th>
                <th className="py-1 pr-2 font-medium">{t('pro.intl.col.rating', { format })}</th>
                <th className="py-1 pr-2 font-medium">{t('pro.intl.col.form')}</th>
                <th className="py-1 pr-2 font-medium">{t('pro.intl.col.selectors')}</th>
                <th className="py-1 font-medium">{t('pro.intl.col.place')}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.candidate.id} className={cn('border-t border-line', r.candidate.isUser && 'bg-brand-blue-soft font-semibold')}>
                  <td className="py-1 pr-2 text-ink-muted">{i + 1}</td>
                  <td className="py-1 pr-2 text-ink">{r.candidate.isUser ? t('player.you') : r.candidate.name}{r.candidate.outside ? <span className="ml-1 text-[11px] font-normal text-ink-muted">{t('pro.intl.domestic')}</span> : null}</td>
                  <td className="py-1 pr-2 text-ink">{r.candidate.age}</td>
                  <td className="py-1 pr-2 text-ink">{Math.round(r.candidate.overall)}</td>
                  <td className="py-1 pr-2 text-ink">{weightedForm(r.candidate.ratings)}</td>
                  <td className="py-1 pr-2 text-ink">{r.score.toFixed(1)}</td>
                  <td className="py-1">{r.holdsSpot ? <Badge tone="green">XI</Badge> : r.inSquad ? <Badge tone="blue">{t('pro.fr.squad')}</Badge> : <Badge tone="grey">{t('pro.intl.outside')}</Badge>}</td>
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
  const t = useT();
  if (results.length === 0) return null;
  return (
    <Card>
      <CardHeader title={t('pro.intl.world')} subtitle={t('pro.intl.worldSub')} className="mb-2" />
      <ul className="grid gap-2 md:grid-cols-2">
        {results.slice(0, 12).map((r, i) => (
          <li key={`${r.date}-${i}`} className="rounded-tile bg-page px-3 py-2 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="grey">{r.format === 'TEST' ? t('format.TEST') : r.format}</Badge>
              <span className="font-semibold text-ink">{r.home} {t('m.v')} {r.away}</span>
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
  const tx = useT();
  const tournaments = state.season.tournaments.filter((t) => t.seasonYear === state.season.year && (t.tournamentId.startsWith('intl-') || t.tournamentId.startsWith('india-a')));
  if (tournaments.length === 0) return <Card><p className="text-[13px] text-ink-muted">{tx('pro.intl.noIntl')}</p></Card>;
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
                      <span className="text-right text-ink">{r ? r.summary || (r.winnerTeamId ? tx('pro.intl.won', { team: state.teams[r.winnerTeamId]?.shortName ?? '' }) : tx('pro.intl.drawn')) : f.involvesUser ? tx('pro.intl.yoursToPlay') : tx('pro.intl.toPlay')}</span>
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
  const t = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title={t('pro.rk.title')} subtitle={mine ? t('pro.rk.you', { n: mine }) : t('pro.rk.notRanked')} className="mb-2" />
        <div className="mb-2 flex flex-wrap gap-2">
          <Tabs tabs={FORMATS.map((f) => ({ id: f, label: t(fmtKey(f)) }))} value={format} onChange={(v) => setFormat(v as IntlFormat)} label={t('pro.rk.format')} />
          <Tabs tabs={[{ id: 'batting', label: t('pro.rk.batting') }, { id: 'bowling', label: t('pro.rk.bowling') }, { id: 'allRounder', label: t('pro.rk.allRounders') }]} value={discipline} onChange={(v) => setDiscipline(v as Discipline)} label={t('pro.rk.discipline')} />
        </div>
        {list.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.rk.none')}</p> : null}
        <ol className="flex flex-col">
          {list.map((e) => (
            <li key={e.playerId} className={cn('flex items-center justify-between gap-2 border-t border-line py-1.5 text-[13px]', e.playerId === state.player.id && 'bg-brand-blue-soft font-semibold')}>
              <span className="text-ink"><span className="inline-block w-7 text-ink-muted">{e.rank}</span>{e.playerId === state.player.id ? t('player.you') : e.name} <span className="text-[12px] text-ink-muted">{NATIONS_BY_NAME[e.nation]?.short ?? e.nation}</span></span>
              <span className="font-semibold text-ink">{e.rating}</span>
            </li>
          ))}
        </ol>
        <details className="mt-3 text-[12px] text-ink-muted">
          <summary className="cursor-pointer font-semibold text-ink">{t('pro.rk.how')}</summary>
          <p className="mt-1">
            {t('pro.rk.how1', {
              base: k.bat[format].base,
              perRun: k.bat[format].perRun,
              fifty: k.bat[format].fifty,
              hundred: k.bat[format].hundred,
              sr: format !== 'TEST' ? t('pro.rk.howSr', { perSr: k.bat[format].perSr, parSr: k.bat[format].parSr }) : '',
              bowlBase: k.bowl[format].base,
              perWicket: k.bowl[format].perWicket,
              perEconomy: k.bowl[format].perEconomy,
              parEconomy: k.bowl[format].parEconomy,
            })}{' '}
            {t('pro.rk.how2', { pct: Math.round(k.weight * 100), min: k.minMatches })}
          </p>
        </details>
      </Card>
      <Card>
        <CardHeader title={t('pro.rk.teams', { format: t(fmtKey(format)) })} className="mb-2" />
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
  const t = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('pro.intl.central')} subtitle={t('pro.cc.sub')} className="mb-2" />
        {n.contract ? (
          <p className="text-[14px] text-ink"><Badge tone="gold">{t('pro.intl.grade', { grade: n.contract.grade })}</Badge> <span className="ml-2">{t('pro.cc.retainer', { amount: formatLakh(n.contract.retainer) })}</span></p>
        ) : (
          <p className="text-[13px] text-ink-muted">{t('pro.cc.none')}</p>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] text-ink-muted">
          <li className="rounded bg-page p-2">{t('pro.cc.gradeAPlus', { amount: formatLakh(NATIONAL.retainer['A+']) })}</li>
          <li className="rounded bg-page p-2">{t('pro.cc.gradeA', { amount: formatLakh(NATIONAL.retainer.A) })}</li>
          <li className="rounded bg-page p-2">{t('pro.cc.gradeB', { amount: formatLakh(NATIONAL.retainer.B) })}</li>
          <li className="rounded bg-page p-2">{t('pro.cc.gradeC', { amount: formatLakh(NATIONAL.retainer.C) })}</li>
        </ul>
        <p className="mt-3 text-[13px] text-ink">{rich(t('pro.cc.fees', { test: formatLakh(NATIONAL.matchFee.TEST), odi: formatLakh(NATIONAL.matchFee.ODI), t20i: formatLakh(NATIONAL.matchFee.T20I) }), { fees: <span className="font-semibold">{formatLakh(n.matchFees)}</span> })}</p>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{t('pro.cc.workload')}</h3>
        {n.rested.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.cc.neverRested')}</p> : null}
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {n.rested.map((r) => (
            <li key={r.date} className="rounded bg-page px-2.5 py-1 text-ink">{formatLongDate(r.date)} · {t(fmtKey(r.format))}: {r.reason}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t('pro.cc.caps')} subtitle={t(n.campInvites === 1 ? 'pro.cc.capsSub.one' : 'pro.cc.capsSub.many', { caps, n: n.campInvites })} className="mb-2" />
        {n.debuts.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.cc.uncapped')}</p> : null}
        <ul className="flex flex-col gap-1.5">
          {n.debuts.map((d) => (
            <li key={d.format} className="rounded-tile bg-page px-3 py-2 text-[13px]">
              <span className="font-semibold text-ink">{t('pro.cc.capNo', { format: t(fmtKey(d.format)), n: d.capNumber })}</span> · {t('m.v')} {d.opponent} · {formatLongDate(d.date)}{d.venue ? ` · ${d.venue}` : ''}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-muted">{t('pro.cc.regular', { n: NATIONAL.regularCaps })}</p>
      </Card>
    </div>
  );
}

function Icc({ state }: { state: GameState }) {
  const table = wtcStandings(state);
  const icc = state.season.tournaments.filter((t) => t.seasonYear === state.season.year && ['t20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'].includes(t.tournamentId));
  const wtc = state.pro.wtc;
  const tx = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="World Test Championship" subtitle={tx('pro.icc.cycle', { from: wtc.startYear, to: wtc.startYear + 2 })} className="mb-2" />
        {table.length === 0 ? <p className="text-[13px] text-ink-muted">{tx('pro.icc.begun')}</p> : null}
        <table className="w-full text-left text-[12.5px]">
          <thead className="text-[11.5px] text-ink-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">{tx('pro.icc.team')}</th>
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
              <li key={f.seasonYear} className="text-ink">{rich(tx('pro.icc.final', { year: f.seasonYear, runnerUp: f.runnerUp, you: f.userPlayed ? '@pro.icc.youPlayed' : '' }), { winner: <span className="font-semibold">{f.winner}</span> })}</li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card>
        <CardHeader title={tx('pro.icc.events')} subtitle={tx('pro.icc.eventsSub')} className="mb-2" />
        {icc.length === 0 ? <p className="text-[13px] text-ink-muted">{tx('pro.icc.none')}</p> : null}
        <ul className="flex flex-col gap-1.5">
          {icc.map((t) => (
            <li key={t.tournamentId} className="flex items-center justify-between gap-2 rounded-tile bg-page px-3 py-2 text-[13px]">
              <span className="text-ink">{t.name}</span>
              <Link to={`/tournaments/${t.tournamentId}`} className="font-semibold text-brand-blue">{t.complete ? tx('pro.icc.wonBy', { team: state.teams[t.winnerTeamId ?? '']?.name ?? '-' }) : tx('pro.ct.table')}</Link>
            </li>
          ))}
        </ul>
        <h3 className="mt-3 mb-1 text-[13px] font-semibold text-ink">{tx('pro.icc.record')}</h3>
        {state.pro.national.iccEvents.length === 0 ? <p className="text-[13px] text-ink-muted">{tx('pro.icc.noEvents')}</p> : null}
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {state.pro.national.iccEvents.map((e) => (
            <li key={`${e.tournamentId}-${e.seasonYear}`} className="text-ink">{tx('pro.icc.line', { name: competitionName(e.tournamentId), year: e.seasonYear, n: e.matches })} {e.won ? <Badge tone="gold">{tx('pro.ct.champions')}</Badge> : null}</li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-ink-muted">{tx('pro.icc.hosts', { list: NATIONS.filter((n) => n.name !== 'India').slice(0, 6).map((n) => `${n.name} - ${n.conditions}`).join(' ') })}</p>
      </Card>
    </div>
  );
}

