/**
 * The match in progress. On a wide screen the ground sits on the left with the
 * panels beside it; on a phone the ground is on top, the panels are tabbed
 * underneath, and the controls sit at the bottom within thumb reach.
 */
import { useMemo, useState } from 'react';
import { Card, CardHeader, Tabs } from '@/components';
import type { LiveSnapshot } from '@/engine/match/live';
import type { FieldSetting, SimPlayer } from '@/engine/match/types';
import type { Ball, Venue } from '@/types';
import { GroundView } from './ground/GroundView';
import { WagonWheelSpokes } from './ground/WagonWheel';
import { Beehive, DELIVERY_LEGEND, PitchMap } from './ground/PitchMap';
import { AlertsFeed } from './panels/AlertsFeed';
import { CommentaryFeed } from './panels/CommentaryFeed';
import { Manhattan, OverByOver, WagonWheelPanel, Worm, chartInnings } from './panels/MatchCharts';
import { MatchInfo } from './panels/MatchInfo';
import { Scorecard } from './panels/Scorecard';
import { ScoreStrip } from './panels/ScoreStrip';
import { BattingControls } from './controls/BattingControls';
import { BowlingControls } from './controls/BowlingControls';
import { FieldEditor, snapFielder } from './controls/FieldEditor';
import { SimControls } from './controls/SimControls';
import { groundBox, insideCircle } from '@/lib/ground';
import { useMediaQuery } from '@/lib/useMediaQuery';
import type { MatchDecisions } from '@/store/matchStore';

const PANEL_TABS = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'commentary', label: 'Commentary' },
  { id: 'charts', label: 'Charts' },
  { id: 'info', label: 'Match' },
];

const MOBILE_TABS = [
  { id: 'controls', label: 'Controls' },
  ...PANEL_TABS,
  { id: 'alerts', label: 'Alerts' },
];

export interface InPlayProps {
  snap: LiveSnapshot;
  venue: Venue;
  tournamentName: string;
  homeTeam: string;
  awayTeam: string;
  teamNameOf: (id: string) => string;
  playerById: (id: string) => SimPlayer | undefined;
  availableBowlers: SimPlayer[];
  userPlayerId: string | null;
  lastBall: Ball | null;
  ballMs: number;
  reduceMotion: boolean;
  decisions: MatchDecisions;
  autoPlay: boolean;
  speed: number;
  onDecisions: (patch: Partial<MatchDecisions>) => void;
  onBall: () => void;
  onOver: () => void;
  onWicket: () => void;
  onInnings: () => void;
  onDeclare: () => void;
  onAuto: (on: boolean) => void;
  onSpeed: (index: number) => void;
  /** Show the wagon wheel over the live ground. */
  showWagonWheel: boolean;
  onToggleWagonWheel: (on: boolean) => void;
}

