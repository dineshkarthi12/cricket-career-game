import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createNewCareer } from '@/engine/newCareer';
import { playOn } from '@/engine/career/careerSim';
import { createRng } from '@/engine/match/rng';
import { rankGroup } from '@/engine/career/squads';
import { formatOverall } from '@/engine/ratings';
it('debug', () => {
  const seed = Number(process.env.SEED ?? 324680);
  const rng = createRng(seed);
  const role = rng.pick(['BATTER', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'] as const);
  const month = rng.int(1, 12);
  const dob = `2016-${String(month).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
  const bowler = role === 'BOWLER' || role === 'ALLROUNDER';
  let state = createNewCareer({ firstName: 'Sim', lastName: String(seed), dateOfBirth: dob, creationRole: role, bowlingStyle: bowler ? rng.pick(['RIGHT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX'] as const) : 'RIGHT_ARM_MEDIUM', seed, startDate: '2026-06-01' });
  const out: string[] = [];
  let printed = 0;
  for (let i = 0; i < 52 * 26 && printed < 3; i++) {
    const before = state.pro.national.caps.T20I + state.pro.national.caps.ODI + state.pro.national.caps.TEST;
    const watchedBefore = state.pro.national.watched;
    state = playOn(state);
    const after = state.pro.national.caps.T20I + state.pro.national.caps.ODI + state.pro.national.caps.TEST;
    if ((state.pro.national.watched && !watchedBefore) || (after > 0 && before === 0)) {
      printed += 1;
      out.push(`--- ${state.season.currentDate} age ${state.player.age} ovr ${state.player.overall} caps ${after} rep ${state.pro.scouting.reputation}`);
      out.push(JSON.stringify(state.career.squads, null, 0).slice(0, 1500));
      const team = state.teams['team-india'];
      for (const tid of ['intl-test', 'intl-odi', 'intl-t20i']) {
        const r = rankGroup(state, team, [tid]);
        out.push(tid + ': ' + r.slice(0, 8).map((x) => `${x.candidate.isUser ? '**' : ''}${x.candidate.name}(${x.candidate.age}) ovr${x.candidate.overall} sc${x.score}${x.candidate.outside ? 'o' : ''}`).join(' | '));
      }
      out.push('india squad ovr: ' + team.squad.map((p) => `${p.role.slice(0, 4)}${p.overall}/${formatOverall(p.attributes, p.role, 'TEST')}@${p.age}`).join(' '));
    }
  }
  writeFileSync('/tmp/claude-0/debug.txt', out.join('\n'));
}, 900000);
