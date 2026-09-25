/**
 * Before a ball is bowled. In career mode the selectors have already decided:
 * the player sees whether they are in the XI, where they bat, what is expected
 * of them, the opposition and the conditions. A captain also puts forward
 * their own XI and batting order - which the selectors may overrule.
 */
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Crown,
  Eye,
  RotateCcw,
  Shirt,
  Users,
  Zap,
} from 'lucide-react';
import { Badge, Card, CardHeader, Crest } from '@/components';
import { xiWarnings } from '@/engine/match/lineup';
import type { SelectionDecision } from '@/engine/career/selection';
import type { LiveSnapshot } from '@/engine/match/live';
import type { SimPlayer } from '@/engine/match/types';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import type { Fixture, GameState } from '@/types';
import { PitchReport, WeatherReport } from './panels/MatchInfo';

const ROLE_LABELS: Record<string, string> = {
  OPENING_BATTER: 'Opener',
  BATTER: 'Batter',
  WICKET_KEEPER_BATTER: 'Keeper',
  BATTING_ALLROUNDER: 'Batting AR',
  BOWLING_ALLROUNDER: 'Bowling AR',
  PACE_BOWLER: 'Pace',
  SPIN_BOWLER: 'Spin',
};

const STATUS: Record<SelectionDecision['status'], { label: string; tone: 'green' | 'blue' | 'orange' | 'red' }> = {
  PLAYING_XI: { label: 'Playing XI', tone: 'green' },
  TWELFTH_MAN: { label: '12th man', tone: 'blue' },
  BENCH: { label: 'On the bench', tone: 'orange' },
  NOT_SELECTED: { label: 'Not selected', tone: 'red' },
};

