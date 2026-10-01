/**
 * Phones keep audio locked until a gesture they accept. The crowd a match
 * asked for must start once audio is allowed, and never after the match ends.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  started = 0;
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(16) };
  }
  createBufferSource() {
    const self = this;
    return { buffer: null, loop: false, connect: (x: unknown) => x, start() { self.started += 1; }, stop() {} };
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect: (x: unknown) => x };
  }
  createOscillator() {
    return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x, start() {}, stop() {} };
  }
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

async function load() {
  let ctx: FakeContext | null = null;
  vi.stubGlobal('AudioContext', function () {
    ctx = new FakeContext();
    return ctx;
  });
  const player = await import('./player');
  return { player, ctx: () => ctx! };
}

describe('audio on phones', () => {
  it('a crowd asked for while audio is locked starts once it unlocks', async () => {
    const { player, ctx } = await load();
    player.startAmbience();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx().resume).toHaveBeenCalled();
    expect(ctx().started).toBe(1);
  });

  it('never starts the crowd after the match has ended', async () => {
    const { player, ctx } = await load();
    player.startAmbience();
    player.stopAmbience();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx().started).toBe(0);
  });

  it('a ball sound waiting on the unlock plays once audio runs', async () => {
    const { player, ctx } = await load();
    player.playSfx(['BAT']);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx().state).toBe('running');
    expect(ctx().resume).toHaveBeenCalled();
  });
});
