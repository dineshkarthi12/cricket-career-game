/**
 * The match info card: venue, competition, format, the toss, the pitch report,
 * the weather, the ball, dew and reviews left.
 */
import { CloudSun, Droplets, MapPin, ShieldCheck, Sun, Thermometer, Trophy, Wind } from 'lucide-react';
import { ProgressBar } from '@/components';
import type { LiveSnapshot } from '@/engine/match/live';
import type { MatchConditions, Venue } from '@/types';

const FORMAT_LABELS: Record<string, string> = {
  T20: 'Twenty over',
  ODI: '50 over',
  ONE_DAY: '50 over',
  MULTI_DAY: 'Multi-day',
  TEST: 'Test',
};

export function PitchReport({ conditions }: { conditions: MatchConditions }) {
  const p = conditions.pitch;
  const rows: { label: string; value: number; tone: 'blue' | 'green' | 'orange' }[] = [
    { label: 'Batting ease', value: p.battingEase, tone: 'green' },
    { label: 'Seam', value: p.seamMovement, tone: 'blue' },
    { label: 'Swing', value: p.swing, tone: 'blue' },
    { label: 'Turn', value: p.turn, tone: 'orange' },
    { label: 'Bounce', value: p.bounce, tone: 'blue' },
    { label: 'Pace', value: p.pace, tone: 'blue' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-ink-muted">
        <span className="font-semibold text-ink">{titleCase(p.type)}</span> surface
        {p.deterioration > 25 ? `, wearing (${Math.round(p.deterioration)}%)` : ''}
      </p>
      <dl className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <dt className="w-[84px] shrink-0 text-[11.5px] text-ink-muted">{row.label}</dt>
            <dd className="flex flex-1 items-center gap-2">
              <ProgressBar value={row.value} tone={row.tone} className="w-full" />
              <span className="w-[26px] shrink-0 text-right text-[11.5px] font-semibold text-ink tabular-nums">
                {Math.round(row.value)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function WeatherReport({ conditions, dew }: { conditions: MatchConditions; dew?: number }) {
  const w = conditions.weather;
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
      <Item icon={w.cloudCover > 50 ? CloudSun : Sun} label={titleCase(w.type)} />
      <Item icon={Thermometer} label={`${Math.round(w.temperature)}°C`} />
      <Item icon={Droplets} label={`${Math.round(w.humidity)}% humidity`} />
      <Item icon={Wind} label={`${Math.round(w.wind)} wind`} />
      <Item icon={CloudSun} label={`${Math.round(w.rainRisk)}% rain risk`} />
      {dew !== undefined && dew > 5 ? (
        <Item icon={Droplets} label={`${Math.round(dew)} dew`} />
      ) : null}
    </ul>
  );
}

export function MatchInfo({
  snap,
  venue,
  tournamentName,
  homeTeam,
  awayTeam,
  teamNameOf,
}: {
  snap: LiveSnapshot;
  venue: Venue;
  tournamentName: string;
  homeTeam: string;
  awayTeam: string;
  teamNameOf: (id: string) => string;
}) {
  const cur = snap.current;
  const ball = cur?.conditions.ball;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-[12.5px] text-ink-muted">
        <p className="flex items-center gap-1.5">
          <Trophy className="size-3.5 shrink-0" aria-hidden />
          {tournamentName}
          <span className="text-ink-soft">· {FORMAT_LABELS[snap.format] ?? snap.format}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {venue.name}, {venue.city}
        </p>
        <p className="text-ink">
          <span className="font-semibold">{homeTeam}</span> v{' '}
          <span className="font-semibold">{awayTeam}</span>
        </p>
        {snap.session ? (
          <p className="font-semibold text-ink">
            Day {snap.session.day}, session {snap.session.session}
          </p>
        ) : null}
        {snap.toss ? (
          <p>
            {teamNameOf(snap.toss.winnerTeamId)} won the toss and chose to{' '}
            {snap.toss.decision === 'BAT' ? 'bat' : 'bowl'}.
          </p>
        ) : (
          <p>Toss to come.</p>
        )}
      </div>

      {cur ? (
        <>
          <div className="border-t border-line pt-3">
            <h4 className="mb-2 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              Pitch
            </h4>
            <PitchReport conditions={cur.conditions} />
          </div>
          <div className="border-t border-line pt-3">
            <h4 className="mb-2 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              Conditions
            </h4>
            <WeatherReport conditions={cur.conditions} dew={cur.dew} />
          </div>
          {ball ? (
            <p className="border-t border-line pt-3 text-[12px] text-ink-muted">
              Ball {ball.ballNumber}: {ball.ageInBalls} balls old, {Math.round(ball.shine)}% shine
              {ball.reverseSwingAvailable ? ', reversing' : ''}.
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Reviews left — batting {cur.reviewsLeft.batting}, bowling {cur.reviewsLeft.bowling}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Item({ icon: Icon, label }: { icon: typeof Sun; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-ink-muted">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </li>
  );
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
