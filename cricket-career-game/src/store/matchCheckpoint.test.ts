import { beforeEach, describe, expect, it } from 'vitest';
import { cancelAutosave } from '@/save';
import { getBlobStore } from '@/save/blobStore';
import { checkpointKey, readMatchCheckpoint, resetCheckpointQueues, settleCheckpointWrites, writeMatchCheckpoint } from '@/save/matchCheckpoint';
import { useGameStore } from './gameStore';
import { __resetMatchStore, ballKeyOf, useMatchStore, type CareerMatchCheckpoint } from './matchStore';

const FIXTURE = 'fx-ka-u16';

function reset() {
  cancelAutosave();
  localStorage.clear();
  resetCheckpointQueues();
  useGameStore.setState({ state: null, booted: false, slot: null, slots: [null, null, null], lastError: null, toasts: [] });
  __resetMatchStore();
  useGameStore.getState().loadDemoCareer(1);
}

/** Open the fixture and wait for the look for a saved match. */
async function open() {
  const state = useGameStore.getState().state!;
  useMatchStore.getState().open(state, state.fixtures[FIXTURE]);
  for (let i = 0; i < 50 && useMatchStore.getState().resuming; i += 1) await new Promise((r) => setTimeout(r, 0));
  expect(useMatchStore.getState().resuming).toBe(false);
}

/** A page reload: the in-memory match is gone; the career and IndexedDB stay. */
async function reload() {
  await settleCheckpointWrites();
  __resetMatchStore();
  await open();
}

/** Into play and a few balls in, answering anything asked. */
function playSome(balls: number) {
  const store = () => useMatchStore.getState();
  if (store().stage === 'PRE_MATCH') store().toToss();
  if (store().stage === 'TOSS') store().toss('BAT');
  for (let i = 0; i < balls && store().stage !== 'DONE'; i += 1) {
    if (store().snap?.question) store().answer({ timing: 0.6 });
    else if (store().stage === 'BREAK') store().startNextInnings();
    else store().playBall('ROTATE');
  }
}

/** The score, ball for ball (ids aside). */
function score() {
  const snap = useMatchStore.getState().snap!;
  const all = [...snap.completed.flatMap((i) => i.deliveries), ...(snap.current?.deliveries ?? [])];
  return { key: ballKeyOf(snap), runs: snap.current?.runs, wickets: snap.current?.wickets, balls: all.map((b) => [b.strikerId, b.bowlerId, b.runsOffBat, b.line, b.length, Boolean(b.wicket)]) };
}

describe('match save and resume', () => {
  beforeEach(reset);

  it('a reload picks the match up from the same ball, with a toast', async () => {
    await open();
    playSome(25);
    const before = score();
    expect(before.balls.length).toBeGreaterThan(10);
    await reload();
    expect(useMatchStore.getState().stage).toBe('PLAYING');
    expect(useMatchStore.getState().resumed).toBe(true);
    expect(score()).toEqual(before);
    expect(useGameStore.getState().toasts.at(-1)?.message).toMatch(/^Match resumed - 1st innings, \d+\.\d overs\.$/);
  });

  it('the next ball comes out the same however often the page is reloaded before it', async () => {
    await open();
    playSome(12);
    await settleCheckpointWrites();
    const raw = await getBlobStore().get(checkpointKey('career', 1, FIXTURE));
    expect(raw).toBeTruthy();
    // Bowl the ball live.
    useMatchStore.getState().playBall('ATTACK');
    const live = score();
    // Reload from the checkpoint taken before that ball and bowl it again.
    await settleCheckpointWrites();
    await getBlobStore().set(checkpointKey('career', 1, FIXTURE), raw!);
    await reload();
    useMatchStore.getState().playBall('ATTACK');
    expect(score()).toEqual(live);
  });

  it('clears the checkpoint when the match is finished', async () => {
    await open();
    playSome(6);
    await settleCheckpointWrites();
    expect((await readMatchCheckpoint('career', 1, FIXTURE)).ok && (await readMatchCheckpoint('career', 1, FIXTURE) as { value: unknown }).value).toBeTruthy();
    useMatchStore.getState().simulateRest();
    expect(useMatchStore.getState().stage).toBe('DONE');
    await settleCheckpointWrites();
    await new Promise((r) => setTimeout(r, 0));
    const after = await readMatchCheckpoint('career', 1, FIXTURE);
    expect(after.ok && after.value).toBeNull();
  });

  it('a corrupted checkpoint restarts the fixture with a toast', async () => {
    await open();
    playSome(10);
    await settleCheckpointWrites();
    await getBlobStore().set(checkpointKey('career', 1, FIXTURE), '{"kind":"career-match", broken');
    await reload();
    expect(useMatchStore.getState().stage).toBe('PRE_MATCH');
    expect(useGameStore.getState().toasts.at(-1)).toMatchObject({ tone: 'error' });
    expect(await getBlobStore().get(checkpointKey('career', 1, FIXTURE))).toBeUndefined();
  });

  it('a tampered checkpoint (a ball taken out) is refused, and the fixture restarts', async () => {
    await open();
    playSome(10);
    await settleCheckpointWrites();
    const read = await readMatchCheckpoint('career', 1, FIXTURE);
    const saved = (read.ok ? read.value : null) as CareerMatchCheckpoint;
    const i = saved.live.log.findIndex((a) => a.k === 'ball');
    await writeMatchCheckpoint('career', 1, FIXTURE, { ...saved, live: { ...saved.live, log: saved.live.log.filter((_, j) => j !== i) } });
    await reload();
    expect(useMatchStore.getState().stage).toBe('PRE_MATCH');
    expect(useGameStore.getState().toasts.at(-1)?.message).toMatch(/could not be restored/);
  });

  it('a checkpoint from another career in the slot is ignored and cleared', async () => {
    await open();
    playSome(8);
    await settleCheckpointWrites();
    const read = await readMatchCheckpoint('career', 1, FIXTURE);
    const saved = (read.ok ? read.value : null) as CareerMatchCheckpoint;
    await writeMatchCheckpoint('career', 1, FIXTURE, { ...saved, playerId: 'someone-else' });
    await reload();
    expect(useMatchStore.getState().stage).toBe('PRE_MATCH');
    expect(await getBlobStore().get(checkpointKey('career', 1, FIXTURE))).toBeUndefined();
  });

  it('deleting the career deletes its saved match', async () => {
    await open();
    playSome(8);
    await settleCheckpointWrites();
    useGameStore.getState().deleteCareer(1);
    await new Promise((r) => setTimeout(r, 0));
    await settleCheckpointWrites();
    expect(await getBlobStore().get(checkpointKey('career', 1, FIXTURE))).toBeUndefined();
  });
});