export function InPlay(props: InPlayProps) {
  const { snap, venue, playerById } = props;
  const [tab, setTab] = useState('scorecard');
  const wide = useMediaQuery('(min-width: 1280px)');
  const cur = snap.current;
  const box = useMemo(() => groundBox(venue), [venue]);

  if (!cur) return null;

  const striker = playerById(cur.strikerId);
  const leftHanded = striker?.battingStyle === 'LEFT_HAND_BAT';
  const bowler = cur.bowlerId ? playerById(cur.bowlerId) : undefined;
  const bowlerLine = cur.bowling.find((b) => b.playerId === cur.bowlerId);
  const overComplete = cur.balls % 6 === 0;
  const over = Math.floor(cur.balls / 6);

  /** Runs the batting side leads by, counting every innings so far. */
  const leadNow = () => {
    const own = snap.completed
      .filter((i) => i.battingTeamId === cur.battingTeamId)
      .reduce((sum, i) => sum + i.runs, 0);
    const theirs = snap.completed
      .filter((i) => i.battingTeamId !== cur.battingTeamId)
      .reduce((sum, i) => sum + i.runs, 0);
    return own + cur.runs - theirs;
  };

  const battingTeam = props.teamNameOf(cur.battingTeamId);
  const bowlingTeam = props.teamNameOf(cur.bowlingTeamId);

  const overlay = props.showWagonWheel ? (
    <WagonWheelSpokes box={box} balls={cur.deliveries} leftHanded={leftHanded} />
  ) : null;

  /** A fielder the player has dragged. Snaps onto a sensible spot. */
  const moveFielder = (playerId: string, angle: number, distance: number) => {
    const source = props.decisions.field ?? snap.field;
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
    props.onDecisions({ field: next });
  };

  const groundCard = (
    <Card flush className="overflow-hidden">
      <GroundView
        venue={venue}
        conditions={cur.conditions}
        field={props.decisions.field ?? snap.field}
        ball={props.lastBall}
        leftHanded={leftHanded}
        durationMs={props.ballMs}
        reduceMotion={props.reduceMotion}
        editable={snap.userBowling}
        onMoveFielder={moveFielder}
        overlay={overlay}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <ul className="flex flex-wrap items-center gap-2.5">
          {DELIVERY_LEGEND.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1 text-[11px] text-ink-muted">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: entry.colour }}
              />
              {entry.label}
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
          <input
            type="checkbox"
            checked={props.showWagonWheel}
            onChange={(event) => props.onToggleWagonWheel(event.target.checked)}
            className="accent-brand-blue"
          />
          Wagon wheel
        </label>
      </div>
    </Card>
  );

  const decisionControls = (
    <div className="grid gap-4 md:grid-cols-2">
      {snap.userBatting ? (
        <>
          <BattingControls
            intent={props.decisions.intent}
            shotPreference={props.decisions.shotPreference}
            onIntent={(intent) => props.onDecisions({ intent })}
            onShotPreference={(shotPreference) => props.onDecisions({ shotPreference })}
            disabled={props.autoPlay}
          />
          <div>
            <p className="text-[12.5px] font-semibold text-ink">Where they are bowling</p>
            <PitchMap
              balls={cur.deliveries}
              bowlerId={cur.bowlerId}
              leftHanded={leftHanded}
              className="mx-auto mt-2 h-[190px] w-auto"
            />
            {snap.canDeclare ? (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[12.5px] font-semibold text-ink">Declaration</p>
                <p className="mt-0.5 text-[11.5px] text-ink-muted">
                  {cur.target === null && snap.completed.length >= 1
                    ? `Lead of ${leadNow()} — enough to bowl them out with the time left?`
                    : 'Close the innings and give your bowlers a go.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Declare on ${cur.runs}/${cur.wickets}?`)) props.onDeclare();
                  }}
                  disabled={props.autoPlay}
                  className="mt-2 rounded-lg bg-brand-navy px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  Declare
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <BowlingControls
            bowler={bowler}
            bowlerLine={bowlerLine}
            available={props.availableBowlers}
            nextBowlerId={props.decisions.nextBowlerId}
            plan={props.decisions.plan}
            roundTheWicket={props.decisions.roundTheWicket}
            overComplete={overComplete}
            oversLeft={
              cur.maxOversPerBowler !== null && cur.bowlerId
                ? Math.max(0, cur.maxOversPerBowler - (cur.oversBowledBy[cur.bowlerId] ?? 0))
                : null
            }
            spellOvers={cur.bowlerId ? (cur.spellOvers[cur.bowlerId] ?? 0) : 0}
            onBowler={(nextBowlerId) => props.onDecisions({ nextBowlerId })}
            onPlan={(patch) => props.onDecisions({ plan: { ...props.decisions.plan, ...patch } })}
            onRoundTheWicket={(roundTheWicket) => props.onDecisions({ roundTheWicket })}
          />
          <FieldEditor
            field={props.decisions.field ?? snap.field}
            venue={venue}
            preset={props.decisions.fieldPreset}
            format={snap.format}
            over={over}
            hasCustomField={Boolean(props.decisions.field)}
            onPreset={(fieldPreset) => props.onDecisions({ fieldPreset, field: null })}
            onReset={() => props.onDecisions({ field: null })}
          />
        </>
      )}
    </div>
  );

  const simControls = (
    <SimControls
      autoPlay={props.autoPlay}
      speed={props.speed}
      busy={false}
      onBall={props.onBall}
      onOver={props.onOver}
      onWicket={props.onWicket}
      onInnings={props.onInnings}
      onAuto={props.onAuto}
      onSpeed={props.onSpeed}
    />
  );

  const controlsTitle = snap.userBatting ? 'Batting' : 'Bowling and field';
  const controlsSubtitle = snap.userBatting
    ? 'Your call on how hard to go, and where to look for runs.'
    : 'Your call on who bowls, what they bowl, and where the field stands.';

  const panel = (id: string) => {
    switch (id) {
      case 'controls':
        return decisionControls;
      case 'alerts':
        return <AlertsFeed alerts={snap.alerts} />;
      case 'scorecard':
        return (
          <Scorecard
            innings={cur.innings}
            battingTeam={battingTeam}
            bowlingTeam={bowlingTeam}
            userPlayerId={props.userPlayerId}
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
            <ChartBlock title="Beehive">
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
    />
  );

  // Phone and tablet: ground on top, everything else tabbed underneath, and
  // the sim buttons pinned just above the tab bar where a thumb can reach.
  if (!wide) {
    const mobileTab = MOBILE_TABS.some((t) => t.id === tab) ? tab : 'controls';
    return (
      <div className="flex flex-col gap-3 pb-4">
        {scoreStrip}
        {groundCard}
        <Card>
          <Tabs tabs={MOBILE_TABS} value={mobileTab} onChange={setTab} label="Match panels" />
          {mobileTab === 'controls' ? (
            <p className="mt-2.5 text-[12.5px] font-semibold text-ink">{controlsTitle}</p>
          ) : null}
          <div className="mt-3">{panel(mobileTab)}</div>
          {mobileTab === 'controls' ? (
            <div className="mt-4 border-t border-line pt-4">{simControls}</div>
          ) : null}
        </Card>
        <div className="sticky bottom-[76px] z-20 md:bottom-3">
          <Card className="p-2 shadow-card-hover">
            <SimControls
              compact
              autoPlay={props.autoPlay}
              speed={props.speed}
              busy={false}
              onBall={props.onBall}
              onOver={props.onOver}
              onWicket={props.onWicket}
              onInnings={props.onInnings}
              onAuto={props.onAuto}
              onSpeed={props.onSpeed}
            />
          </Card>
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
            <CardHeader title={controlsTitle} subtitle={controlsSubtitle} />
            <div className="mt-3">{decisionControls}</div>
            <div className="mt-4 border-t border-line pt-4">{simControls}</div>
          </Card>
        </div>

        {/* Pinned beside the ground, so the scorecard stays in view while the
            controls scroll. */}
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
      <h4 className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
        {title}
      </h4>
      {children}
    </div>
  );
}
