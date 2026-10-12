import { Flame } from 'lucide-react';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import { Avatar, Card, CardHeader } from '@/components';
import { activeTrend } from '@/engine/pro/fans';
import { COMMUNITY_POSTS } from '@/data/community';
import { relativeInGameDate } from '@/lib/format';
import type { GameState } from '@/types';

/**
 * The press and the public. Once the professional career starts, the feed is
 * the career's own stories and fan posts (`pro.fans`), with any trending
 * hashtag on top; before that, local chatter.
 */
export function CommunityCard({ state }: { state?: GameState }) {
  const stories = state?.pro?.fans.stories ?? [];
  const posts = state?.pro?.fans.posts ?? [];
  const followers = state?.pro?.fans.followers ?? 0;
  const trend = state?.pro ? activeTrend(state.pro.fans, state.season.currentDate) : null;
  const t = useT();
  // Newest first, posts and stories together.
  const feed = [
    ...posts.slice(0, 3).map((p) => ({ id: p.id, date: p.date, who: `@${p.handle}`, text: t(p.key as Key, p.params) })),
    ...stories.slice(0, 3).map((s) => ({ id: s.id, date: s.date, who: s.outlet, text: s.headline })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  // Early in a career there is nobody following yet: nothing to show.
  if (state && !feed.length && followers < 100) return null;
  return (
    <Card>
      <CardHeader
        title={t('community.title')}
        subtitle={feed.length ? t('community.followers', { n: followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers }) : t('community.join')}
        action={{ label: t('common.view'), to: '/community' }}
        className="mb-2.5"
      />
      {trend ? (
        <p className="mb-2 flex items-center gap-1.5 rounded-tile bg-brand-navy px-2.5 py-1.5 text-[12px] font-semibold text-white">
          <Flame className="size-3.5 text-brand-gold" aria-hidden />
          {t('pro.com.trending')}: {trend.tag}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {feed.length
          ? feed.map((s) => (
              <li key={s.id} className="flex items-start gap-2.5 rounded-tile bg-page/70 px-2.5 py-2">
                <Avatar name={s.who} size={32} decorative />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-ink">{s.who}</span>
                    <span className="shrink-0 text-[10.5px] text-ink-soft">{state ? relativeInGameDate(s.date, state.season.currentDate) : ''}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">{s.text}</span>
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
