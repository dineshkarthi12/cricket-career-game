import { Avatar, Card, CardHeader } from '@/components';
import { COMMUNITY_POSTS } from '@/data/community';

/** Simulated fan chatter. Generated, so it lives outside the save file. */
export function CommunityCard() {
  return (
    <Card>
      <CardHeader
        title="Community"
        subtitle="Join the conversation"
        action={{ label: 'View', to: '/community' }}
        className="mb-2.5"
      />
      <ul className="flex flex-col gap-1.5">
        {COMMUNITY_POSTS.slice(0, 3).map((post) => (
          <li
            key={post.id}
            className="flex items-start gap-2.5 rounded-tile bg-page/70 px-2.5 py-2"
          >
            <Avatar name={post.handle} size={32} />
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
