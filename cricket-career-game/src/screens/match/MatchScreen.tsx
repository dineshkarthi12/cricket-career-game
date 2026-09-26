/**
 * The match route. It owns nothing but which stage is on screen - pre-match,
 * the toss, the middle, an innings break, or the aftermath - and the clock
 * that plays the match on while the player is not needed.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Coins, Crown, Lightbulb, XCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { normalise } from '@/engine/match/skill';
import { tossHint } from '@/lib/tossHint';
import { useGameStore } from '@/store/gameStore';
import { BALL_SPEEDS, WATCH_SPEED, useMatchStore } from '@/store/matchStore';
import { InPlay } from './InPlay';
import { InningsBreak } from './InningsBreak';
import { PostMatch } from './PostMatch';
import { PreMatch } from './PreMatch';
import { QuestionModal } from './QuestionModal';
import { PitchReport, WeatherReport } from './panels/MatchInfo';
import { ANIMATION_FACTOR, useAppSettings, useReducedMotion } from '@/store/appSettings';
import { useMatchAudio } from '@/lib/audio/useMatchAudio';

export default function MatchScreen() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const state = useGameStore((s) => s.state);
  const booted = useGameStore((s) => s.booted);
  const store = useMatchStore();
  const { stage, fixture, selection, snap, build, speed, autoPlay, autoWatch, after, error } =
    store;
  const [tossSeen, setTossSeen] = useState(false);
  const animationSpeed = useAppSettings((s) => s.animationSpeed);
  const reduceMotion = useReducedMotion(state?.settings.reduceMotion ?? false);

  // Open the fixture when the route changes.
  useEffect(() => {
    if (!state || !fixtureId) return;
    if (store.fixture?.id === fixtureId) return;
    const target = state.fixtures[fixtureId];
    if (!target) {
      navigate('/matches', { replace: true });
      return;
    }
    setTossSeen(false);
    store.open(state, target);
    // `store` is a fresh object each render; the fixture id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId, state?.seed]);

  const venue = useMemo(() => {
    if (!state) return null;
    return (
      (fixture?.venueId ? state.venues[fixture.venueId] : null) ??
      Object.values(state.venues)[0] ??
      null
    );
  }, [fixture?.venueId, state]);

  // The clock: full auto at the chosen speed, or - while the player is not
  // needed - on at watching speed. It stops for every question, and for a
  // captain choosing the next over's bowler.
  const involved = Boolean(snap?.involvement.onStrike || snap?.involvement.bowling);
  const choosingBowler =
    store.captain &&
    !store.delegate?.bowling &&
    Boolean(snap?.userBowling) &&
    (snap?.current?.balls ?? 1) % 6 === 0 &&
    !store.captainDecisions.nextBowlerId;
  const watching = autoWatch && !involved && !choosingBowler;
  const ticking =
    stage === 'PLAYING' &&
    tossSeen &&
    snap?.phase === 'IN_PLAY' &&
    !snap.question &&
    (autoPlay || watching);
  const tickMs = autoPlay ? BALL_SPEEDS[speed].ms : BALL_SPEEDS[WATCH_SPEED].ms;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setTimeout(() => useMatchStore.getState().playBall(), tickMs);
    return () => window.clearTimeout(timer);
  }, [ticking, tickMs, snap]);

  const teams = state?.teams;
  const teamName = useCallback((id: string) => teams?.[id]?.name ?? 'they', [teams]);
  useMatchAudio({
    lastBall: store.lastBall,
    snap,
    playing: stage === 'PLAYING' && tossSeen,
    userId: state?.player.id ?? null,
    userTeamId: build?.userTeamId ?? null,
    teamName,
    ballMs: ticking ? tickMs : BALL_SPEEDS[speed].ms,
  });

  if (!booted) return <Notice text="Loading…" />;
  if (!state) return <Notice text="No career loaded." />;
  if (error) return <Notice text={error} />;
  if (!fixture || !venue || !selection) return <Notice text="Getting the match ready…" />;

  const teamNameOf = (id: string) => state.teams[id]?.shortName ?? state.teams[id]?.name ?? id;
  const userName = `${state.player.firstName} ${state.player.lastName}`;
  const nameOf = (id: string) =>
    store.playerById(id)?.name ?? (id === state.player.id ? userName : 'Player');
  const tournamentName = fixture.tournamentId
    ? (TOURNAMENTS_BY_ID[fixture.tournamentId]?.name ?? 'Friendly')
    : 'Friendly';

  if (stage === 'PRE_MATCH') {
    return (
      <>
        {import.meta.env.DEV ? (
          <DevCaptainToggle
            on={state.settings.devCaptainMode}
            onChange={(on) => {
              useGameStore.getState().update((s) => ({
                ...s,
                settings: { ...s.settings, devCaptainMode: on },
              }));
              const next = useGameStore.getState().state;
              if (next) store.open(next, next.fixtures[fixture.id] ?? fixture);
            }}
          />
        ) : null}
        <PreMatch
          state={state}
          fixture={fixture}
          selection={selection}
          captain={store.captain}
          proposedIds={store.proposedIds}
          snap={snap}
          onToggle={store.toggleProposed}
          onMove={store.moveProposed}
          onReset={store.resetProposed}
          onToss={store.toToss}
          onQuickSim={() => {
            const match = store.quickSim(state, fixture);
            store.close();
            if (match) navigate(`/matches/${match.id}`, { replace: true });
          }}
          onBack={() => navigate('/')}
        />
      </>
    );
  }

  // The toss, and what the selectors made of a captain's XI.
  if (snap && (snap.phase === 'TOSS' || (stage === 'PLAYING' && !tossSeen))) {
    const hint = tossHint(snap.conditions, snap.format, venue, snap.underLights);
    const callsToss = store.captain && !store.delegate?.toss;
    return (
      <div className="flex flex-col gap-4 pb-4">
        {store.xiReview &&
        (store.xiReview.accepted.length > 0 || store.xiReview.overruled.length > 0) ? (
          <Card>
            <CardHeader title="The selectors on your XI" />
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {store.xiReview.accepted.map((c) => (
                <li key={c.inId} className="flex items-start gap-1.5 text-[12.5px] text-ink">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
                  {nameFrom(selection, c.inId)} in for {nameFrom(selection, c.outId)} - agreed.
                </li>
              ))}
              {store.xiReview.overruled.map((c) => (
                <li key={c.inId} className="flex items-start gap-1.5 text-[12.5px] text-ink">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden />
                  {nameFrom(selection, c.inId)} for {nameFrom(selection, c.outId)} - overruled.{' '}
                  {c.reason}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-gold/20 text-brand-gold">
              <Coins className="size-7" aria-hidden />
            </span>
            <h1 className="mt-3 text-[20px] font-semibold text-ink">The toss</h1>

            {snap.toss ? (
              <>
                <p className="mt-2 text-[14px] text-ink">
                  <span className="font-semibold">{teamNameOf(snap.toss.winnerTeamId)}</span> won
                  the toss and chose to{' '}
                  <span className="font-semibold">
                    {snap.toss.decision === 'BAT' ? 'bat' : 'bowl'}
                  </span>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => setTossSeen(true)}
                  className="mt-4 rounded-xl bg-brand-blue px-5 py-3 text-[14px] font-semibold text-white hover:bg-brand-blue/90"
                >
                  Out to the middle
                </button>
              </>
            ) : callsToss ? (
              <>
                <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px] text-ink-muted">
                  <Crown className="size-3.5 text-brand-gold" aria-hidden />
                  Your call if you win it.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => store.toss('BAT')}
                    className={`rounded-xl px-4 py-3 text-[14px] font-semibold ${
                      hint.lean === 'BAT'
                        ? 'bg-brand-blue text-white hover:bg-brand-blue/90'
                        : 'border border-line bg-surface text-ink hover:bg-page'
                    }`}
                  >
                    Win it, bat first
                  </button>
                  <button
                    type="button"
                    onClick={() => store.toss('BOWL')}
                    className={`rounded-xl px-4 py-3 text-[14px] font-semibold ${
                      hint.lean === 'BOWL'
                        ? 'bg-brand-blue text-white hover:bg-brand-blue/90'
                        : 'border border-line bg-surface text-ink hover:bg-page'
                    }`}
                  >
                    Win it, bowl first
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] text-ink-muted">
                  {store.captain
                    ? 'The vice-captain is calling today.'
                    : 'The two captains are out in the middle.'}
                </p>
                <button
                  type="button"
                  onClick={() => store.toss()}
                  className="mt-4 rounded-xl bg-brand-blue px-5 py-3 text-[14px] font-semibold text-white hover:bg-brand-blue/90"
                >
                  Spin the coin
                </button>
              </>
            )}

            <div className="mt-5 rounded-lg bg-brand-blue-soft px-3 py-2.5 text-left">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue">
                <Lightbulb className="size-3.5" aria-hidden />
                Reading the conditions:{' '}
                {hint.lean === 'EITHER'
                  ? 'either way'
                  : hint.lean === 'BAT'
                    ? 'bat first'
                    : 'bowl first'}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {hint.reasons.map((reason) => (
                  <li key={reason} className="text-[12px] text-ink-muted">
                    · {reason}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Pitch report" />
              <div className="mt-2.5">
                <PitchReport conditions={snap.conditions} />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Conditions"
                subtitle={snap.underLights ? 'Day-night: under lights later' : undefined}
              />
              <div className="mt-2.5">
                <WeatherReport conditions={snap.conditions} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'BREAK' && snap) {
    return (
      <InningsBreak
        snap={snap}
        teamNameOf={teamNameOf}
        userPlayerId={state.player.id}
        onContinue={store.startNextInnings}
        onSimulateRest={store.simulateRest}
        onFollowOn={store.chooseFollowOn}
        onImpact={store.chooseImpact}
      />
    );
  }

  if (stage === 'DONE' && after) {
    return (
      <PostMatch
        after={after}
        venue={venue}
        teamNameOf={teamNameOf}
        nameOf={nameOf}
        player={state.player}
        captaincy={state.career.captaincy}
        mediaNow={state.career.mediaReputation}
        teamMoraleNow={
          state.teams[after.match.userIsHome ? after.match.homeTeamId : after.match.awayTeamId]
            ?.morale ?? null
        }
        leftHanded={state.player.battingStyle === 'LEFT_HAND_BAT'}
        onPress={store.answerPress}
        onClose={() => {
          store.close();
          navigate('/');
        }}
      />
    );
  }

  if (stage === 'PLAYING' && snap?.current && build) {
    const home = fixture.homeTeamId ? teamNameOf(fixture.homeTeamId) : 'Home';
    const away = fixture.awayTeamId ? teamNameOf(fixture.awayTeamId) : 'Away';
    const question = snap.question;
    const fielding = state.player.attributes.fielding;
    const skill =
      question?.kind === 'RUN_OUT'
        ? normalise((fielding.throwing + fielding.groundFielding) / 2)
        : normalise(fielding.catching);
    const reviewSide = question?.kind === 'REVIEW' ? question.side : null;

    return (
      <>
        <InPlay
          snap={snap}
          venue={venue}
          tournamentName={tournamentName}
          homeTeam={home}
          awayTeam={away}
          teamNameOf={teamNameOf}
          playerById={store.playerById}
          riskFor={store.riskFor}
          userId={state.player.id}
          userName={userName}
          captain={store.captain}
          delegate={store.delegate ?? state.career.captaincy.delegate}
          availableBowlers={store.availableBowlers()}
          suggestedBowler={store.captain && snap.userBowling ? store.suggestedBowler() : null}
          player={store.player}
          captainDecisions={store.captainDecisions}
          lastBall={store.lastBall}
          ballMs={(ticking && !autoPlay ? BALL_SPEEDS[WATCH_SPEED].ms : BALL_SPEEDS[speed].ms) * ANIMATION_FACTOR[animationSpeed]}
          reduceMotion={reduceMotion}
          autoPlay={autoPlay}
          autoWatch={autoWatch}
          speed={speed}
          onPlay={store.playBall}
          onOver={store.nextOver}
          onWicket={store.toNextWicket}
          onInvolved={store.untilInvolved}
          onUntilOut={store.untilDismissed}
          onInnings={store.toEndOfInnings}
          onSimRest={store.simulateRest}
          onDeclare={store.declare}
          onAuto={store.setAutoPlay}
          onAutoWatch={store.setAutoWatch}
          onSpeed={store.setSpeed}
          onPlayer={store.setPlayer}
          onCaptain={store.setCaptain}
          onDelegate={store.setDelegate}
        />
        {question ? (
          <QuestionModal
            question={question}
            skill={skill}
            reviewsLeft={
              reviewSide === 'BOWLING'
                ? snap.current.reviewsLeft.bowling
                : snap.current.reviewsLeft.batting
            }
            batterName={question.kind === 'REVIEW' ? nameOf(question.batterId) : ''}
            onAnswer={store.answer}
          />
        ) : null}
        {/* Screen readers hear each alert as it happens. */}
        <span className="sr-only" aria-live="polite">
          {snap.alerts.at(-1)?.text}
        </span>
      </>
    );
  }

  return <Notice text="Getting the match ready…" />;
}

function nameFrom(
  selection: { ranked: { player: { id: string; name: string } }[] },
  id: string,
): string {
  return selection.ranked.find((r) => r.player.id === id)?.player.name ?? 'A player';
}

/** Development only: switch captain mode on for this career. */
function DevCaptainToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-brand-orange/60 bg-brand-orange/5 px-3 py-2 text-[12px] text-ink">
      <span>
        <span className="font-bold text-brand-orange">DEV</span> Test captain mode before the career
        reaches it
      </span>
      <label className="flex items-center gap-1.5 font-semibold">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-brand-orange"
        />
        Captain
      </label>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <p className="text-[13.5px] text-ink-muted">{text}</p>
    </Card>
  );
}
