import { Heart, MessageCircle } from 'lucide-react';
import { Avatar, Badge, Card, CardHeader, ProgressBar, StatTile } from '@/components';
import { COMMUNITY_POSTS } from '@/data/community';
import { formatLongDate } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import type { GameState, MediaStory } from '@/types';

export default function CommunityScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Community state={state} />;
}

export function followersLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const TONE: Record<MediaStory['tone'], 'green' | 'grey' | 'red'> = { PRAISE: 'green', NEUTRAL: 'grey', CRITICAL: 'red' };

function Community({ state }: { state: GameState }) {
  const fans = state.pro.fans;
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Community</h1>
        <p className="text-[13px] text-ink-muted">The press and the public. Big days grow the following; failures on big stages build pressure - and pressure is felt.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Followers" value={followersLabel(fans.followers)} />
        <StatTile label="Public mood" value={`${fans.sentiment}/100`} />
        <StatTile label="Media pressure" value={`${fans.pressure}/100`} />
      </div>
      <Card>
        <CardHeader title="Pressure" subtitle="Above 60 it costs confidence; near the top the selectors notice too" className="mb-2" />
        <ProgressBar value={fans.pressure} tone={fans.pressure >= 60 ? 'red' : fans.pressure >= 35 ? 'orange' : 'green'} label="Media pressure" />
      </Card>
      <Card>
        <CardHeader title="Stories" subtitle="Newest first" className="mb-2" />
        {fans.stories.length === 0 ? (
          <>
            <p className="mb-2 text-[13px] text-ink-muted">The papers have not found you yet - senior cricket brings the stories. The local chatter:</p>
            <ul className="flex flex-col gap-1.5">
              {COMMUNITY_POSTS.map((p) => (
                <li key={p.id} className="flex items-start gap-2.5 rounded-tile bg-page px-2.5 py-2">
                  <Avatar name={p.handle} size={30} decorative />
                  <span className="text-[13px] text-ink"><span className="font-semibold">{p.handle}</span> {p.body}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <ul className="flex flex-col gap-2">
          {fans.stories.map((s) => (
            <li key={s.id} className="rounded-tile bg-page px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                <span className="font-semibold text-ink">{s.outlet}</span>
                <span>{formatLongDate(s.date)}</span>
                <Badge tone={TONE[s.tone]} className="text-[11px]">{s.tone.toLowerCase()}</Badge>
              </div>
              <p className="mt-1 text-[14px] font-semibold text-ink">{s.headline}</p>
              <p className="text-[13px] text-ink-muted">{s.body}</p>
              <p className="mt-1 flex items-center gap-3 text-[12px] text-ink-muted">
                <span className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-hidden /> {followersLabel(s.likes)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" aria-hidden /> {followersLabel(Math.round(s.likes / 9))}</span>
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
