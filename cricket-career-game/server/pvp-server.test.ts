// @vitest-environment node
/**
 * The PvP server with real WebSocket clients: two separately authenticated
 * players queue, get matched, play a full ranked match, and are paid and
 * rated by the server. Also: forged and duplicate requests, reconnection,
 * private rooms and friends. A controllable clock replaces waiting.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startPvpServer, type PvpServer } from './pvp-server';
import type { MatchEvent, PublicSide } from '../src/engine/pvp/match';
import type { ServerMessage } from '../src/engine/pvp/protocol';
import type { PvpProfile } from '../src/engine/pvp/types';

let skew = 0;
const clock = () => Date.now() + skew;
let server: PvpServer;

class Client {
  ws!: WebSocket;
  messages: ServerMessage[] = [];
  events: MatchEvent[] = [];
  profile!: PvpProfile;
  token = '';
  userId = '';
  matchId = '';
  side: 0 | 1 = 0;
  private n = 0;

  async connect(auth: { name?: string; token?: string }): Promise<void> {
    this.ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
    });
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMessage;
      this.messages.push(msg);
      if (msg.t === 'events') this.events.push(...msg.events.filter((e) => !this.events.some((x) => x.seq === e.seq)));
      if (msg.t === 'profile') this.profile = msg.profile;
      if (msg.t === 'matchFound') {
        this.matchId = msg.matchId;
        this.side = msg.side;
        this.events = [];
      }
    });
    this.ws.send(JSON.stringify(auth.token ? { t: 'auth', token: auth.token, v: 1 } : { t: 'register', name: auth.name, v: 1 }));
    const welcome = await this.waitFor((m) => m.t === 'welcome');
    if (welcome.t !== 'welcome') throw new Error('no welcome');
    this.profile = welcome.profile;
    this.token = welcome.token;
    this.userId = welcome.userId;
  }

  waitFor(pred: (m: ServerMessage) => boolean, ms = 4000): Promise<ServerMessage> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        const hit = this.messages.find(pred);
        if (hit) return resolve(hit);
        if (Date.now() - start > ms) return reject(new Error('timeout waiting for message'));
        setTimeout(check, 10);
      };
      check();
    });
  }

  async call(op: string, args: Record<string, unknown> = {}): Promise<Extract<ServerMessage, { t: 'res' }>> {
    this.n += 1;
    const id = `${this.userId}-${this.n}`;
    this.ws.send(JSON.stringify({ t: 'req', id, op, args }));
    const res = await this.waitFor((m) => m.t === 'res' && m.id === id);
    if (res.t !== 'res') throw new Error('x');
    if (res.ok && res.data.profile) this.profile = res.data.profile;
    return res;
  }

  close(): void {
    this.ws.close();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  process.env.PVP_QUIET = '1';
  server = await startPvpServer({ port: 0, dataFile: null, now: clock, matchmakingIntervalMs: 30, forfeitAfterMs: 60_000 });
});

afterAll(async () => {
  await server.close();
});

/** Play the live match from both seats until it ends. */
async function playOut(a: Client, b: Client, onBall?: (n: number) => Promise<void>): Promise<void> {
  const seats = [a, b].sort((x, y) => x.side - y.side);
  let balls = 0;
  for (let step = 0; step < 4000; step += 1) {
    const ev = seats[0].events;
    if (ev.some((e) => e.kind === 'MATCH_END')) return;
    const last = [...ev].reverse().find((e) => ['BOWLER_NEEDED', 'DELIVERY_OPEN', 'BALL_RELEASED'].includes(e.kind));
    const start = ev.find((e) => e.kind === 'MATCH_START') as Extract<MatchEvent, { kind: 'MATCH_START' }> | undefined;
    const innings = [...ev].reverse().find((e) => e.kind === 'INNINGS_START') as Extract<MatchEvent, { kind: 'INNINGS_START' }> | undefined;
    if (!last || !start || !innings) {
      await sleep(10);
      continue;
    }
    const bowling = seats[1 - innings.battingSide];
    const batting = seats[innings.battingSide];
    const done = ev.some((e) => e.kind === 'BALL_RESULT' && last.kind === 'BALL_RELEASED' && e.deliveryId === last.deliveryId);
    if (last.kind === 'BOWLER_NEEDED') {
      await bowling.call('match.action', { matchId: bowling.matchId, action: { type: 'SELECT_BOWLER', actionId: `sel-${last.seq}`, bowlerId: last.eligible[0] } });
    } else if (last.kind === 'DELIVERY_OPEN') {
      await bowling.call('match.action', { matchId: bowling.matchId, action: { type: 'BOWL', actionId: `bowl-${last.seq}`, deliveryId: last.deliveryId, deliveryType: last.allowed[0], line: 'OFF_STUMP', length: 'GOOD', field: (['ATTACKING', 'BALANCED', 'DEFENSIVE'] as const)[last.seq % 3] } });
    } else if (last.kind === 'BALL_RELEASED' && !done) {
      // Wait (on the server's clock) until the ball arrives, then play.
      skew += Math.max(0, last.releaseAt + last.window.idealMs - clock());
      const r = await batting.call('match.action', { matchId: batting.matchId, action: { type: 'BAT', actionId: `bat-${last.seq}`, deliveryId: last.deliveryId, shot: 'DRIVE', timingMs: last.window.idealMs, intent: (['NORMAL', 'AGGRESSIVE', 'LOFTED'] as const)[last.seq % 3], direction: 'STRAIGHT' } });
      expect(r.ok).toBe(true);
      balls += 1;
      if (onBall) await onBall(balls);
    }
    await sleep(15);
  }
  throw new Error('match did not finish');
}

