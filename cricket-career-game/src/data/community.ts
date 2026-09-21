/**
 * Simulated community chatter for the Home feed. Not part of the save file -
 * the fan reaction is generated, not owned by the career.
 */
export interface CommunityPost {
  id: string;
  handle: string;
  body: string;
  /** Relative time as the feed shows it. */
  time: string;
}

export const COMMUNITY_POSTS: CommunityPost[] = [
  { id: 'post-1', handle: 'CricketFan07', body: 'Bro your cover drive is 🔥', time: '5m ago' },
  { id: 'post-2', handle: 'TNCricket', body: 'Excited to see you in TN team!', time: '1h ago' },
  { id: 'post-3', handle: 'FutureStar', body: 'Which bat are you using?', time: '2h ago' },
  { id: 'post-4', handle: 'ChepaukFaithful', body: 'That 67 was pure class 👏', time: '5h ago' },
];
