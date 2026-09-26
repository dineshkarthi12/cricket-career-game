import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { simulateCareer } from '@/engine/career/careerSim';
const env = process.env;
it('runs', () => {
  const n = Number(env.N ?? 10), first = Number(env.FIRST ?? 0);
  for (let i = 0; i < n; i++) {
    const t = Date.now();
    const r = simulateCareer(1 + (first + i) * 7919, env.END ? Number(env.END) : undefined);
    appendFileSync(env.OUT ?? '/tmp/claude-0/runs.jsonl', JSON.stringify({ ms: Date.now() - t, ...r }) + '\n');
  }
}, 7200000);
