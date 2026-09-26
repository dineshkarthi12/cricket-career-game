// @ts-nocheck
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { formatReport, summarise } from '@/engine/career/careerSim';
it('report', () => {
  const runs = (process.env.FILES ?? '').split(',').flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
  writeFileSync('/tmp/claude-0/report.txt', formatReport(summarise(runs)));
});
