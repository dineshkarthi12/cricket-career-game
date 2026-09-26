/**
 * Spoken commentary, one bank per moment. `{batter}`, `{bowler}` and
 * `{fielder}` are filled in; lines are short so they fit between balls.
 * Fictional players only - the names come from the match.
 */
export type VoiceMoment =
  | 'SIX'
  | 'FOUR'
  | 'THREE'
  | 'TWO'
  | 'SINGLE'
  | 'DOT'
  | 'BEATEN'
  | 'BOWLED'
  | 'CAUGHT'
  | 'CAUGHT_BEHIND'
  | 'CAUGHT_AND_BOWLED'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET'
  | 'DUCK'
  | 'GOLDEN_DUCK'
  | 'DROPPED'
  | 'FIFTY'
  | 'HUNDRED'
  | 'FIVE_FOR'
  | 'WIDE'
  | 'NO_BALL'
  | 'WIN'
  | 'LOSS'
  | 'DRAW';

export const VOICE_LINES: Record<VoiceMoment, string[]> = {
  SIX: [
    "That's huge! {batter} sends it into the stands!",
    'Six! Out of the ground!',
    'Up, up and away - maximum for {batter}!',
    "What a strike! That's gone all the way!",
    'Into the crowd! {batter} is in the mood today!',
    "Oh, that's massive! {bowler} can only watch it sail.",
    'Clean as you like. Six more!',
    "Somebody catch that! It's a monster hit from {batter}!",
  ],
  FOUR: [
    'Cracking shot! Four runs.',
    'Timed to perfection - it races away to the fence!',
    'No stopping that one. Four!',
    'Pierces the gap beautifully. {batter} collects four.',
    "That's a boundary! Lovely stuff from {batter}.",
    'Crunched! The fielder had no chance.',
    'Short and punished. Four to {batter}.',
    'Oh, what a shot! Straight to the rope.',
  ],
  THREE: [
    "They're running hard - and they get three!",
    'Chased down just inside the rope. Three runs.',
    'Great running. Three to {batter}.',
  ],
  TWO: [
    "Good running, they'll come back for two.",
    'Pushed into the gap, and it is two.',
    'Sharp between the wickets - a couple more.',
    'Two runs, and that keeps the scoreboard ticking.',
    "They turn for the second and make it easily.",
  ],
  SINGLE: [
    'Nudged away for one.',
    'Quick single, well run.',
    'Rotates the strike.',
    'Dabbed into the off side for a single.',
    'Tapped and run. One.',
  ],
  DOT: [
    'Well bowled. No run.',
    'Solid defence from {batter}.',
    'Dot ball. Good pressure from {bowler}.',
    'Straight to the fielder. No run.',
  ],
  BEATEN: [
    'Beaten! That was close.',
    'Past the edge! {bowler} is getting closer.',
    'Oh, that just missed the outside edge!',
  ],
  BOWLED: [
    'Bowled him! The stumps are shattered!',
    'Clean bowled! {batter} has to go.',
    "Timber! {bowler} knocks back the stumps!",
    'Through the gate - and the bails are flying!',
  ],
  CAUGHT: [
    'In the air... and taken! {batter} is gone!',
    'Caught! {fielder} makes no mistake.',
    'Straight down the throat of {fielder}! Out!',
    'He has picked out the fielder. {batter} walks.',
  ],
  CAUGHT_BEHIND: [
    'Edged and taken! The keeper does the rest.',
    'A thin nick, and {batter} is caught behind!',
  ],
  CAUGHT_AND_BOWLED: [
    'Caught and bowled! Sharp reflexes from {bowler}!',
    '{bowler} holds a stunning return catch!',
  ],
  LBW: [
    'Big appeal... and given! {batter} is trapped in front.',
    'Plumb! That was hitting middle stump.',
    'Up goes the finger! {batter} is out, leg before wicket.',
  ],
  STUMPED: [
    'Stumped! Lightning work behind the stumps!',
    'Down the track, misses it, and the keeper whips the bails off!',
  ],
  RUN_OUT: [
    "Oh, there's a mix-up! Direct hit - and he's run out!",
    'Run out! Terrible calling, and {batter} has to walk.',
    'Brilliant fielding! Run out by a mile!',
    'Diving... not in! {batter} is run out!',
    'Chaos in the middle! One run too many, and {batter} is gone.',
  ],
  HIT_WICKET: [
    'Oh no! {batter} has trodden on the stumps. Hit wicket!',
  ],
  DUCK: [
    'Gone for a duck! {batter} walks back without scoring.',
    'Oh dear, a duck for {batter}. That hurts.',
    "Nought! {batter} won't want to see that again.",
  ],
  GOLDEN_DUCK: [
    'First ball! A golden duck for {batter}!',
    'Out first ball! {batter} can hardly believe it.',
  ],
  DROPPED: [
    "Dropped! That's a life for {batter}.",
    "Oh, {fielder} has put it down! {batter} survives.",
    "Should have been out! The chance goes to ground.",
  ],
  FIFTY: [
    'Fifty for {batter}! Raise the bat, well played!',
    'Half-century! Terrific knock from {batter}.',
    "That's fifty! The crowd are on their feet for {batter}.",
  ],
  HUNDRED: [
    'Hundred! What a moment for {batter}! The crowd is going wild!',
    'Century! {batter} has reached three figures!',
    'There it is! A magnificent hundred for {batter}!',
  ],
  FIVE_FOR: [
    'Five wickets for {bowler}! What a spell!',
    "That's a five-for! {bowler} has ripped through them!",
  ],
  WIDE: ['Wide ball.', "That's a wide. Extra run."],
  NO_BALL: ['No ball! Free hit coming up.', 'Overstepped - no ball.'],
  WIN: ['And that is the match! {team} win it!', "It's all over! Victory for {team}!"],
  LOSS: ["It's all over. {team} win this one.", 'That is the end of it. {team} take the match.'],
  DRAW: ["And that's the end. The match is drawn.", 'Honours even. A draw.'],
};

export interface VoiceNames {
  batter?: string;
  bowler?: string;
  fielder?: string;
  team?: string;
}

/**
 * A line for the moment, filled in. `seed` picks among the variants (the
 * ball id, so a replay says the same thing); `avoid` is the last line used,
 * so the same line never plays twice running.
 */
export function voiceLine(moment: VoiceMoment, names: VoiceNames, seed: string, avoid?: string | null): string {
  const lines = VOICE_LINES[moment];
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  let pick = lines[hash % lines.length];
  const fill = (text: string) =>
    text
      .replace(/\{batter\}/g, names.batter ?? 'the batter')
      .replace(/\{bowler\}/g, names.bowler ?? 'the bowler')
      .replace(/\{fielder\}/g, names.fielder ?? 'the fielder')
      .replace(/\{team\}/g, names.team ?? 'they')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?])/g, '$1')
      .trim();
  if (lines.length > 1 && fill(pick) === avoid) pick = lines[(hash + 1) % lines.length];
  return fill(pick);
}
