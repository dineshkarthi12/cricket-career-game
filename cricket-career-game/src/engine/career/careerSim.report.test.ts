/**
 * The balance run: `CAREER_SIM=100 npx vitest run careerSim.report` plays
 * that many whole careers and prints the report. Skipped otherwise.
 */
import { describe, expect, it } from 'vitest';
import { formatReport, simulateCareer, summarise, type SimulatedCareerRun } from './careerSim';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

const count = Number(env.CAREER_SIM ?? 0);
const endAge = env.CAREER_SIM_END_AGE ? Number(env.CAREER_SIM_END_AGE) : undefined;
const first = Number(env.CAREER_SIM_FIRST ?? 1);

describe.skipIf(!count)('career balance simulation', () => {
  it(`plays ${count} careers`, () => {
    const runs: SimulatedCareerRun[] = [];
    for (let i = 0; i < count; i += 1) {
      const t = Date.now();
      runs.push(simulateCareer(first + i * 7919, endAge));
      const r = runs[runs.length - 1];
      if (env.CAREER_SIM_VERBOSE) console.log(`career ${i + 1}: ${r.role} pot ${r.hiddenPotential} final ${r.finalStageId} ovr ${r.finalOverall} matches ${r.matches} outcomes ${r.outcomes.join(',')} (${Date.now() - t} ms)`);
    }
    const report = formatReport(summarise(runs));
    console.log(report);
    expect(runs.length).toBe(count);
  }, 3_600_000);
});
