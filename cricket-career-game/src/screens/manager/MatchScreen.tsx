/**
 * Matchday for the manager: pre-match preparation, the live match with
 * tactical control (or a quick sim), and the scorecard and report.
 *
 * The manager never bats or bowls - there is no career player in the match.
 * The live engine is the same ball-by-ball engine as the player career; the
 * manager's calls (approach, next bowler, target bowler, impact sub) go in
 * as team instructions. The result is written once, when the match ends.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudSun, FastForward, Play, SkipForward, Swords, Zap } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, EmptyState, Tabs } from '@/components';
import { createLiveMatch, type LiveMatch, type LiveSnapshot } from '@/engine/match/live';
import {
  PHASE_LABEL,
  applyResult,
  buildSetup,
  holds,
  overridesFor,
  produce,
  quickSimFixture,
  selectionAdvice,
  tacticsFor,
  venueFor,
  xiProblems,
  type MatchdayCalls,
} from '@/engine/manager';
import { useAppSettings, useReducedMotion } from '@/store/appSettings';
import { BALL_SPEEDS } from '@/store/matchStore';
import { useMatchAudio } from '@/lib/audio/useMatchAudio';
import { SimControls } from '@/screens/match/controls/SimControls';
import { useManagerStore } from '@/store/managerStore';
import type { BattingApproachSetting, ManagerFixture, ManagerState } from '@/types/manager';
import type { Ball } from '@/types';
import { GroundView } from '@/screens/match/ground/GroundView';
import { ScoreStrip } from '@/screens/match/panels/ScoreStrip';
import { CommentaryFeed } from '@/screens/match/panels/CommentaryFeed';
import { Scorecard } from '@/screens/match/panels/Scorecard';
import { cn } from '@/lib/cn';
import { Button, FranchiseCrest, LinkButton, PageHeader, Select, StatLine, ToneBadge, nameOf, shortOf, useManager } from './ui';

/** Live matches survive moving between screens (not a reload: the result is only written at the end). */
const sessions = new Map<string, LiveMatch>();

export default function ManagerMatchScreen() {
  const { fixtureId } = useParams();
  const { state } = useManager();
  const fixture = state.season.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return <Navigate to="/manager/fixtures" replace />;
  if (fixture.result) return <Navigate to={`/manager/match/${fixture.id}/report`} replace />;
  const mine = fixture.homeId === state.franchiseId || fixture.awayId === state.franchiseId;
  if (!mine) return <Navigate to="/manager/fixtures" replace />;
  return <Matchday key={fixture.id} state={state} fixture={fixture} />;
}

