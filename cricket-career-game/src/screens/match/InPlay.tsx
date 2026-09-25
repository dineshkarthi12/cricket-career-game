/**
 * The match in progress. On a wide screen the ground sits on the left with
 * the player's controls under it and the panels pinned beside it; on a phone
 * the ground is on top, everything else is tabbed underneath, and the sim
 * buttons sit at the bottom within thumb reach.
 *
 * Career mode is the default: "You" shows the player's own controls. Team
 * controls appear only when the player captains.
 */
import { useMemo, useState } from 'react';
import { Card, CardHeader, Tabs } from '@/components';
import type { LiveSnapshot } from '@/engine/match/live';
import type { FieldSetting, SimPlayer } from '@/engine/match/types';
import { groundBox, insideCircle } from '@/lib/ground';
import { useMediaQuery } from '@/lib/useMediaQuery';
import type { BallIntent, CaptainDecisions, PlayerDecisions } from '@/store/matchStore';
import type { Ball, CaptainDelegation, Venue } from '@/types';
import { CaptainPanel } from './controls/CaptainPanel';
import { snapFielder } from './controls/FieldEditor';
import { SimControls } from './controls/SimControls';
import { YouPanel } from './controls/YouPanel';
import { GroundView } from './ground/GroundView';
import { Beehive, DELIVERY_LEGEND, PitchMap } from './ground/PitchMap';
import { WagonWheelSpokes } from './ground/WagonWheel';
import { AlertsFeed } from './panels/AlertsFeed';
import { CommentaryFeed } from './panels/CommentaryFeed';
import { Manhattan, OverByOver, WagonWheelPanel, Worm, chartInnings } from './panels/MatchCharts';
import { MatchInfo } from './panels/MatchInfo';
import { Scorecard } from './panels/Scorecard';
import { ScoreStrip } from './panels/ScoreStrip';

const PANEL_TABS = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'commentary', label: 'Commentary' },
  { id: 'charts', label: 'Charts' },
  { id: 'info', label: 'Match' },
];

export interface InPlayProps {
  snap: LiveSnapshot;
  venue: Venue;
  tournamentName: string;
  homeTeam: string;
  awayTeam: string;
  teamNameOf: (id: string) => string;
  playerById: (id: string) => SimPlayer | undefined;
  userId: string;
  userName: string;
  captain: boolean;
  delegate: CaptainDelegation;
  availableBowlers: SimPlayer[];
  suggestedBowler: SimPlayer | null;
  player: PlayerDecisions;
  captainDecisions: CaptainDecisions;
  lastBall: Ball | null;
  ballMs: number;
  reduceMotion: boolean;
  autoPlay: boolean;
  autoWatch: boolean;
  speed: number;
  onPlay: (intent?: BallIntent) => void;
  onOver: () => void;
  onWicket: () => void;
  onInvolved: () => void;
  onUntilOut: () => void;
  onInnings: () => void;
  onSimRest: () => void;
  onDeclare: () => void;
  onAuto: (on: boolean) => void;
  onAutoWatch: (on: boolean) => void;
  onSpeed: (index: number) => void;
  onPlayer: (patch: Partial<PlayerDecisions>) => void;
  onCaptain: (patch: Partial<CaptainDecisions>) => void;
  onDelegate: (patch: Partial<CaptainDelegation>) => void;
}