export function PreMatch({
  state,
  fixture,
  selection,
  captain,
  proposedIds,
  snap,
  onToggle,
  onMove,
  onReset,
  onToss,
  onQuickSim,
  onBack,
}: {
  state: GameState;
  fixture: Fixture;
  selection: SelectionDecision;
  captain: boolean;
  proposedIds: string[];
  /** A preview of the match, so the conditions can be read before the toss. */
  snap: LiveSnapshot | null;
  onToggle: (id: string) => void;
  onMove: (id: string, by: number) => void;
  onReset: () => void;
  onToss: () => void;
  onQuickSim: () => void;
  onBack: () => void;
}) {
  const home = fixture.homeTeamId ? state.teams[fixture.homeTeamId] : null;
  const away = fixture.awayTeamId ? state.teams[fixture.awayTeamId] : null;
  const userTeam = home?.isUserTeam ? home : away;
  const opposition = home?.isUserTeam ? away : home;
  const tournament = fixture.tournamentId ? TOURNAMENTS_BY_ID[fixture.tournamentId] : null;
  const venue = fixture.venueId ? state.venues[fixture.venueId] : null;
  const status = STATUS[selection.status];
  const inXi = selection.status === 'PLAYING_XI';

  const byId = new Map(selection.ranked.map((r) => [r.player.id, r.player]));
  const proposed = proposedIds.map((id) => byId.get(id)).filter((p): p is SimPlayer => Boolean(p));
  const warnings = captain ? xiWarnings(proposed) : [];
  const ready = !captain || proposed.length === 11;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back
            </button>
            <h1 className="text-[20px] leading-tight font-semibold text-ink">
              {home?.name ?? 'TBC'} <span className="text-brand-orange">v</span> {away?.name ?? 'TBC'}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {tournament?.name ?? 'Friendly'} · {fixture.stage ?? 'League'} · {formatLongDate(fixture.date)}
              {venue ? ` · ${venue.name}, ${venue.city}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {home ? <Crest crest={home.crest} size={40} label={home.name} /> : null}
            <span className="text-[13px] font-semibold text-ink-soft">v</span>
            {away ? <Crest crest={away.crest} size={40} label={away.name} /> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* The selectors' decision. */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardHeader title="Selection" subtitle={`${state.player.firstName} ${state.player.lastName}`} />
              <div className="flex items-center gap-2">
                {captain ? (
                  <Badge tone="gold">
                    <Crown className="mr-1 inline size-3" aria-hidden />
                    Captain
                  </Badge>
                ) : null}
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            </div>

            {inXi ? (
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <Stat
                  icon={Shirt}
                  label="Batting"
                  value={`No. ${selection.battingPosition}`}
                  sub={selection.positionNote}
                />
                <Stat icon={Users} label="Role" value={roleLabel(selection)} sub={selection.expectedRole} />
                <Stat icon={Zap} label="Bowling" value={bowlingLabel(selection)} sub={selection.bowlingNote} />
              </dl>
            ) : (
              <p className="mt-3 text-[13px] text-ink-muted">{selection.expectedRole}</p>
            )}

            {selection.reasons.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
                {selection.reasons.map((reason) => (
                  <li key={reason} className="text-[12.5px] text-ink-muted">
                    · {reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {/* The XI: the selectors', or the captain's proposal. */}
          <Card className="flex flex-col gap-3">
            <CardHeader
              title={captain ? 'Your XI' : 'The XI'}
              subtitle={
                captain
                  ? `${proposed.length} of 11 - tap to bring a player in or leave them out, arrows to change the order. The selectors have the final say.`
                  : 'Picked by the selectors, batting order from the coach.'
              }
            />
            <ol className="flex flex-col gap-1">
              {(captain ? proposed : selection.xi).map((player, index) => (
                <li
                  key={player.id}
                  className={[
                    'flex items-center gap-2 rounded-tile border px-2.5 py-1.5',
                    player.isUser ? 'border-brand-gold/60 bg-brand-gold/10' : 'border-line bg-surface',
                  ].join(' ')}
                >
                  <span className="w-5 shrink-0 text-right text-[12px] font-semibold text-ink-soft tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">
                      {player.name}
                      {player.isUser ? (
                        <span className="ml-1.5 text-[10.5px] font-bold text-brand-navy">YOU</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      {ROLE_LABELS[player.role] ?? player.role} · form {Math.round(player.condition.form)}
                    </span>
                  </span>
                  {captain ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <IconButton label="Bat higher" onClick={() => onMove(player.id, -1)} disabled={index === 0}>
                        <ArrowUp className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label="Bat lower"
                        onClick={() => onMove(player.id, 1)}
                        disabled={index === proposed.length - 1}
                      >
                        <ArrowDown className="size-3.5" />
                      </IconButton>
                      <button
                        type="button"
                        onClick={() => onToggle(player.id)}
                        className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-brand-red hover:bg-brand-red/10"
                      >
                        Leave out
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            {captain ? (
              <>
                <p className="border-t border-line pt-3 text-[12.5px] font-semibold text-ink">Also in the squad</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {selection.ranked
                    .map((r) => r.player)
                    .filter((p) => !proposedIds.includes(p.id))
                    .map((player) => (
                      <li key={player.id}>
                        <button
                          type="button"
                          onClick={() => onToggle(player.id)}
                          disabled={proposed.length >= 11}
                          className="flex w-full items-center justify-between gap-2 rounded-tile border border-line bg-surface px-2.5 py-1.5 text-left hover:bg-page disabled:opacity-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-semibold text-ink">{player.name}</span>
                            <span className="text-[11px] text-ink-muted">
                              {ROLE_LABELS[player.role]} · form {Math.round(player.condition.form)}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11.5px] font-semibold text-brand-blue">Bring in</span>
                        </button>
                      </li>
                    ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={onReset}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-page"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    The selectors' XI
                  </button>
                  {warnings.length === 0 && ready ? (
                    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-green">
                      <CheckCircle2 className="size-4" aria-hidden />
                      A balanced side.
                    </span>
                  ) : null}
                </div>
                {warnings.length > 0 ? (
                  <ul className="flex flex-col gap-1 rounded-lg bg-brand-orange/8 p-2.5">
                    {warnings.map((warning) => (
                      <li key={warning} className="flex items-start gap-1.5 text-[12px] font-medium text-brand-orange">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Opposition" subtitle={opposition?.name ?? 'To be confirmed'} />
            <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[12.5px]">
              <MiniStat label="Their strength" value={String(opposition?.strength ?? '-')} />
              <MiniStat label="Your side" value={String(userTeam?.strength ?? '-')} />
              <MiniStat label="Their mood" value={moraleWord(opposition?.morale)} />
              <MiniStat label="Your dressing room" value={moraleWord(userTeam?.morale)} />
            </dl>
            {opposition && userTeam ? (
              <p className="mt-2.5 text-[12px] text-ink-muted">
                {opposition.strength > userTeam.strength + 4
                  ? 'Stronger than you on paper. You will have to earn this one.'
                  : opposition.strength < userTeam.strength - 4
                    ? 'You should be favourites - which is its own kind of pressure.'
                    : 'Very little between the two sides.'}
              </p>
            ) : null}
          </Card>

          {snap ? (
            <>
              <Card>
                <CardHeader title="Pitch report" />
                <div className="mt-2.5">
                  <PitchReport conditions={snap.conditions} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Conditions" subtitle={snap.underLights ? 'Day-night: under lights later' : undefined} />
                <div className="mt-2.5">
                  <WeatherReport conditions={snap.conditions} />
                </div>
              </Card>
            </>
          ) : null}

          <Card className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onToss}
              disabled={!ready}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inXi || captain ? <Users className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {captain ? 'Send the XI to the selectors' : inXi ? 'To the toss' : 'Watch the match'}
            </button>
            <button
              type="button"
              onClick={onQuickSim}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-page"
            >
              Quick Sim instead
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function roleLabel(selection: SelectionDecision): string {
  const me = selection.xi.find((p) => p.isUser);
  return me ? (ROLE_LABELS[me.role] ?? me.role) : '-';
}

function bowlingLabel(selection: SelectionDecision): string {
  if (!selection.bowlingNote || selection.bowlingNote === 'You do not bowl.') return "Won't bowl";
  return selection.bowlingTrust >= 1.05 ? 'Frontline' : selection.bowlingTrust >= 0.7 ? 'Some overs' : 'Rarely';
}

function moraleWord(morale: number | undefined): string {
  if (morale === undefined) return '-';
  if (morale >= 75) return 'Buoyant';
  if (morale >= 58) return 'Settled';
  if (morale >= 42) return 'Flat';
  return 'Low';
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Shirt;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-tile bg-page px-3 py-2.5">
      <dt className="flex items-center gap-1 text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="text-[15px] leading-tight font-bold text-ink">{value}</dd>
      <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile bg-page px-2.5 py-2">
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 place-items-center rounded-lg text-ink-muted hover:bg-page hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