describe('PvP server with two real clients', () => {
  it('rejects requests before sign-in', async () => {
    const c = new Client();
    c.ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise((r) => c.ws.on('open', r));
    c.ws.on('message', (raw) => c.messages.push(JSON.parse(String(raw))));
    c.ws.send(JSON.stringify({ t: 'req', id: 'x1', op: 'profile' }));
    const res = await c.waitFor((m) => m.t === 'res');
    expect(res.t === 'res' && !res.ok && res.error.code).toBe('UNAUTHENTICATED');
    c.close();
  });

  it('matches two players, plays a ranked match, and settles it on the server', async () => {
    const a = new Client();
    const b = new Client();
    await a.connect({ name: 'Alice' });
    await b.connect({ name: 'Bilal' });
    expect(a.userId).not.toBe(b.userId);
    for (const c of [a, b]) {
      const r = await c.call('claimStarter', { requestId: `starter-${c.userId}` });
      expect(r.ok).toBe(true);
    }
    // The economy is server-side: a replayed request changes nothing, dev gems are off.
    const coins = a.profile.coins;
    const daily1 = await a.call('claimDaily', { requestId: 'daily-alice-1' });
    const daily2 = await a.call('claimDaily', { requestId: 'daily-alice-1' });
    expect(daily1.ok && daily2.ok && daily2.data.replayed).toBe(true);
    expect(a.profile.coins).toBe(coins + 200);
    const gems = await a.call('devGems', { requestId: 'gems-alice-1' });
    expect(gems.ok).toBe(false);
    // There is no way to report a result, set a rating or grant a card.
    for (const op of ['recordMatch', 'setRating', 'grantCard']) {
      const r = await a.call(op, { rating: 3000 });
      expect(r.ok).toBe(false);
    }

    expect((await a.call('queue.join')).ok).toBe(true);
    const twice = await a.call('queue.join');
    expect(twice.ok).toBe(false);
    expect((await b.call('queue.join')).ok).toBe(true);
    await a.waitFor((m) => m.t === 'matchFound');
    await b.waitFor((m) => m.t === 'matchFound');
    expect(a.matchId).toBe(b.matchId);
    expect(a.side).not.toBe(b.side);
    // In a match: no second queue entry.
    expect((await a.call('queue.join')).ok).toBe(false);

    // Neither player may act for the other side.
    await sleep(50);
    const start = a.events.find((e) => e.kind === 'MATCH_START');
    expect(start).toBeDefined();

    let reconnected = false;
    await playOut(a, b, async (n) => {
      if (n === 3 && !reconnected) {
        // Out of turn: whoever is batting next cannot bowl.
        const wrong = await (a.side === 0 ? b : a).call('match.action', { matchId: a.matchId, action: { type: 'FORFEIT_NOT_REAL', actionId: 'zzzz' } });
        expect(wrong.ok).toBe(false);
        // Drop B's connection and come back with the same account mid-match.
        reconnected = true;
        const seen = b.events.length ? b.events[b.events.length - 1].seq : 0;
        b.close();
        await sleep(60);
        const b2 = new Client();
        await b2.connect({ token: b.token });
        expect(b2.userId).toBe(b.userId);
        b2.matchId = b.matchId;
        b2.side = b.side;
        const resume = await b2.call('match.resume', { matchId: b.matchId, sinceSeq: seen });
        expect(resume.ok).toBe(true);
        if (resume.ok) {
          const resumed = resume.data.events ?? [];
          expect(resumed.every((e) => e.seq > seen)).toBe(true);
          b2.events = [...b.events, ...resumed];
        }
        Object.assign(b, { ws: b2.ws, messages: b2.messages, events: b2.events });
        b2.ws.on('message', (raw) => {
          const msg = JSON.parse(String(raw)) as ServerMessage;
          if (msg.t === 'events') b.events.push(...msg.events.filter((e) => !b.events.some((x) => x.seq === e.seq)));
          if (msg.t === 'profile') b.profile = msg.profile;
        });
      }
    });

    await sleep(100);
    // Both saw the same authoritative events.
    const seqA = a.events.map((e) => `${e.seq}:${e.kind}`);
    const seqB = b.events.map((e) => `${e.seq}:${e.kind}`);
    expect(seqB).toEqual(seqA);
    const end = a.events.at(-1)!;
    expect(end.kind).toBe('MATCH_END');
    // The 2D controls went through the authority: every ball carries the field and the batter's choice.
    const releases = a.events.filter((e) => e.kind === 'BALL_RELEASED') as Extract<MatchEvent, { kind: 'BALL_RELEASED' }>[];
    expect(releases.length).toBeGreaterThan(0);
    expect(new Set(releases.map((e) => e.fieldSetting)).size).toBeGreaterThan(1);
    expect(releases.every((e) => e.field && e.field.fielders.length === 9)).toBe(true);
    const played = a.events.filter((e) => e.kind === 'BALL_RESULT' && e.shot !== null) as Extract<MatchEvent, { kind: 'BALL_RESULT' }>[];
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((e) => e.intent && e.direction === 'STRAIGHT')).toBe(true);

    // The server rated and paid both players exactly once.
    await a.waitFor((m) => m.t === 'profile' && m.profile.stats.played === 1);
    await sleep(50);
    expect(a.profile.stats.played).toBe(1);
    expect(b.profile.stats.played).toBe(1);
    expect(a.profile.rankedRating).not.toBeNull();
    expect(a.profile.rankedRating! + b.profile.rankedRating!).toBe(2000);
    expect(a.profile.history[0].matchId).toBe(a.matchId);
    const sides = (start as Extract<MatchEvent, { kind: 'MATCH_START' }>).sides as [PublicSide, PublicSide];
    expect(sides.map((s) => s.userId).sort()).toEqual([a.userId, b.userId].sort());
    // Actions after the end are refused.
    const late = await a.call('match.action', { matchId: a.matchId, action: { type: 'FORFEIT', actionId: 'late-1' } });
    expect(late.ok).toBe(false);

    // Leaderboard has both.
    const board = await a.call('leaderboard');
    expect(board.ok && board.data.leaderboard!.length).toBe(2);
    a.close();
    b.close();
  }, 60_000);

  it('private rooms and friends', async () => {
    const host = new Client();
    const guest = new Client();
    await host.connect({ name: 'Host' });
    await guest.connect({ name: 'Guest' });
    for (const c of [host, guest]) await c.call('claimStarter', { requestId: `starter-${c.userId}` });
    const added = await host.call('friends.add', { friendCode: guest.profile.friendCode });
    expect(added.ok).toBe(true);
    const list = await guest.call('friends.list');
    expect(list.ok && list.data.friends![0].userId).toBe(host.userId);
    const invite = await host.call('friends.invite', { userId: guest.userId });
    expect(invite.ok).toBe(true);
    const got = await guest.waitFor((m) => m.t === 'invite');
    if (got.t !== 'invite') throw new Error('x');
    expect((await host.call('room.join', { code: got.code })).ok).toBe(false);
    expect((await guest.call('room.join', { code: 'ZZZZZZ' })).ok).toBe(false);
    const joined = await guest.call('room.join', { code: got.code });
    expect(joined.ok).toBe(true);
    await host.waitFor((m) => m.t === 'matchFound');
    expect(host.matchId).toBe(guest.matchId);
    // A private match is not ranked.
    await host.call('match.action', { matchId: host.matchId, action: { type: 'FORFEIT', actionId: 'ff-host' } });
    await guest.waitFor((m) => m.t === 'profile' && m.profile.stats.played === 1);
    await sleep(50);
    expect(host.profile.rankedRating).toBeNull();
    expect(guest.profile.stats.won).toBe(1);
    host.close();
    guest.close();
  }, 30_000);
});

