// @ts-nocheck
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createNewCareer } from '@/engine/newCareer';
import { playOn } from '@/engine/career/careerSim';
import { createRng } from '@/engine/match/rng';
it('size2', () => {
  const seed = 142543;
  const rng = createRng(seed);
  const role = rng.pick(['BATTER', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'] as const);
  const month = rng.int(1, 12);
  const dob = `2016-${String(month).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
  let state = createNewCareer({ firstName: 'Sim', lastName: String(seed), dateOfBirth: dob, creationRole: role, bowlingStyle: rng.pick(['RIGHT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX'] as const), seed, startDate: '2026-06-01' });
  const out: string[] = [];
  const t0 = Date.now();
  for (let i = 0; i < 52 * 22; i++) {
    state = playOn(state);
    state = { ...state, career: { ...state.career, pendingReview: null } };
  }
  const len = (x: unknown) => JSON.stringify(x).length;
  out.push(`ms ${Date.now() - t0} total ${len(state)} age ${state.player.age} stage ${state.career.currentStageId}`);
  for (const [k, v] of Object.entries(state)) out.push(`${k} ${len(v)}`);
  for (const [k, v] of Object.entries(state.pro)) out.push(`pro.${k} ${len(v)}`);
  const m = Object.values(state.matches);
  out.push(`matches n=${m.length} withBalls=${m.filter((x) => x.innings.some((i) => i.deliveries.length)).length} avg=${Math.round(len(state.matches) / m.length)}`);
  out.push(`fixtures n=${Object.keys(state.fixtures).length}`);
  out.push(`seasonHistory n=${state.seasonHistory.length} ${state.seasonHistory.map((s) => len(s)).join(',')}`);
  const sh = state.seasonHistory[state.seasonHistory.length - 1];
  for (const t of sh.tournaments) out.push(`  ${t.tournamentId} ${len(t)} results=${Object.keys(t.results).length} stats=${Object.keys(t.stats).length}`);
  const teams = Object.values(state.teams);
  out.push(`teams n=${teams.length} withSquad=${teams.filter((t) => t.squad.length).length} rivals=${teams.reduce((s, t) => s + t.squad.length, 0)}`);
  const byKind: Record<string, number> = {};
  for (const t of teams) byKind[t.kind + '/' + t.level] = (byKind[t.kind + '/' + t.level] ?? 0) + len(t);
  out.push(JSON.stringify(byKind));
  out.push(`season ${len(state.season)} tournaments ${state.season.tournaments.map((t) => t.tournamentId + ':' + len(t)).join(' ')}`);
  const r = teams.find((t) => t.squad.length)!.squad[0];
  for (const [k, v] of Object.entries(r)) out.push(`  rival.${k} ${len(v)}`);
  const mm = m.find((x) => x.userPerformance)!;
  for (const [k, v] of Object.entries(mm)) out.push(`  match.${k} ${len(v)}`);
  writeFileSync('/tmp/claude-0/size2.txt', out.join('\n'));
}, 900000);
