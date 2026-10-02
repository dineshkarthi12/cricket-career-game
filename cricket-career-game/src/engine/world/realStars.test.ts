/**
 * The stars of the data season are in the game when it starts: a manager
 * season begins in 2027 and a career's senior years later still, so a real
 * player who was active must not retire before a ball is bowled.
 */
import { describe, expect, it } from 'vitest';
import { createManagerCareer } from '../manager/create';
import { agePlayers } from '../manager/development';
import { createRng } from '../match/rng';
import { produce } from '../manager/util';
import { realData, realPlayerAt, realRecord } from './realPlayers';

const STARS = ['Virat Kohli', 'Rohit Sharma', 'MS Dhoni', 'Jasprit Bumrah', 'Ravindra Jadeja', 'Mitchell Starc', 'Pat Cummins', 'Andre Russell'];

describe('real stars stay in the game', () => {
  it('no player in a real squad has retired by 2027 or 2028', () => {
    const data = realData()!;
    const ids = new Set([...Object.values(data.ipl.squads).flat(), ...Object.values(data.international.squads).flat()]);
    for (const year of [2027, 2028]) {
      const gone = [...ids].filter((id) => {
        const rec = realRecord(id);
        return rec && !realPlayerAt(rec, { teamId: 'team-x', region: 'India', seasonYear: year });
      });
      expect(gone.map((id) => realRecord(id)!.n), String(year)).toEqual([]);
    }
  });

  it('they still retire in time: veterans leave over the following seasons', () => {
    const data = realData()!;
    const ids = [...new Set(Object.values(data.ipl.squads).flat())];
    const gone = ids.filter((id) => !realPlayerAt(realRecord(id)!, { teamId: 'team-x', region: 'India', seasonYear: 2032 }));
    expect(gone.length).toBeGreaterThan(20);
  });

  it('IPL Manager starts with Kohli at RCB and the stars in squads, and they survive the first season', () => {
    const state = createManagerCareer({ name: 'A', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 4 });
    const contracted = (name: string) => Object.values(state.players).find((p) => p.name === name && p.contract);
    for (const star of STARS) expect(contracted(star), star).toBeDefined();
    const kohli = contracted('Virat Kohli')!;
    expect(state.franchises[kohli.contract!.franchiseId].name).toMatch(/Bengaluru/);

    let retired: string[] = [];
    const after = produce(state, (d) => void (retired = agePlayers(d, createRng(9))));
    for (const star of STARS) {
      const p = Object.values(after.players).find((x) => x.name === star)!;
      expect(p.retired ?? false, star).toBe(false);
    }
    expect(retired.map((id) => state.players[id].name)).not.toContain('Virat Kohli');
  });
});