describe('PvP server storage', () => {
  it('brings a version 1 profile up to date when it loads, keeping every card', async () => {
    const { mkdtempSync, readFileSync: read, writeFileSync: write } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { createProfile, claimStarter, CATALOG } = await import('../src/engine/pvp');
    const { createRng } = await import('../src/engine/match/rng');
    const dir = mkdtempSync(join(tmpdir(), 'pvp-'));
    const file = join(dir, 'db.json');
    const now = new Date().toISOString();
    const started = claimStarter(createProfile({ userId: 'u-old', displayName: 'Old', friendCode: 'OLD123', now }), { requestId: 'starter-old' }, { now, rng: createRng(5) });
    if (!started.ok) throw new Error('starter');
    const card = CATALOG.find((c) => c.tier === 'COMMON' && c.overall === 55)!;
    const v1 = { ...started.profile, schema: 1, inventory: [...started.profile.inventory, { instanceId: 'u-old-99', cardId: card.id, upgrades: 4, acquiredVia: 'COIN_PACK', acquiredAt: now }] };
    write(file, JSON.stringify({ users: { 'u-old': { userId: 'u-old', tokenHash: 'x', profile: v1, friends: [], createdAt: now } } }));
    const s = await startPvpServer({ port: 0, dataFile: file });
    const p = s.store.data.users['u-old'].profile;
    expect(p.schema).toBe(2);
    expect(p.inventory).toHaveLength(v1.inventory.length);
    expect(p.inventory.find((o) => o.instanceId === 'u-old-99')!.upgrades).toBe(0);
    expect(p.coins).toBeGreaterThan(v1.coins);
    await s.close();
    // Written back to disk.
    expect(JSON.parse(read(file, 'utf8')).users['u-old'].profile.schema).toBe(2);
  });
});
