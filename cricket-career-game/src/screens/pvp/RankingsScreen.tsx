/** Rankings: the ranked ladder, the player's tier, and the server leaderboard. */
import { useEffect, useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
import { Card, CardHeader, ProgressBar } from '@/components';
import { RANKED, rankedTier, type LeaderRow } from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { useT } from '@/i18n/react';
import { rankLabel } from './labels';
import { SectionTitle } from './ui';

export default function RankingsScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const mode = usePvpStore((s) => s.mode);
  const call = usePvpStore((s) => s.call);
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const t = useT();
  const online = mode === 'ONLINE';
  const rating = profile.rankedRating;

  useEffect(() => {
    if (!online) return;
    let alive = true;
    void call('leaderboard').then((r) => alive && r.ok && setRows(r.data.leaderboard ?? []));
    return () => {
      alive = false;
    };
  }, [online, call]);

  const tierIndex = rating === null ? -1 : RANKED.tiers.reduce((i, t, n) => (rating >= t.min ? n : i), 0);
  const next = tierIndex >= 0 ? RANKED.tiers[tierIndex + 1] : null;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title={t('pvp.nav.rankings')} subtitle={t('pvp.rk.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={t('pvp.rk.status')} />
          {rating === null ? (
            <p className="mt-3 text-[13px] text-ink-muted">{online ? t('pvp.rk.unrankedOnline', { n: RANKED.startRating }) : t('pvp.rk.unrankedOffline')}</p>
          ) : (
            <div className="mt-3">
              <p className="text-[34px] leading-none font-extrabold text-ink">{rating}</p>
              <p className="mt-1 text-[14px] font-semibold text-brand-blue">{rankLabel(t, rankedTier(rating))}</p>
              {next ? <ProgressBar className="mt-3" tone="blue" value={Math.min(100, ((rating - RANKED.tiers[tierIndex].min) / (next.min - RANKED.tiers[tierIndex].min)) * 100)} label={t('pvp.rk.to', { n: next.min - rating, tier: rankLabel(t, next.name) })} /> : null}
              {next ? <p className="mt-1 text-[12px] text-ink-muted">{t('pvp.rk.points', { n: next.min - rating, tier: rankLabel(t, next.name) })}</p> : <p className="mt-1 text-[12px] text-ink-muted">{t('pvp.rk.top')}</p>}
            </div>
          )}
          <ol className="mt-4 flex flex-col gap-1.5">
            {[...RANKED.tiers].reverse().map((tier, i) => {
              const index = RANKED.tiers.length - 1 - i;
              return (
                <li key={tier.name} className={cn('flex items-center justify-between rounded-tile px-3 py-2 text-[13px]', index === tierIndex ? 'bg-brand-blue text-white' : 'bg-page')}>
                  <span className="flex items-center gap-2 font-semibold">
                    <Medal className="size-4" aria-hidden />
                    {rankLabel(t, tier.name)}
                  </span>
                  <span className={index === tierIndex ? 'text-white/80' : 'text-ink-muted'}>{tier.min}+</span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card>
          <CardHeader title={t('pvp.rk.board')} subtitle={t(online ? 'pvp.rk.top50' : 'pvp.rk.onlineOnly')} />
          {!online ? (
            <p className="mt-3 text-[13px] text-ink-muted">{t('pvp.rk.noBoard')}</p>
          ) : rows === null ? (
            <p className="mt-3 text-[13px] text-ink-muted">{t('pvp.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">{t('pvp.rk.nobody')}</p>
          ) : (
            <table className="mt-3 w-full text-[13px]">
              <thead className="text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="py-1">#</th>
                  <th className="py-1">{t('pvp.player')}</th>
                  <th className="py-1">{t('pvp.rk.tier')}</th>
                  <th className="py-1 text-right">{t('pvp.rk.rating')}</th>
                  <th className="py-1 text-right">W/P</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className={cn('border-t border-line', r.userId === profile.userId && 'bg-brand-blue-soft font-semibold')}>
                    <td className="py-1.5">{r.rank <= 3 ? <Trophy className={cn('size-4', r.rank === 1 ? 'text-brand-gold' : 'text-ink-soft')} aria-label={t('pvp.rk.rank', { n: r.rank })} /> : r.rank}</td>
                    <td className="py-1.5">{r.displayName}</td>
                    <td className="py-1.5">{rankLabel(t, r.tier)}</td>
                    <td className="py-1.5 text-right">{r.rating}</td>
                    <td className="py-1.5 text-right">
                      {r.won}/{r.played}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