function Matchday({ state, fixture }: { state: ManagerState; fixture: ManagerFixture }) {
  const navigate = useNavigate();
  const replace = useManagerStore((s) => s.replace);
  const [live, setLive] = useState<LiveMatch | null>(sessions.get(fixture.id) ?? null);
  const [snap, setSnap] = useState<LiveSnapshot | null>(live?.snapshot() ?? null);
  const [lastBall, setLastBall] = useState<Ball | null>(null);
  const [calls, setCalls] = useState<MatchdayCalls>({ approach: null, nextBowlerId: null, targetBowlerId: null });
  const [tab, setTab] = useState('commentary');
  const finishing = useRef(false);
  const reduceMotion = useReducedMotion(false);
  // Full auto: one ball at a time at the chosen speed, until paused or play stops.
  const [autoPlay, setAutoPlay] = useState(false);
  const [speed, setSpeed] = useState(() => useAppSettings.getState().defaultSimSpeed);
  const preview = useMemo(() => createLiveMatch(buildSetup(state, fixture)).snapshot(), [state, fixture]);
  const tactics = tacticsFor(state, state.franchiseId);
  const problems = holds(state, 'SELECTION') ? xiProblems(state, state.franchiseId, state.tactics.xiIds, state.tactics.wicketkeeperId) : [];
  const opponentId = fixture.homeId === state.franchiseId ? fixture.awayId : fixture.homeId;
  const venue = venueFor(state, fixture);
  const canControl = holds(state, 'MATCHDAY');

  /** Write the finished match into the career - once. */
  const finish = (match = live?.finished()?.match) => {
    if (!match || finishing.current) return;
    finishing.current = true;
    sessions.delete(fixture.id);
    const current = useManagerStore.getState().state!;
    replace(produce(current, (d) => void applyResult(d, fixture.id, match)));
    navigate(`/manager/match/${fixture.id}/report`, { replace: true });
  };

  const sync = (ball?: Ball | null) => {
    if (!live) return;
    const s = live.snapshot();
    setSnap(s);
    if (ball !== undefined) setLastBall(ball);
    if (s.phase === 'COMPLETE') finish(live.finished()?.match);
  };

  useEffect(() => {
    if (snap?.phase === 'COMPLETE') finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    const m = createLiveMatch({ ...buildSetup(state, fixture), userIsCaptain: canControl });
    sessions.set(fixture.id, m);
    setLive(m);
    setSnap(m.snapshot());
  };

  const step = (kind: 'ball' | 'over' | 'wicket' | 'innings' | 'end') => {
    if (!live) return;
    const o = overridesFor(state, live, tactics, calls);
    let ball: Ball | null = null;
    if (kind === 'ball') ball = live.nextBall(o);
    else if (kind === 'over') ball = live.nextOver(o).at(-1) ?? null;
    else if (kind === 'wicket') {
      // Over by over, so the bowling plan keeps choosing bowlers.
      let guard = 0;
      while (live.snapshot().phase === 'IN_PLAY' && guard < 60) {
        guard += 1;
        const balls = live.nextOver(overridesFor(state, live, tactics, calls));
        ball = balls.at(-1) ?? ball;
        if (balls.some((b) => b.wicket) || balls.length === 0) break;
      }
    } else {
      let guard = 0;
      const startInnings = live.snapshot().current?.number;
      while (guard < 400) {
        guard += 1;
        const s = live.snapshot();
        if (s.phase === 'COMPLETE') break;
        if (s.phase === 'INNINGS_BREAK') {
          if (kind === 'innings') break;
          live.startNextInnings();
          continue;
        }
        if (s.phase !== 'IN_PLAY') break;
        if (kind === 'innings' && s.current?.number !== startInnings) break;
        const balls = live.nextOver(overridesFor(state, live, tactics, calls));
        ball = balls.at(-1) ?? ball;
        if (balls.length === 0) break;
      }
    }
    // The manager's pick for the next over is used once.
    if (calls.nextBowlerId) setCalls((c) => ({ ...c, nextBowlerId: null }));
    sync(ball);
  };

  const quick = () => finish(quickSimFixture(state, fixture));

  // Match sound: bat, stumps and crowd, as in a career match.
  useMatchAudio({
    lastBall,
    snap,
    playing: Boolean(live && snap && snap.phase !== 'COMPLETE'),
    userId: null,
    userTeamId: state.franchiseId,
  });

  // Auto play bowls the next ball after a pause; it stops when play stops.
  const inPlay = snap?.phase === 'IN_PLAY';
  useEffect(() => {
    if (!autoPlay) return;
    if (!inPlay) {
      setAutoPlay(false);
      return;
    }
    const timer = window.setTimeout(() => step('ball'), BALL_SPEEDS[speed]?.ms ?? 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, inPlay, snap, speed]);

  /* ----------------------------- pre-match ------------------------------ */
  if (!live || !snap) {
    const advice = selectionAdvice(state, state.franchiseId, tactics);
    const opp = state.franchises[opponentId];
    const oppXi = tacticsFor(state, opponentId).xiIds.map((id) => state.players[id]).filter(Boolean);
    return (
      <div className="flex flex-col gap-3 pb-4">
        <PageHeader title="Pre-match" subtitle={`${fixture.stage === 'LEAGUE' ? `League round ${fixture.round}` : PHASE_LABEL.PLAYOFFS + ' · ' + fixture.stage.replace('_', ' ').toLowerCase()} · ${venue.name}, ${venue.city}`} />
        <Card className="flex flex-wrap items-center justify-center gap-6 py-6">
          <TeamBadge state={state} id={fixture.homeId} />
          <span className="text-[14px] font-bold text-ink-muted">vs</span>
          <TeamBadge state={state} id={fixture.awayId} />
        </Card>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader title="Conditions" className="mb-2" />
            <p className="flex items-center gap-2 text-[13px] text-ink"><CloudSun className="size-4 text-brand-blue" aria-hidden /> {preview.conditions.weather.type.toLowerCase().replace('_', ' ')}, {Math.round(preview.conditions.weather.temperature)}°C</p>
            <StatLine label="Pitch" value={preview.conditions.pitch.type.toLowerCase()} />
            <StatLine label="Batting ease" value={`${Math.round(preview.conditions.pitch.battingEase)}/100`} />
            <StatLine label="Turn / seam" value={`${Math.round(preview.conditions.pitch.turn)} / ${Math.round(preview.conditions.pitch.seamMovement)}`} />
            <StatLine label="Dew expected" value={venue.dewFactor >= 50 ? 'Heavy' : venue.dewFactor >= 35 ? 'Some' : 'Little'} />
          </Card>
          <Card>
            <CardHeader title="Your XI and plan" action={holds(state, 'SELECTION') ? { label: 'Edit XI', to: '/manager/xi' } : undefined} className="mb-2" />
            <ol className="grid gap-0.5 text-[12.5px]">
              {tactics.xiIds.map((id, i) => <li key={id}>{i + 1}. {nameOf(state, id)}{id === tactics.wicketkeeperId ? ' (wk)' : ''}{id === tactics.captainId ? ' (c)' : ''}</li>)}
            </ol>
            <p className="mt-2 text-[12.5px] text-ink-muted">Approach: <strong className="text-ink">{tactics.battingApproach.toLowerCase()}</strong> · <Link to="/manager/tactics" className="font-semibold text-brand-blue">Tactics</Link></p>
          </Card>
          <Card>
            <CardHeader title={`${opp.short}: analysis`} className="mb-2" />
            <p className="text-[12.5px] text-ink-muted">Their likely XI:</p>
            <p className="text-[12.5px] text-ink">{oppXi.map((p) => p.name).join(', ')}</p>
            {advice.length ? (
              <div className="mt-2 rounded-lg bg-brand-blue-soft px-3 py-2">
                <p className="text-[12px] font-semibold text-brand-blue">Analyst (advice only)</p>
                <ul className="list-disc pl-5 text-[12.5px] text-ink">{advice.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            ) : null}
          </Card>
        </div>
        {problems.length ? <p role="alert" className="rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3 text-[13px]">Your XI is not legal: {problems[0]} <Link className="font-semibold text-brand-blue" to="/manager/xi">Fix it</Link></p> : null}
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">{canControl ? 'Take the match ball by ball with full tactical control, or simulate it on your plan.' : 'You are not in charge on matchday yet - the head coach runs the match on the plan.'}</p>
          <div className="flex flex-wrap gap-2">
            {canControl ? (
              <Button disabled={problems.length > 0} onClick={start}>
                <Play className="size-4 fill-white" aria-hidden /> Play live
              </Button>
            ) : null}
            <Button variant="gold" disabled={problems.length > 0} onClick={quick}>
              <FastForward className="size-4" aria-hidden /> Quick sim
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------- live -------------------------------- */
  const cur = snap.current;
  const team = (id: string) => shortOf(state, id);
  const playerName = (id: string) => live.playerById(id)?.name ?? nameOf(state, id);
  const userBatting = cur?.battingTeamId === state.franchiseId;
  const available = !userBatting && cur ? live.availableBowlers() : [];
  const planned = !userBatting && cur ? overridesFor(state, live, tactics, calls).bowlerId : undefined;
  const bowler = cur?.bowlerId ? live.playerById(cur.bowlerId) : null;
  const striker = cur ? live.playerById(cur.strikerId) : null;
  const tossOpen = snap.phase === 'TOSS';

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={`${team(fixture.homeId)} v ${team(fixture.awayId)}`} subtitle={`${venue.name} · ${fixture.stage === 'LEAGUE' ? `Round ${fixture.round}` : fixture.stage.replace('_', ' ').toLowerCase()}`}>
        <Button variant="secondary" onClick={() => step('end')}>
          <SkipForward className="size-4" aria-hidden /> Sim to end
        </Button>
      </PageHeader>

      {tossOpen ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-ink">The toss. If your captain wins it:</p>
          <div className="flex gap-2">
            <Button onClick={() => { live.doToss('BAT'); sync(null); }}>Bat first</Button>
            <Button variant="secondary" onClick={() => { live.doToss('BOWL'); sync(null); }}>Bowl first</Button>
          </div>
        </Card>
      ) : null}

      {cur ? (
        <>
          <ScoreStrip snap={snap} battingTeam={team(cur.battingTeamId)} bowlingTeam={team(cur.bowlingTeamId)} nameOf={playerName} />
          <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
            <Card flush className="overflow-hidden">
              <GroundView
                venue={venue}
                conditions={cur.conditions}
                field={snap.field}
                ball={lastBall}
                leftHanded={striker?.battingStyle === 'LEFT_HAND_BAT'}
                userId={null}
                bowlerId={cur.bowlerId}
                batters={{ strikerId: cur.strikerId, nonStrikerId: cur.nonStrikerId, labelOf: playerName }}
                leftArmBowler={Boolean(bowler?.bowlingStyle.startsWith('LEFT_ARM'))}
                durationMs={reduceMotion ? 0 : 700}
                reduceMotion={reduceMotion}
              />
            </Card>
            <Card>
              <CardHeader title={userBatting ? 'You are batting' : 'You are bowling'} subtitle={cur.target !== null ? `Need ${Math.max(0, cur.target - cur.runs)} from ${Math.max(0, cur.balls >= 0 ? 120 - cur.balls : 0)} · RRR ${cur.requiredRate?.toFixed(2) ?? '-'}` : `Run rate ${cur.runRate.toFixed(2)} · partnership ${cur.partnership.runs} (${cur.partnership.balls})`} className="mb-3" />
              {userBatting ? (
                <div className="grid gap-2">
                  <fieldset>
                    <legend className="mb-1 text-[12px] font-semibold text-ink-muted">Batting approach (rest of the match)</legend>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Batting approach">
                      {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as BattingApproachSetting[]).map((a) => {
                        const active = (calls.approach ?? tactics.battingApproach) === a;
                        return (
                          <button key={a} type="button" role="radio" aria-checked={active} onClick={() => setCalls({ ...calls, approach: a })} className={cn('min-h-11 rounded-lg text-[12px] font-semibold', active ? (a === 'AGGRESSIVE' ? 'bg-brand-red text-white' : a === 'CONSERVATIVE' ? 'bg-brand-green text-white' : 'bg-brand-gold text-brand-navy') : 'bg-page text-ink-muted')}>
                            {a === 'CONSERVATIVE' ? 'Defend' : a === 'BALANCED' ? 'Balanced' : 'Attack'}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <Select label="Go after this bowler" value={calls.targetBowlerId ?? ''} options={[{ id: '', label: 'No target' }, ...cur.bowling.map((b) => ({ id: b.playerId, label: `${b.name} (${b.overs.toFixed(1)}-${b.runsConceded}-${b.wickets})` }))]} onChange={(v) => setCalls({ ...calls, targetBowlerId: v || null })} />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Select
                    label={`Next over (plan: ${planned ? playerName(planned) : '-'})`}
                    value={calls.nextBowlerId ?? ''}
                    options={[{ id: '', label: 'Follow the plan' }, ...available.map((b) => ({ id: b.id, label: `${b.name} · ${cur.oversBowledBy[b.id] ?? 0}/${cur.maxOversPerBowler ?? '-'} ov` }))]}
                    onChange={(v) => setCalls({ ...calls, nextBowlerId: v || null })}
                    disabled={cur.balls % 6 !== 0 && cur.bowlerId !== null}
                  />
                  <p className="text-[11.5px] text-ink-muted">Bowling now: {bowler?.name ?? '-'}. Changes take effect from the next over.</p>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => step('ball')} disabled={snap.phase !== 'IN_PLAY' || autoPlay}><Play className="size-4 fill-white" aria-hidden /> Next ball</Button>
                <Button variant="ghost" onClick={() => step('over')} disabled={snap.phase !== 'IN_PLAY' || autoPlay}><FastForward className="size-4" aria-hidden /> Next over</Button>
                <Button variant="secondary" onClick={() => step('wicket')} disabled={snap.phase !== 'IN_PLAY' || autoPlay}><Swords className="size-4" aria-hidden /> To a wicket</Button>
                <Button variant="secondary" onClick={() => step('innings')} disabled={snap.phase !== 'IN_PLAY' || autoPlay}><Zap className="size-4" aria-hidden /> End of innings</Button>
              </div>
            </Card>
          </div>
          {/* Phone and tablet: the play buttons stay within thumb reach. */}
          <div className="sticky bottom-[76px] z-20 md:bottom-3 xl:hidden">
            <Card className="p-2 shadow-card-hover">
              <SimControls
                compact
                autoPlay={autoPlay}
                speed={speed}
                busy={!inPlay}
                playing={false}
                onBall={() => step('ball')}
                onOver={() => step('over')}
                onWicket={() => step('wicket')}
                onInvolved={() => step('wicket')}
                onInnings={() => step('innings')}
                onAuto={setAutoPlay}
                onSimRest={() => step('end')}
                onSpeed={setSpeed}
              />
            </Card>
          </div>
        </>
      ) : null}

      {snap.phase === 'INNINGS_BREAK' ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-ink">Innings break</p>
            {snap.impactChoice?.suggestion ? (
              <p className="text-[12.5px] text-ink-muted">
                Impact player: {playerName(snap.impactChoice.suggestion.inId)} for {playerName(snap.impactChoice.suggestion.outId)} (analyst's pick).
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {snap.impactChoice?.suggestion ? (
              <Button variant="secondary" onClick={() => { live.chooseImpact(null, null); sync(); }}>No impact sub</Button>
            ) : null}
            <Button onClick={() => { live.startNextInnings(); sync(null); }}>Start the chase</Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <Tabs label="Match detail" value={tab} onChange={setTab} tabs={[{ id: 'commentary', label: 'Commentary' }, { id: 'scorecard', label: 'Scorecard' }, { id: 'events', label: 'Key events' }]} className="mb-3" />
        {tab === 'commentary' && cur ? <CommentaryFeed deliveries={cur.deliveries} innings={cur.innings} battingTeam={team(cur.battingTeamId)} limit={40} /> : null}
        {tab === 'scorecard' ? (
          <div className="grid gap-4">
            {[...snap.completed, ...(cur ? [cur.innings] : [])].map((inn) => <Scorecard key={inn.id} innings={inn} battingTeam={team(inn.battingTeamId)} bowlingTeam={team(inn.bowlingTeamId)} strikerId={cur?.innings.id === inn.id ? cur.strikerId : null} />)}
          </div>
        ) : null}
        {tab === 'events' ? (
          <ul className="grid gap-1 text-[12.5px]" aria-live="polite">
            {[...snap.alerts].reverse().slice(0, 30).map((a) => (
              <li key={a.id} className="flex gap-2"><ToneBadge tone={a.kind === 'WICKET' || a.kind === 'COLLAPSE' ? 'red' : a.kind === 'MILESTONE' ? 'gold' : 'grey'}>{a.kind.toLowerCase()}</ToneBadge> {a.text}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

function TeamBadge({ state, id }: { state: ManagerState; id: string }) {
  const f = state.franchises[id];
  return (
    <div className="flex flex-col items-center gap-1">
      <FranchiseCrest franchise={f} size={64} />
      <p className={cn('text-[15px] font-bold', id === state.franchiseId ? 'text-brand-blue' : 'text-ink')}>{f.short}</p>
      <p className="text-[11.5px] text-ink-muted">{f.city}</p>
    </div>
  );
}

/** Scorecard and match report for a played fixture. */
export function MatchReportScreen() {
  const { fixtureId } = useParams();
  const { state } = useManager();
  const fixture = state.season.fixtures.find((f) => f.id === fixtureId);
  const archived = fixture?.result?.archiveId ? state.matchArchive[fixture.result.archiveId] : Object.values(state.matchArchive).find((m) => m.fixtureId === fixtureId && m.season === state.season.year);
  if (!fixture?.result) {
    return (
      <div className="pb-4">
        <PageHeader title="Match report" />
        <EmptyState icon={Swords} title="No result yet" message="This match has not been played." action={{ label: 'Fixtures', to: '/manager/fixtures' }} />
      </div>
    );
  }
  const r = fixture.result;
  const team = (id: string) => shortOf(state, id);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Match report" subtitle={`${team(fixture.homeId)} v ${team(fixture.awayId)} · ${fixture.stage === 'LEAGUE' ? `Round ${fixture.round}` : fixture.stage.replace('_', ' ').toLowerCase()}`}>
        <LinkButton to="/manager" variant="gold">Continue</LinkButton>
      </PageHeader>
      <Card className="flex flex-wrap items-center justify-around gap-4 py-5 text-center">
        <div><FranchiseCrest franchise={state.franchises[fixture.homeId]} size={48} /><p className="mt-1 text-[18px] font-bold">{r.homeRuns}/{r.homeWickets}</p><p className="text-[11.5px] text-ink-muted">{Math.floor(r.homeBalls / 6)}.{r.homeBalls % 6} ov</p></div>
        <div>
          <p className={cn('text-[15px] font-bold', r.winnerId === state.franchiseId ? 'text-brand-green' : r.winnerId ? 'text-brand-red' : 'text-ink')}>{r.winnerId ? `${team(r.winnerId)} won` : 'No result'}</p>
          <p className="text-[12.5px] text-ink-muted">{r.summary}</p>
          {r.playerOfMatchId ? <p className="mt-1 text-[12.5px]">Player of the match: <strong>{nameOf(state, r.playerOfMatchId)}</strong></p> : null}
        </div>
        <div><FranchiseCrest franchise={state.franchises[fixture.awayId]} size={48} /><p className="mt-1 text-[18px] font-bold">{r.awayRuns}/{r.awayWickets}</p><p className="text-[11.5px] text-ink-muted">{Math.floor(r.awayBalls / 6)}.{r.awayBalls % 6} ov</p></div>
      </Card>
      {archived ? (
        <>
          <Card>
            <CardHeader title="How it happened" className="mb-2" />
            <ul className="list-disc pl-5 text-[13px] text-ink">{archived.report.map((l) => <li key={l}>{l}</li>)}</ul>
          </Card>
          <Card>
            <div className="grid gap-5">
              {archived.innings.map((inn) => <Scorecard key={inn.id} innings={inn} battingTeam={team(inn.battingTeamId)} bowlingTeam={team(inn.bowlingTeamId)} />)}
            </div>
          </Card>
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">Only the score was kept for this match.</p>
      )}
    </div>
  );
}
