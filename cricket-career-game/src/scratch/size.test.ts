import { it } from 'vitest';
import { createNewCareer } from '@/engine/newCareer';
import { playOn } from '@/engine/career/careerSim';

const out = (x: unknown) => process.stdout.write('\n' + JSON.stringify(x));

it('size', () => {
  let state = createNewCareer({ firstName: 'A', lastName: 'B', dateOfBirth: '2016-03-03', creationRole: 'BATTER', bowlingStyle: 'RIGHT_ARM_MEDIUM', seed: 42, startDate: '2026-06-01' });
  for (let i = 0; i < 52 * 16; i++) {
    state = playOn(state);
    state = { ...state, career: { ...state.career, pendingReview: null } };
  }
  const json = JSON.stringify(state);
  const parts: Record<string, number> = {};
  for (const [k, v] of Object.entries(state)) parts[k] = JSON.stringify(v).length;
  const teams = Object.values(state.teams);
  out(['total', json.length, parts, 'teams', teams.length, 'rivals', teams.reduce((s, t) => s + t.squad.length, 0), 'stage', state.career.currentStageId, 'age', state.player.age]);
  out(['one rival', JSON.stringify(teams.find((t) => t.squad.length)!.squad[0]).length]);
}, 600000);
