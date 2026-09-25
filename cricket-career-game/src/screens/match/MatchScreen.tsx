/**
 * The match route. It owns nothing but which stage is on screen: the pre-match
 * build-up, the toss, the middle, an innings break, or the aftermath.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { Card } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { useGameStore } from '@/store/gameStore';
import { BALL_SPEEDS, useMatchStore } from '@/store/matchStore';
import type { Condition } from '@/types';
import { InPlay } from './InPlay';
import { InningsBreak } from './InningsBreak';
import { PostMatch } from './PostMatch';
import { PreMatch } from './PreMatch';

export default function MatchScreen() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const state = useGameStore((s) => s.state);
  const booted = useGameStore((s) => s.booted);

  const store = useMatchStore();
  const {
    stage,
    fixture,
    snap,
    squad,
    xiIds,
    decisions,
    speed,
    autoPlay,
    lastBall,
    committed,
    error,
  } = store;

  const [showWagonWheel, setShowWagonWheel] = useState(false);
  /** Condition before the match, kept so the post-match card can show the change. */
  const conditionBefore = useRef<Condition | null>(null);

  // Open the fixture when the route changes.
  useEffect(() => {
    if (!state || !fixtureId) return;
    if (store.fixture?.id === fixtureId) return;
    const target = state.fixtures[fixtureId];
    if (!target) {
      navigate('/matches', { replace: true });
      return;
    }
    conditionBefore.current = structuredClone(state.player.condition);
    store.open(state, target);
    // `store` is a fresh object each render; the fixture id is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId, state?.seed]);

  // Auto play: one ball every `ms` until it is switched off or play stops.
  const ms = BALL_SPEEDS[speed].ms;
  useEffect(() => {
    if (!autoPlay || stage !== 'PLAYING' || snap?.phase !== 'IN_PLAY') return;
    const timer = window.setTimeout(() => useMatchStore.getState().nextBall(), ms);
    return () => window.clearTimeout(timer);
  }, [autoPlay, ms, stage, snap?.phase, snap?.current?.balls, snap?.current?.number]);

  const venue = useMemo(() => {
    if (!state) return null;
    const fromFixture = fixture?.venueId ? state.venues[fixture.venueId] : null;
    return fromFixture ?? Object.values(state.venues)[0] ?? null;
  }, [fixture?.venueId, state]);

  if (!booted) return <Notice text="Loading…" />;
  if (!state) return <Notice text="No career loaded." />;
  if (error) return <Notice text={error} />;
  if (!fixture || !venue) return <Notice text="Getting the match ready…" />;

  const teamNameOf = (id: string) => state.teams[id]?.shortName ?? state.teams[id]?.name ?? id;
  const nameOf = (id: string) =>
    store.playerById(id)?.name ??
    (id === state.player.id ? `${state.player.firstName} ${state.player.lastName}` : 'Player');
  const tournamentName = fixture.tournamentId
    ? (TOURNAMENTS_BY_ID[fixture.tournamentId]?.name ?? 'Friendly')
    : 'Friendly';

  // Pre-match: pick the side.
  if (stage === 'PRE_MATCH') {
    return (
      <PreMatch
        state={state}
        fixture={fixture}
        squad={squad}
        xiIds={xiIds}
        snap={snap}
        onToggle={store.toggleXi}
        onReset={store.resetXi}
        onStart={store.start}
        onQuickSim={() => {
          const match = store.quickSim(state, fixture);
          if (match) navigate('/matches', { replace: true });
        }}
        onBack={() => navigate('/')}
      />
    );
  }

  // The toss.
  if (snap && snap.phase === 'TOSS') {
    const userTeam = Object.values(state.teams).find((team) => team.isUserTeam);
    return <Toss isCaptain={userTeam?.captainId === state.player.id} onToss={store.toss} />;
  }

  if (stage === 'BREAK' && snap) {
    return (
      <InningsBreak
        snap={snap}
        teamNameOf={teamNameOf}
        userPlayerId={state.player.id}
        onContinue={store.startNextInnings}
        onSimulateRest={store.simulateRest}
      />
    );
  }

  if (stage === 'DONE' && committed) {
    const striker = state.player.battingStyle === 'LEFT_HAND_BAT';
    return (
      <PostMatch
        match={committed}
        venue={venue}
        teamNameOf={teamNameOf}
        nameOf={nameOf}
        player={state.player}
        conditionBefore={conditionBefore.current}
        leftHanded={striker}
        onClose={() => {
          store.close();
          navigate('/');
        }}
      />
    );
  }

  if (stage === 'PLAYING' && snap?.current) {
    const home = fixture.homeTeamId ? teamNameOf(fixture.homeTeamId) : 'Home';
    const away = fixture.awayTeamId ? teamNameOf(fixture.awayTeamId) : 'Away';
    return (
      <InPlay
        snap={snap}
        venue={venue}
        tournamentName={tournamentName}
        homeTeam={home}
        awayTeam={away}
        teamNameOf={teamNameOf}
        playerById={store.playerById}
        availableBowlers={store.availableBowlers()}
        userPlayerId={state.player.id}
        lastBall={lastBall}
        ballMs={ms}
        reduceMotion={state.settings.reduceMotion}
        decisions={decisions}
        autoPlay={autoPlay}
        speed={speed}
        onDecisions={store.setDecisions}
        onBall={store.nextBall}
        onOver={store.nextOver}
        onWicket={store.toNextWicket}
        onInnings={store.toEndOfInnings}
        onAuto={store.setAutoPlay}
        onSpeed={store.setSpeed}
        showWagonWheel={showWagonWheel}
        onToggleWagonWheel={setShowWagonWheel}
      />
    );
  }

  return <Notice text="Getting the match ready…" />;
}

function Toss({ isCaptain, onToss }: { isCaptain: boolean; onToss: (d?: 'BAT' | 'BOWL') => void }) {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card className="mx-auto max-w-lg text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-gold/20 text-brand-gold">
          <Coins className="size-7" aria-hidden />
        </span>
        <h1 className="mt-3 text-[20px] font-semibold text-ink">The toss</h1>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          {isCaptain
            ? 'You are captain. Win it and the call is yours.'
            : 'The two captains are out in the middle.'}
        </p>

        {isCaptain ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onToss('BAT')}
              className="rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white hover:bg-brand-blue/90"
            >
              Bat first
            </button>
            <button
              type="button"
              onClick={() => onToss('BOWL')}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-[14px] font-semibold text-ink hover:bg-page"
            >
              Bowl first
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onToss()}
            className="mt-4 rounded-xl bg-brand-blue px-5 py-3 text-[14px] font-semibold text-white hover:bg-brand-blue/90"
          >
            Spin the coin
          </button>
        )}
      </Card>
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
