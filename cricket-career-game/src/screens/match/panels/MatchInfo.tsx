/**
 * The match info card: venue, competition, format, the toss, the pitch report,
 * the weather, the ball, dew and reviews left.
 */
import { CloudSun, Droplets, MapPin, ShieldCheck, Sun, Thermometer, Trophy, Wind } from 'lucide-react';
import { ProgressBar } from '@/components';
import type { LiveSnapshot } from '@/engine/match/live';
import { rich, useT } from '@/i18n/react';
import type { MatchConditions, Venue } from '@/types';

export function PitchReport({ conditions }: { conditions: MatchConditions }) {
  const t = useT();
  const p = conditions.pitch;
  const rows: { label: string; value: number; tone: 'blue' | 'green' | 'orange' }[] = [
    { label: t('pitch.battingEase'), value: p.battingEase, tone: 'green' },
    { label: t('pitch.seam'), value: p.seamMovement, tone: 'blue' },
    { label: t('pitch.swing'), value: p.swing, tone: 'blue' },
    { label: t('pitch.turn'), value: p.turn, tone: 'orange' },
    { label: t('pitch.bounce'), value: p.bounce, tone: 'blue' },
    { label: t('pitch.pace'), value: p.pace, tone: 'blue' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-ink-muted">
        {rich(t('pitch.surface'), { type: <span className="font-semibold text-ink">{t(`pitch.${p.type}`)}</span> })}
        {p.deterioration > 25 ? t('pitch.wearing', { n: Math.round(p.deterioration) }) : ''}
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
  const t = useT();
  const w = conditions.weather;
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
      <Item icon={w.cloudCover > 50 ? CloudSun : Sun} label={t(`weather.${w.type}`)} />
      <Item icon={Thermometer} label={`${Math.round(w.temperature)}°C`} />
      <Item icon={Droplets} label={t('weather.humidity', { n: Math.round(w.humidity) })} />
      <Item icon={Wind} label={t('weather.wind', { n: Math.round(w.wind) })} />
      <Item icon={CloudSun} label={t('weather.rain', { n: Math.round(w.rainRisk) })} />
      {dew !== undefined && dew > 5 ? (
        <Item icon={Droplets} label={t('weather.dew', { n: Math.round(dew) })} />
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
  const t = useT();
  const cur = snap.current;
  const ball = cur?.conditions.ball;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-[12.5px] text-ink-muted">
        <p className="flex items-center gap-1.5">
          <Trophy className="size-3.5 shrink-0" aria-hidden />
          {tournamentName}
          <span className="text-ink-soft">· {t(`format.${snap.format}`)}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {venue.name}, {venue.city}
        </p>
        <p className="text-ink">
          <span className="font-semibold">{homeTeam}</span> {t('m.v')}{' '}
          <span className="font-semibold">{awayTeam}</span>
        </p>
        {snap.session ? (
          <p className="font-semibold text-ink">
            {t('info.session', { day: snap.session.day, session: snap.session.session })}
          </p>
        ) : null}
        {snap.toss ? (
          <p>{t('m.tossResult', { team: teamNameOf(snap.toss.winnerTeamId), decision: `@m.decision.${snap.toss.decision}` })}</p>
        ) : (
          <p>{t('m.tossToCome')}</p>
        )}
      </div>

      {cur ? (
        <>
          <div className="border-t border-line pt-3">
            <h4 className="mb-2 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              {t('m.pitch')}
            </h4>
            <PitchReport conditions={cur.conditions} />
          </div>
          <div className="border-t border-line pt-3">
            <h4 className="mb-2 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              {t('m.conditions')}
            </h4>
            <WeatherReport conditions={cur.conditions} dew={cur.dew} />
          </div>
          {ball ? (
            <p className="border-t border-line pt-3 text-[12px] text-ink-muted">
              {t('info.ball', {
                n: ball.ballNumber,
                age: ball.ageInBalls,
                shine: Math.round(ball.shine),
                reversing: ball.reverseSwingAvailable ? '@info.reversing' : '',
              })}
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            {t('info.reviews', { bat: cur.reviewsLeft.batting, bowl: cur.reviewsLeft.bowling })}
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

