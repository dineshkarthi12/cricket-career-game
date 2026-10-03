/** Rankings: the ranked ladder, the player's tier, and the server leaderboard. */
import { useEffect, useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
import { Card, CardHeader, ProgressBar } from '@/components';
import { RANKED, rankedTier, type LeaderRow } from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { SectionTitle } from './ui';

export default function RankingsScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const mode = usePvpStore((s) => s.mode);
  const call = usePvpStore((s) => s.call);
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
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
      <SectionTitle title="Rankings" subtitle="Ranked rating moves only in online ranked matches, calculated by the server (Elo)." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Your ranked status" />
          {rating === null ? (
            <p className="mt-3 text-[13px] text-ink-muted">{online ? 'Unranked - play a ranked match to get a rating. Everyone starts at ' + RANKED.startRating + '.' : 'Unranked. The offline demo never changes ranked rating; connect to the online server to play ranked.'}</p>
          ) : (
            <div className="mt-3">
              <p className="text-[34px] leading-none font-extrabold text-ink">{rating}</p>
              <p className="mt-1 text-[14px] font-semibold text-brand-blue">{rankedTier(rating)}</p>
              {next ? <ProgressBar className="mt-3" tone="blue" value={Math.min(100, ((rating - RANKED.tiers[tierIndex].min) / (next.min - RANKED.tiers[tierIndex].min)) * 100)} label={`${next.min - rating} to ${next.name}`} /> : null}
              {next ? <p className="mt-1 text-[12px] text-ink-muted">{next.min - rating} points to {next.name}</p> : <p className="mt-1 text-[12px] text-ink-muted">Top tier.</p>}
            </div>
          )}
          <ol className="mt-4 flex flex-col gap-1.5">
            {[...RANKED.tiers].reverse().map((t, i) => {
              const index = RANKED.tiers.length - 1 - i;
              return (
                <li key={t.name} className={cn('flex items-center justify-between rounded-tile px-3 py-2 text-[13px]', index === tierIndex ? 'bg-brand-blue text-white' : 'bg-page')}>
                  <span className="flex items-center gap-2 font-semibold">
                    <Medal className="size-4" aria-hidden />
                    {t.name}
                  </span>
                  <span className={index === tierIndex ? 'text-white/80' : 'text-ink-muted'}>{t.min}+</span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Leaderboard" subtitle={online ? 'Top 50 on this server' : 'Available on the online server'} />
          {!online ? (
            <p className="mt-3 text-[13px] text-ink-muted">The offline demo has no leaderboard: there are no other players on this device. Run the PvP server and connect from Live PvP home.</p>
          ) : rows === null ? (
            <p className="mt-3 text-[13px] text-ink-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">Nobody has played ranked on this server yet.</p>
          ) : (
            <table className="mt-3 w-full text-[13px]">
              <thead className="text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="py-1">#</th>
                  <th className="py-1">Player</th>
                  <th className="py-1">Tier</th>
                  <th className="py-1 text-right">Rating</th>
                  <th className="py-1 text-right">W/P</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className={cn('border-t border-line', r.userId === profile.userId && 'bg-brand-blue-soft font-semibold')}>
                    <td className="py-1.5">{r.rank <= 3 ? <Trophy className={cn('size-4', r.rank === 1 ? 'text-brand-gold' : 'text-ink-soft')} aria-label={`Rank ${r.rank}`} /> : r.rank}</td>
                    <td className="py-1.5">{r.displayName}</td>
                    <td className="py-1.5">{r.tier}</td>
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
