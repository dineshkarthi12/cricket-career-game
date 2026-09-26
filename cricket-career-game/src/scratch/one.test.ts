import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { simulateCareer } from '@/engine/career/careerSim';
const env = process.env;
it('one', () => {
  const seeds = (env.SEEDS ?? '1').split(',').map(Number);
  for (const s of seeds) {
    const t = Date.now();
    const r = simulateCareer(s, env.END ? Number(env.END) : undefined);
    appendFileSync(env.OUT ?? '/tmp/claude-0/one.jsonl', JSON.stringify({ ms: Date.now() - t, ...r }) + '\n');
  }
}, 7200000);
