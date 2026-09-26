import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { simulateCareer } from '@/engine/career/careerSim';
const env = process.env;
it('runs', () => {
  const n = Number(env.N ?? 10), first = Number(env.FIRST ?? 0), end = Number(env.END ?? 30);
  for (let i = 0; i < n; i++) {
    const r = simulateCareer(1 + (first + i) * 7919, end);
    appendFileSync(env.OUT ?? '/tmp/claude-0/runs.jsonl', JSON.stringify(r) + '\n');
  }
}, 7200000);
