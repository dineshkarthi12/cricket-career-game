import { describe, expect, it } from 'vitest';
import { PvpMatch, type MatchSetup, type SideSetup } from '@/engine/pvp/match';
import { claimStarter, createProfile } from '@/engine/pvp/economy';
import { autoPickSquad } from '@/engine/pvp/squad';
import { createRng } from '@/engine/match/rng';
import { deriveCareerView } from './careerView';

function side(seed: number, userId: string): SideSetup {
  const p = createProfile({ userId, displayName: userId, friendCode: 'ABC123', now: '2026-10-02T10:00:00.000Z' });
  const r = claimStarter(p, { requestId: `starter-${userId}` }, { now: '2026-10-02T10:00:00.000Z', rng: createRng(seed) });
  if (!r.ok) throw new Error(r.message);
  const squad = autoPickSquad(r.profile.inventory)!;
  const byId = new Map(r.profile.inventory.map((o) => [o.instanceId, o]));
  return { userId, displayName: userId, isBot: true, xi: squad.xi.map((id) => ({ instanceId: id, cardId: byId.get(id)!.cardId, upgrades: 0 })), captainInstanceId: squad.captain };
}

describe('PvP drawn as a career match', () => {
  it('builds scorecards and a ball log that add up to the authority\'s score', () => {
    const setup: MatchSetup = { matchId: 'cv', seed: 5, mode: 'PRACTICE', sides: [side(1, 'a'), side(2, 'b')] };
    let now = 1_000;
    const match = new PvpMatch(setup, now);
    for (let i = 0; i < 2000 && !match.complete; i += 1) {
      now = Math.max(now + 50, match.nextWakeAt() ?? now);
      match.tick(now);
    }
    const view = deriveCareerView(match.events);
    expect(view.innings).toHaveLength(2);
    const scores = match.result!.scores;
    for (const inn of view.innings) {
      const side = inn.battingTeamId === 's0' ? 0 : 1;
      expect(inn.runs).toBe(scores[side].runs);
      expect(inn.wickets).toBe(scores[side].wickets);
      const batRuns = inn.batting.reduce((a, b) => a + b.runs, 0);
      expect(batRuns + inn.extrasTotal).toBe(inn.runs);
      expect(inn.deliveries.filter((d) => d.isLegalDelivery)).toHaveLength(inn.balls);
      expect(inn.batting.filter((b) => b.out)).toHaveLength(inn.wickets);
      const bowlWickets = inn.bowling.reduce((a, b) => a + b.wickets, 0);
      expect(bowlWickets).toBe(inn.deliveries.filter((d) => d.wicket && d.wicket.type !== 'RUN_OUT').length);
    }
    expect(view.field?.fielders.length).toBeGreaterThan(0);
    expect(view.lastBall).not.toBeNull();
  });
});
