/** The captaincy record: overall, by team, and the story of it so far. */
import { Crown } from 'lucide-react';
import { Card, CardHeader, ProgressBar } from '@/components';
import { winPercent } from '@/engine/career/captaincy';
import { formatLongDate } from '@/lib/format';
import type { GameState } from '@/types';
import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';

export function CaptaincyCard({ state }: { state: GameState }) {
  const c = state.career.captaincy;
  const current = c.teamId ? state.teams[c.teamId] : null;
  const pct = winPercent(c.record);
  const t = useT();

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardHeader
          title={t('misc.cap.title')}
          subtitle={
            current
              ? t('misc.cap.of', { team: current.name })
              : import.meta.env.DEV && state.settings.devCaptainMode
                ? t('misc.cap.dev')
                : t('misc.cap.not')
          }
        />
        <span className="grid size-10 place-items-center rounded-full bg-brand-gold/20 text-brand-gold">
          <Crown className="size-5" aria-hidden />
        </span>
      </div>

      {c.record.matches === 0 ? (
        <p className="mt-3 text-[13px] text-ink-muted">
          {t('misc.cap.never')}
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              [t('misc.cap.matches'), c.record.matches],
              [t('misc.cap.won'), c.record.won],
              [t('misc.cap.lost'), c.record.lost],
              [t('misc.cap.drawn'), c.record.drawn],
              [t('misc.cap.tied'), c.record.tied],
              [t('misc.cap.winPct'), pct === null ? '-' : `${pct}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-tile bg-page px-3 py-2">
                <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
                <dd className="text-[16px] font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Meter label={t('misc.cap.rating')} value={c.rating} tone={c.rating >= 60 ? 'green' : c.rating >= 40 ? 'orange' : 'red'} />
            <Meter label={t('misc.cap.stress')} value={c.stress} tone={c.stress >= 70 ? 'red' : c.stress >= 40 ? 'orange' : 'green'} />
          </div>

          {Object.keys(c.byTeam).length > 0 ? (
            <table className="mt-3 w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] tracking-wide text-ink-soft uppercase">
                  <th className="pb-1 font-semibold">{t('misc.cap.team')}</th>
                  <th className="pb-1 text-right font-semibold">P</th>
                  <th className="pb-1 text-right font-semibold">W</th>
                  <th className="pb-1 text-right font-semibold">L</th>
                  <th className="pb-1 text-right font-semibold">D</th>
                  <th className="pb-1 text-right font-semibold">{t('misc.cap.winPct')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(c.byTeam).map(([teamId, record]) => (
                  <tr key={teamId}>
                    <td className="py-1 text-ink">{state.teams[teamId]?.name ?? teamId}</td>
                    <td className="py-1 text-right text-ink-muted">{record.matches}</td>
                    <td className="py-1 text-right text-ink-muted">{record.won}</td>
                    <td className="py-1 text-right text-ink-muted">{record.lost}</td>
                    <td className="py-1 text-right text-ink-muted">{record.drawn}</td>
                    <td className="py-1 text-right font-semibold text-ink">{winPercent(record) ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      )}

      {c.history.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
          {[...c.history].reverse().slice(0, 6).map((event, i) => (
            <li key={`${event.date}-${i}`} className="text-[12px] text-ink-muted">
              <span className="font-semibold text-ink">{formatLongDate(event.date)}</span> ·{' '}
              {t((['APPOINTED', 'SACKED', 'RESIGNED'].includes(event.kind) ? `misc.cap.${event.kind}` : 'misc.cap.RECOMMENDED') as Key)}
              {' - '}
              {event.note}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: 'green' | 'orange' | 'red' }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[110px] shrink-0 text-[12px] text-ink-muted">{label}</span>
      <ProgressBar value={value} tone={tone} className="w-full" />
      <span className="w-7 shrink-0 text-right text-[12px] font-semibold text-ink tabular-nums">{Math.round(value)}</span>
    </div>
  );
}
