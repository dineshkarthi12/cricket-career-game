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
import { CIRCLE_RADIUS, groundBox } from '@/lib/ground';
import type { MatchDecisions } from '@/store/matchStore';

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
  onAuto: (on: boolean) => void;
  onSpeed: (index: number) => void;
  /** Show the wagon wheel over the live ground. */
  showWagonWheel: boolean;
  onToggleWagonWheel: (on: boolean) => void;
}

export function InPlay(props: InPlayProps) {
  const { snap, venue, playerById } = props;
  const [tab, setTab] = useState('scorecard');
  const cur = snap.current;
  const box = useMemo(() => groundBox(venue), [venue]);

  if (!cur) return null;

  const striker = playerById(cur.strikerId);
  const leftHanded = striker?.battingStyle === 'LEFT_HAND_BAT';
  const bowler = cur.bowlerId ? playerById(cur.bowlerId) : undefined;
  const bowlerLine = cur.bowling.find((b) => b.playerId === cur.bowlerId);
  const overComplete = cur.balls % 6 === 0;
  const over = Math.floor(cur.balls / 6);

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
              ring:
                snapped.distance > CIRCLE_RADIUS
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

  return (
    <div className="flex flex-col gap-4 pb-4">
      <ScoreStrip
        snap={snap}
        battingTeam={battingTeam}
        bowlingTeam={bowlingTeam}
        nameOf={(id) => playerById(id)?.name ?? 'Batter'}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
        {/* Ground column. */}
        <div className="flex flex-col gap-4">
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
                  <li
                    key={entry.label}
                    className="flex items-center gap-1 text-[11px] text-ink-muted"
                  >
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

          {/* Controls: under the ground on every size, so they stay reachable. */}
          <Card>
            <CardHeader
              title={snap.userBatting ? 'Batting' : 'Bowling and field'}
              subtitle={
                snap.userBatting
                  ? 'Your call on how hard to go, and where to look for runs.'
                  : 'Your call on who bowls, what they bowl, and where the field stands.'
              }
            />
            <div className="mt-3 grid gap-4 md:grid-cols-2">
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
                    oversLeft={null}
                    onBowler={(nextBowlerId) => props.onDecisions({ nextBowlerId })}
                    onPlan={(patch) =>
                      props.onDecisions({ plan: { ...props.decisions.plan, ...patch } })
                    }
                    onRoundTheWicket={(roundTheWicket) => props.onDecisions({ roundTheWicket })}
                  />
                  <FieldEditor
                    field={props.decisions.field ?? snap.field}
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

            <div className="mt-4 border-t border-line pt-4">
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
            </div>
          </Card>
        </div>

        {/* Panel column. */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Alerts" />
            <div className="mt-2.5 max-h-[180px] overflow-y-auto">
              <AlertsFeed alerts={snap.alerts} />
            </div>
          </Card>

          <Card>
            <Tabs tabs={PANEL_TABS} value={tab} onChange={setTab} label="Match panels" />
            <div className="mt-3">
              {tab === 'scorecard' ? (
                <div className="max-h-[560px] overflow-y-auto">
                  <Scorecard
                    innings={cur.innings}
                    battingTeam={battingTeam}
                    bowlingTeam={bowlingTeam}
                    userPlayerId={props.userPlayerId}
                    strikerId={cur.strikerId}
                    nonStrikerId={cur.nonStrikerId}
                  />
                </div>
              ) : null}

              {tab === 'commentary' ? (
                <div className="max-h-[560px] overflow-y-auto">
                  <CommentaryFeed deliveries={cur.deliveries} />
                </div>
              ) : null}

              {tab === 'charts' ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
                      Worm
                    </h4>
                    <Worm innings={chartInnings(snap.completed, cur.innings)} />
                  </div>
                  <div>
                    <h4 className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
                      Runs per over
                    </h4>
                    <Manhattan deliveries={cur.deliveries} />
                  </div>
                  <div>
                    <h4 className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
                      Wagon wheel
                    </h4>
                    <WagonWheelPanel
                      venue={venue}
                      deliveries={cur.deliveries}
                      leftHanded={leftHanded}
                    />
                  </div>
                  <div>
                    <h4 className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
                      Beehive
                    </h4>
                    <Beehive
                      balls={cur.deliveries}
                      bowlerId={cur.bowlerId}
                      leftHanded={leftHanded}
                      className="mx-auto h-[180px] w-auto"
                    />
                  </div>
                  <div>
                    <h4 className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
                      Over by over
                    </h4>
                    <div className="mt-2">
                      <OverByOver deliveries={cur.deliveries} />
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'info' ? (
                <MatchInfo
                  snap={snap}
                  venue={venue}
                  tournamentName={props.tournamentName}
                  homeTeam={props.homeTeam}
                  awayTeam={props.awayTeam}
                  teamNameOf={props.teamNameOf}
                />
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
