import { Avatar, Card, CardHeader } from '@/components';
import { COMMUNITY_POSTS } from '@/data/community';
import { relativeInGameDate } from '@/lib/format';
import type { GameState } from '@/types';

/**
 * The press and the public. Once the professional career starts, the feed is
 * the career's own stories (`pro.fans`); before that, local chatter.
 */
export function CommunityCard({ state }: { state?: GameState }) {
  const stories = state?.pro?.fans.stories ?? [];
  const followers = state?.pro?.fans.followers ?? 0;
  return (
    <Card>
      <CardHeader
        title="Community"
        subtitle={stories.length ? `${followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers} followers` : 'Join the conversation'}
        action={{ label: 'View', to: '/community' }}
        className="mb-2.5"
      />
      <ul className="flex flex-col gap-1.5">
        {stories.length
          ? stories.slice(0, 3).map((s) => (
              <li key={s.id} className="flex items-start gap-2.5 rounded-tile bg-page/70 px-2.5 py-2">
                <Avatar name={s.outlet} size={32} decorative />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-ink">{s.outlet}</span>
                    <span className="shrink-0 text-[10.5px] text-ink-soft">{state ? relativeInGameDate(s.date, state.season.currentDate) : ''}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">{s.headline}</span>
                </span>
              </li>
            ))
          : COMMUNITY_POSTS.slice(0, 3).map((post) => (
              <li key={post.id} className="flex items-start gap-2.5 rounded-tile bg-page/70 px-2.5 py-2">
                <Avatar name={post.handle} size={32} decorative />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-ink">{post.handle}</span>
                    <span className="shrink-0 text-[10.5px] text-ink-soft">{post.time}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">{post.body}</span>
                </span>
              </li>
            ))}
      </ul>
    </Card>
  );
}