export function InPlay(props: InPlayProps) {
  const { snap, venue, playerById } = props;
  const [tab, setTab] = useState('scorecard');
  const [mobileTab, setMobileTab] = useState('you');
  const [showWagonWheel, setShowWagonWheel] = useState(false);
  const wide = useMediaQuery('(min-width: 1280px)');
  const box = useMemo(() => groundBox(venue), [venue]);
  const cur = snap.current;

  if (!cur) return null;

  const striker = playerById(cur.strikerId);
  const leftHanded = striker?.battingStyle === 'LEFT_HAND_BAT';
  const bowler = cur.bowlerId ? playerById(cur.bowlerId) : undefined;
  const leftArmBowler = Boolean(bowler?.bowlingStyle.startsWith('LEFT_ARM'));
  const me = playerById(props.userId);
  const busy = snap.question !== null;

  const battingTeam = props.teamNameOf(cur.battingTeamId);
  const bowlingTeam = props.teamNameOf(cur.bowlingTeamId);

  const overlay = showWagonWheel ? (
    <WagonWheelSpokes box={box} balls={cur.deliveries} leftHanded={leftHanded} />
  ) : null;

  const fieldEditable = props.captain && snap.userBowling && !props.delegate.field;
  const field = fieldEditable ? (props.captainDecisions.field ?? snap.field) : snap.field;

  /** A fielder the captain has dragged. Snaps onto a sensible spot. */
  const moveFielder = (playerId: string, angle: number, distance: number) => {
    const source = props.captainDecisions.field ?? snap.field;
    if (!source) return;
    const snapped = snapFielder(angle, distance, venue.straightBoundary);
    const next: FieldSetting = {
      ...source,
      fielders: source.fielders.map((fielder) =>
        fielder.playerId === playerId
          ? {
              ...fielder,
              angle: snapped.angle,
              distance: Math.min(snapped.distance, venue.straightBoundary - 3),
              position: snapped.position,
              ring: !insideCircle(box, snapped.angle, snapped.distance)
                ? 'OUTER'
                : snapped.distance < 18
                  ? 'CLOSE'
                  : 'INNER',
            }
          : fielder,
      ),
    };
    props.onCaptain({ field: next });
  };

  // The opposition's bowlers, for "target a bowler".
  const opposingBowlers = snap.userBatting
    ? cur.bowling.map((b) => ({ id: b.playerId, name: b.name }))
    : [];

  const groundCard = (
    <Card flush className="overflow-hidden">
      <GroundView
        venue={venue}
        conditions={cur.conditions}
        field={field}
        ball={props.lastBall}
        leftHanded={leftHanded}
        userId={props.userId}
        bowlerId={cur.bowlerId}
        userOnStrike={snap.involvement.onStrike}
        leftArmBowler={leftArmBowler}
        durationMs={props.ballMs}
        reduceMotion={props.reduceMotion}
        editable={fieldEditable}
        onMoveFielder={moveFielder}
        overlay={overlay}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <ul className="flex flex-wrap items-center gap-2.5">
          <li className="flex items-center gap-1 text-[11px] text-ink-muted">
            <span className="inline-block size-2 rounded-full bg-brand-gold" /> You
          </li>
          {DELIVERY_LEGEND.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1 text-[11px] text-ink-muted">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: entry.colour }} />
              {entry.label}
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
          <input
            type="checkbox"
            checked={showWagonWheel}
            onChange={(event) => setShowWagonWheel(event.target.checked)}
            className="accent-brand-blue"
          />
          Wagon wheel
        </label>
      </div>
    </Card>
  );

  const you = (
    <YouPanel
      snap={snap}
      me={me}
      name={props.userName}
      decisions={props.player}
      busy={busy || props.autoPlay}
      autoWatch={props.autoWatch}
      onPlay={props.onPlay}
      onDecisions={props.onPlayer}
      onSimOver={props.onOver}
      onSimUntilOut={props.onUntilOut}
      onAutoWatch={props.onAutoWatch}
    />
  );

  const captainPanel = props.captain ? (
    <CaptainPanel
      snap={snap}
      venue={venue}
      decisions={props.captainDecisions}
      delegate={props.delegate}
      available={props.availableBowlers}
      opposingBowlers={opposingBowlers}
      suggestion={props.suggestedBowler}
      maxOvers={cur.maxOversPerBowler}
      onDecisions={props.onCaptain}
      onDelegate={props.onDelegate}
      onDeclare={props.onDeclare}
    />
  ) : null;

  const simControls = (compact: boolean) => (
    <SimControls
      compact={compact}
      autoPlay={props.autoPlay}
      speed={props.speed}
      busy={busy}
      playing={snap.involvement.playing}
      onBall={() => props.onPlay()}
      onOver={props.onOver}
      onWicket={props.onWicket}
      onInvolved={props.onInvolved}
      onInnings={props.onInnings}
      onAuto={props.onAuto}
      onSimRest={props.onSimRest}
      onSpeed={props.onSpeed}
    />
  );

  const panel = (id: string) => {
    switch (id) {
      case 'you':
        return you;
      case 'captain':
        return captainPanel;
      case 'alerts':
        return <AlertsFeed alerts={snap.alerts} />;
      case 'scorecard':
        return (
          <Scorecard
            innings={cur.innings}
            battingTeam={battingTeam}
            bowlingTeam={bowlingTeam}
            userPlayerId={props.userId}
            strikerId={cur.strikerId}
          />
        );
      case 'commentary':
        return <CommentaryFeed deliveries={cur.deliveries} />;
      case 'charts':
        return (
          <div className="flex flex-col gap-4">
            <ChartBlock title="Worm">
              <Worm innings={chartInnings(snap.completed, cur.innings)} />
            </ChartBlock>
            <ChartBlock title="Runs per over">
              <Manhattan deliveries={cur.deliveries} />
            </ChartBlock>
            <ChartBlock title="Wagon wheel">
              <WagonWheelPanel venue={venue} deliveries={cur.deliveries} leftHanded={leftHanded} />
            </ChartBlock>
            <ChartBlock title="Pitch map - this bowler">
              <PitchMap
                balls={cur.deliveries}
                bowlerId={cur.bowlerId}
                leftHanded={leftHanded}
                className="mx-auto h-[190px] w-auto"
              />
            </ChartBlock>
            <ChartBlock title="Beehive - this bowler">
              <Beehive
                balls={cur.deliveries}
                bowlerId={cur.bowlerId}
                leftHanded={leftHanded}
                className="mx-auto h-[180px] w-auto"
              />
            </ChartBlock>
            <ChartBlock title="Over by over">
              <OverByOver deliveries={cur.deliveries} />
            </ChartBlock>
          </div>
        );
      default:
        return (
          <MatchInfo
            snap={snap}
            venue={venue}
            tournamentName={props.tournamentName}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            teamNameOf={props.teamNameOf}
          />
        );
    }
  };

  const scoreStrip = (
    <ScoreStrip
      snap={snap}
      battingTeam={battingTeam}
      bowlingTeam={bowlingTeam}
      nameOf={(id) => playerById(id)?.name ?? 'Batter'}
      userId={props.userId}
    />
  );

  // Phone and tablet: ground on top, everything else tabbed underneath, and
  // the sim buttons pinned just above the tab bar where a thumb can reach.
  if (!wide) {
    const mobileTabs = [
      { id: 'you', label: 'You' },
      ...(props.captain ? [{ id: 'captain', label: 'Captain' }] : []),
      ...PANEL_TABS,
      { id: 'alerts', label: 'Alerts' },
    ];
    const active = mobileTabs.some((t) => t.id === mobileTab) ? mobileTab : 'you';
    return (
      <div className="flex flex-col gap-3 pb-4">
        {scoreStrip}
        {groundCard}
        <Card>
          <Tabs tabs={mobileTabs} value={active} onChange={setMobileTab} label="Match panels" />
          <div className="mt-3">{panel(active)}</div>
          {active === 'you' ? <div className="mt-4 border-t border-line pt-4">{simControls(false)}</div> : null}
        </Card>
        <div className="sticky bottom-[76px] z-20 md:bottom-3">
          <Card className="p-2 shadow-card-hover">{simControls(true)}</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {scoreStrip}

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)] items-start gap-4">
        <div className="flex flex-col gap-4">
          {groundCard}
          <Card>
            {you}
            <div className="mt-4 border-t border-line pt-4">{simControls(false)}</div>
          </Card>
          {captainPanel ? <Card>{captainPanel}</Card> : null}
        </div>

        {/* Pinned beside the ground, so the scorecard stays in view. */}
        <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col gap-4">
          <Card className="shrink-0">
            <CardHeader title="Alerts" />
            <div className="mt-2.5 max-h-[150px] overflow-y-auto">{panel('alerts')}</div>
          </Card>
          <Card className="flex min-h-0 flex-1 flex-col">
            <Tabs tabs={PANEL_TABS} value={tab} onChange={setTab} label="Match panels" />
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {panel(PANEL_TABS.some((t) => t.id === tab) ? tab : 'scorecard')}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">{title}</h4>
      {children}
    </div>
  );
}
