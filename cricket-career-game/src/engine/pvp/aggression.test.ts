/**
 * The aggression bar, played by a person in Live PvP: 1 hardly ever gets out,
 * and each step up scores faster - 4 more than 3, 5 most of all - without
 * level 5 losing a wicket every over.
 */
import { describe, expect, it } from 'vitest';
import { PvpMatch, type MatchEvent, type MatchSetup, type SideSetup } from './match';
import { claimStarter, createProfile } from './economy';
import { autoPickSquad } from './squad';
import { createRng } from '../match/rng';

function side(seed: number, userId: string, isBot: boolean): SideSetup {
  const p = createProfile({ userId, displayName: userId, friendCode: 'ABC123', now: '2026-10-02T10:00:00.000Z' });
  const r = claimStarter(p, { requestId: `starter-${userId}` }, { now: '2026-10-02T10:00:00.000Z', rng: createRng(seed) });
  if (!r.ok) throw new Error(r.message);
  const squad = autoPickSquad(r.profile.inventory)!;
  const byId = new Map(r.profile.inventory.map((o) => [o.instanceId, o]));
  return { userId, displayName: userId, isBot, xi: squad.xi.map((id) => ({ instanceId: id, cardId: byId.get(id)!.cardId, upgrades: 0 })), captainInstanceId: squad.captain };
}

/** The human's top six, batting every ball at `level`: per-ball wicket and run rates. */
function battingAt(level: number, matches: number): { out: number; runs: number } {
  let balls = 0;
  let wickets = 0;
  let runs = 0;
  for (let m = 0; m < matches; m += 1) {
    const setup: MatchSetup = { matchId: `agg-${level}-${m}`, seed: 1000 + m, mode: 'PRACTICE', sides: [side(m + 1, 'human', false), side(m + 500, 'bot', true)] };
    let now = 0;
    const match = new PvpMatch(setup, now);
    for (let i = 0; i < 20_000 && !match.complete; i += 1) {
      if (match.actingSide() === 0 && match.currentPhase === 'AWAIT_BAT') {
        match.submit('human', { type: 'PLAY', actionId: `p${i}`, deliveryId: match.currentDeliveryId, level }, now);
        continue;
      }
      now += 400;
      match.tick(now);
    }
    const start = match.events[0];
    if (start.kind !== 'MATCH_START') throw new Error('no start');
    const topSix = new Set(start.sides[0].players.slice(0, 6).map((p) => p.id));
    let open: Extract<MatchEvent, { kind: 'DELIVERY_OPEN' }> | null = null;
    for (const e of match.events) {
      if (e.kind === 'DELIVERY_OPEN') open = e;
      if (e.kind !== 'BALL_RESULT' || !open || !topSix.has(open.strikerId) || e.outcome.extras?.type === 'WIDE') continue;
      balls += 1;
      runs += e.outcome.runsOffBat;
      if (e.outcome.dismissedPlayerId === open.strikerId) wickets += 1;
    }
  }
  return { out: wickets / balls, runs: runs / balls };
}

/** Expected runs from a short PvP innings of up to `cap` balls. */
function expectedRuns(r: { out: number; runs: number }, cap = 12): number {
  const survived = (1 - Math.pow(1 - r.out, cap)) / r.out;
  return survived * r.runs;
}

describe('batting aggression in Live PvP', () => {
  it('runs from 1 to 5, safe to fast', () => {
    const levels = [1, 2, 3, 4, 5].map((l) => battingAt(l, 70));
    // 1: about one innings in ten ends over 25 balls.
    expect(1 - Math.pow(1 - levels[0].out, 25)).toBeLessThan(0.18);
    // Each step up scores faster, and the bigger the step the more risk.
    for (let i = 1; i < 5; i += 1) expect(levels[i].runs).toBeGreaterThan(levels[i - 1].runs);
    expect(levels[4].out).toBeGreaterThan(levels[2].out);
    // In a short innings 4 makes more than 3, and 5 the most.
    expect(expectedRuns(levels[3])).toBeGreaterThan(expectedRuns(levels[2]));
    expect(expectedRuns(levels[4])).toBeGreaterThan(expectedRuns(levels[3]));
    // 5 is risky, not suicide: well under one wicket an over.
    expect(levels[4].out).toBeLessThan(0.11);
  }, 300_000);
});
