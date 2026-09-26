import { describe, expect, it } from 'vitest';
import { simulatedStart } from '../career/careerSim';
import { fastForward } from './fastForward';

describe('dev fast-forward', () => {
  it('plays a number of weeks on the real calendar', () => {
    const start = simulatedStart(7);
    const result = fastForward(start, { kind: 'WEEKS', weeks: 3 });
    expect(result.reached).toBe(true);
    expect(result.weeks).toBe(3);
    expect(result.state.season.currentDate > start.season.currentDate).toBe(true);
  });

  it('stops at the next season', () => {
    const start = simulatedStart(7);
    const result = fastForward(start, { kind: 'SEASON' });
    expect(result.reached).toBe(true);
    expect(result.state.season.year).toBe(start.season.year + 1);
    expect(result.state.career.pendingReview).toBeNull();
  }, 60000);
});
