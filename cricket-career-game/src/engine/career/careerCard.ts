/**
 * The shareable career card: the player's name, role, stage, career figures,
 * best achievements and what they are chasing next - all read from the save.
 * Pure TypeScript; the screen draws it and the browser shares it.
 */
import { getStage, TOTAL_CAREER_STAGES } from '@/data/stages';
import { evaluateTargets } from './targets';
import type { GameState, MatchFormat, TrophyTier } from '@/types';

export interface CareerCardData {
  name: string;
  role: string;
  age: number | null;
  stage: string;
  stageNumber: number;
  totalStages: number;
  matches: number;
  runs: number;
  battingAverage: number | null;
  strikeRate: number | null;
  highScore: string;
  hundreds: number;
  fifties: number;
  wickets: number;
  bowlingAverage: number | null;
  best: string | null;
  fiveFors: number;
  trophies: number;
  achievements: string[];
  target: string;
}

const TIER_ORDER: Record<TrophyTier, number> = { PLATINUM: 0, GOLD: 1, SILVER: 2, BRONZE: 3 };

export function careerCardData(state: GameState, roleLabel: (role: GameState['player']['role']) => string): CareerCardData {
  const formats = Object.values(state.player.record.byFormat) as GameState['player']['record']['byFormat'][MatchFormat][];
  let matches = 0;
  let innings = 0;
  let notOuts = 0;
  let runs = 0;
  let balls = 0;
  let hundreds = 0;
  let fifties = 0;
  let wickets = 0;
  let conceded = 0;
  let fiveFors = 0;
  let high = 0;
  let highNotOut = false;
  let best: { wickets: number; runs: number } | null = null;
  for (const f of formats) {
    matches += f.batting.matches;
    innings += f.batting.innings;
    notOuts += f.batting.notOuts;
    runs += f.batting.runs;
    balls += f.batting.balls;
    hundreds += f.batting.hundreds;
    fifties += f.batting.fifties;
    wickets += f.bowling.wickets;
    conceded += f.bowling.runsConceded;
    fiveFors += f.bowling.fiveWicketHauls;
    if (f.batting.highScore > high) {
      high = f.batting.highScore;
      highNotOut = f.batting.highScoreNotOut;
    }
    const b = f.bowling.bestInnings;
    if (b && (!best || b.wickets > best.wickets || (b.wickets === best.wickets && b.runs < best.runs))) best = b;
  }
  const outs = innings - notOuts;
  const stage = getStage(state.career.currentStageId);
  const target = evaluateTargets(state);
  const unlocked = state.trophies
    .filter((t) => t.unlocked)
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || (b.unlockedOn ?? '').localeCompare(a.unlockedOn ?? ''));
  const nextStage = stage.order < TOTAL_CAREER_STAGES ? `Earn a place beyond ${stage.shortLabel}` : 'Leave a legacy';
  const targetText = target.target
    ? `${target.target.runs}+ runs at ${target.target.average}+ or ${target.target.wickets}+ wickets this season`
    : nextStage;
  return {
    name: `${state.player.firstName} ${state.player.lastName}`.trim(),
    role: roleLabel(state.player.role),
    age: typeof state.player.age === 'number' ? state.player.age : null,
    stage: stage.name,
    stageNumber: stage.order,
    totalStages: TOTAL_CAREER_STAGES,
    matches,
    runs,
    battingAverage: outs > 0 ? Math.round((runs / outs) * 10) / 10 : null,
    strikeRate: balls > 0 ? Math.round((runs / balls) * 1000) / 10 : null,
    highScore: high > 0 ? `${high}${highNotOut ? '*' : ''}` : '-',
    hundreds,
    fifties,
    wickets,
    bowlingAverage: wickets > 0 ? Math.round((conceded / wickets) * 10) / 10 : null,
    best: best ? `${best.wickets}/${best.runs}` : null,
    fiveFors,
    trophies: unlocked.length,
    achievements: unlocked.slice(0, 3).map((t) => t.name),
    target: targetText,
  };
}

/** The card as plain text, for sharing where an image cannot go. */
export function careerCardText(card: CareerCardData): string {
  const lines = [
    `${card.name} - ${card.role}`,
    `Cricket Career 26 · Stage ${card.stageNumber}/${card.totalStages}: ${card.stage}`,
    `${card.matches} matches · ${card.runs} runs${card.battingAverage !== null ? ` @ ${card.battingAverage}` : ''}${card.strikeRate !== null ? ` (SR ${card.strikeRate})` : ''} · HS ${card.highScore}`,
  ];
  if (card.wickets > 0) lines.push(`${card.wickets} wickets${card.bowlingAverage !== null ? ` @ ${card.bowlingAverage}` : ''}${card.best ? ` · best ${card.best}` : ''}`);
  if (card.hundreds + card.fifties > 0) lines.push(`${card.hundreds} hundreds · ${card.fifties} fifties`);
  if (card.achievements.length > 0) lines.push(`Achievements: ${card.achievements.join(', ')}`);
  lines.push(`Trophies: ${card.trophies}`);
  lines.push(`Next: ${card.target}`);
  return lines.join('\n');
}
