import { lazy, Suspense, useState } from 'react';
import { Check, Flame, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { Avatar, Badge, Card, CardHeader, ProgressBar, StatTile } from '@/components';
import { FANS } from '@/engine/config';
import { activeTrend, followersText } from '@/engine/pro/fans';
import { COMMUNITY_POSTS } from '@/data/community';
import { formatLongDate } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import type { FanPost, GameState, MediaStory } from '@/types';

const FollowersChart = lazy(() => import('./FollowersChart'));
/** Fan posts before "Show more". */
const POSTS_SHOWN = 8;

export default function CommunityScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
  return <Community state={state} />;
}

export function followersLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const TONE: Record<MediaStory['tone'], 'green' | 'grey' | 'red'> = { PRAISE: 'green', NEUTRAL: 'grey', CRITICAL: 'red' };
const MOOD_TONE: Record<FanPost['mood'], 'gold' | 'green' | 'grey' | 'red'> = { HYPE: 'gold', PRAISE: 'green', NEUTRAL: 'grey', TROLL: 'red' };

function Community({ state }: { state: GameState }) {
  const fans = state.pro.fans;
  const t = useT();
  const trend = activeTrend(fans, state.season.currentDate);
  const history = fans.history ?? [];
  const posts = fans.posts ?? [];
  const nextMilestone = FANS.milestones.find((m) => fans.followers < m);
  const [allPosts, setAllPosts] = useState(false);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('nav.community')}</h1>
        <p className="text-[13px] text-ink-muted">{t('pro.com.intro')}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('pro.com.followers')} value={followersLabel(fans.followers)} />
        <StatTile label={t('pro.com.mood')} value={`${fans.sentiment}/100`} />
        <StatTile label={t('pro.com.mediaPressure')} value={`${fans.pressure}/100`} />
      </div>
      {trend ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card bg-brand-navy px-4 py-3 text-white" role="status">
          <Flame className="size-5 text-brand-gold" aria-hidden />
          <span className="text-[12px] font-semibold tracking-wide text-white/70 uppercase">{t('pro.com.trending')}</span>
          <span className="text-[16px] font-bold">{trend.tag}</span>
          <span className="ml-auto text-[12px] text-white/70">{t('pro.com.trendPosts', { n: followersText(trend.posts) })}</span>
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('pro.com.growth')} subtitle={t('pro.com.growthSub')} className="mb-2" />
          {history.length >= 2 ? (
            <Suspense fallback={<div className="h-56 animate-pulse rounded-tile bg-page" />}>
              <FollowersChart data={history} />
            </Suspense>
          ) : (
            <p className="text-[13px] text-ink-muted">{t('pro.com.growthEmpty')}</p>
          )}
        </Card>
        <Card>
          <CardHeader title={t('pro.com.milestones')} className="mb-2" />
          <ul className="flex flex-wrap gap-2">
            {FANS.milestones.map((m) => {
              const done = fans.followers >= m;
              return (
                <li key={m}>
                  <Badge tone={done ? 'green' : 'grey'} className="gap-1">
                    {done ? <Check className="size-3" aria-hidden /> : null}
                    {followersText(m)}
                  </Badge>
                </li>
              );
            })}
          </ul>
          {nextMilestone ? (
            <div className="mt-3">
              <ProgressBar value={Math.min(100, (fans.followers / nextMilestone) * 100)} tone="blue" label={t('pro.com.milestones')} />
              <p className="mt-1 text-[12px] text-ink-muted">{t('pro.com.toGo', { n: followersText(nextMilestone - fans.followers), target: followersText(nextMilestone) })}</p>
            </div>
          ) : (
            <p className="mt-3 text-[13px] font-semibold text-brand-green">{t('pro.com.allMilestones')}</p>
          )}
        </Card>
      </div>
      <Card>
        <CardHeader title={t('pro.com.fans')} subtitle={t('pro.com.fansSub')} className="mb-2" />
        {posts.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.com.noPosts')}</p> : null}
        <ul className="flex flex-col gap-2">
          {posts.slice(0, allPosts ? FANS.postsKept : POSTS_SHOWN).map((p) => (
            <li key={p.id} className="flex items-start gap-2.5 rounded-tile bg-page px-3 py-2.5">
              <Avatar name={p.handle} size={32} decorative />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                  <span className="font-semibold text-ink">@{p.handle}</span>
                  <span>{formatLongDate(p.date)}</span>
                  <Badge tone={MOOD_TONE[p.mood]} className="text-[11px]">{t(`fan.mood.${p.mood}` as Key)}</Badge>
                </div>
                <p className="mt-0.5 text-[13.5px] break-words text-ink">{t(p.key as Key, p.params)}</p>
                <p className="mt-1 flex items-center gap-3 text-[12px] text-ink-muted">
                  <span className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-hidden /> {followersLabel(p.likes)}</span>
                  <span className="inline-flex items-center gap-1"><Repeat2 className="size-3.5" aria-hidden /> {followersLabel(Math.round(p.likes / 6))}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        {posts.length > POSTS_SHOWN ? (
          <button type="button" onClick={() => setAllPosts((v) => !v)} className="mt-2 text-[13px] font-semibold text-brand-blue">
            {allPosts ? t('pro.com.fewerPosts') : t('pro.com.morePosts', { n: posts.length - POSTS_SHOWN })}
          </button>
        ) : null}
      </Card>
      <Card>
        <CardHeader title={t('pro.com.pressure')} subtitle={t('pro.com.pressureSub')} className="mb-2" />
        <ProgressBar value={fans.pressure} tone={fans.pressure >= 60 ? 'red' : fans.pressure >= 35 ? 'orange' : 'green'} label={t('pro.com.mediaPressure')} />
      </Card>
      <Card>
        <CardHeader title={t('pro.com.stories')} subtitle={t('pro.com.newest')} className="mb-2" />
        {fans.stories.length === 0 ? (
          <>
            <p className="mb-2 text-[13px] text-ink-muted">{t('pro.com.noStories')}</p>
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
                <Badge tone={TONE[s.tone]} className="text-[11px]">{t(`pro.tone.${s.tone}` as Key)}</Badge>
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
