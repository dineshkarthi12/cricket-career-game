/**
 * OFFLINE DEMO backend: the PvP authority running in this browser.
 *
 * Practice matches are against the AI, the collection is stored locally
 * (IndexedDB, separate from career saves), and the economy uses the same
 * validated operations the server uses. Because the authority runs on the
 * player's own device it is NOT tamper-proof - so nothing here touches the
 * ranked ladder, and ranked, rooms and friends report that they need the
 * online server.
 */
import { createStore, get, set, type UseStore } from 'idb-keyval';
import { createRng } from '@/engine/match/rng';
import {
  PvpMatch,
  auditProfile,
  botSide,
  buyCard,
  claimDaily,
  claimStarter,
  claimWeekly,
  createProfile,
  grantDevGems,
  openPack,
  recordMatch,
  saveSquad,
  sideFromProfile,
  summarize,
  upgradeCard,
  type MatchAction,
  type OpResult,
  type PvpProfile,
} from '@/engine/pvp';
import type { RequestArgs, RequestOp } from '@/engine/pvp/protocol';
import { Emitter, type CallResult, type PvpBackend } from './backend';

const KEY = 'profile-v1';

function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32);
}

export class OfflineBackend implements PvpBackend {
  readonly mode = 'OFFLINE_DEMO' as const;
  readonly label = 'Offline demo · practice vs AI on this device';
  readonly devGems = true;
  private emitter = new Emitter();
  private profile: PvpProfile | null = null;
  private store: UseStore | null = null;
  private match: PvpMatch | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private persistent = true;
  /** Paused time is cut out of the match clock, so deadlines never expire during a pause. */
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  readonly pausable = true;

  private now(): number {
    return (this.pausedAt ?? Date.now()) - this.pausedTotal;
  }

  setPaused(paused: boolean): void {
    if (paused && this.pausedAt === null) {
      this.pausedAt = Date.now();
      this.stopTimer();
    } else if (!paused && this.pausedAt !== null) {
      this.pausedTotal += Date.now() - this.pausedAt;
      this.pausedAt = null;
      this.schedule();
    }
  }

  private db(): UseStore {
    return (this.store ??= createStore('cricket-career-pvp', 'pvp'));
  }

  async connect(): Promise<PvpProfile> {
    this.emitter.emit({ type: 'connection', status: 'connecting' });
    let loaded: PvpProfile | undefined;
    try {
      const raw = await get<string>(KEY, this.db());
      loaded = raw ? (JSON.parse(raw) as PvpProfile) : undefined;
    } catch {
      this.persistent = false;
      this.emitter.emit({ type: 'connection', status: 'error', message: 'Local storage is unavailable: your PvP collection will not be saved in this browser.' });
    }
    const now = new Date().toISOString();
    this.profile = loaded ?? createProfile({ userId: `local-${randomSeed().toString(36)}`, displayName: 'You', friendCode: '—', now });
    if (!loaded) await this.persist();
    this.emitter.emit({ type: 'connection', status: 'online' });
    this.emitter.emit({ type: 'profile', profile: this.profile });
    return this.profile;
  }

  private async persist(): Promise<void> {
    if (!this.profile || !this.persistent) return;
    const snapshot = JSON.stringify(this.profile);
    this.saving = this.saving.then(() => set(KEY, snapshot, this.db())).catch(() => {
      this.emitter.emit({ type: 'connection', status: 'error', message: 'Could not save your PvP collection to this browser.' });
    });
    await this.saving;
  }

  private apply(result: OpResult): CallResult {
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    this.profile = result.profile;
    void this.persist();
    this.emitter.emit({ type: 'profile', profile: result.profile });
    return { ok: true, data: { profile: result.profile, txn: result.txn, replayed: result.replayed } };
  }

  async call(op: RequestOp, args: RequestArgs = {}): Promise<CallResult> {
    const p = this.profile;
    if (!p) return { ok: false, code: 'NOT_READY', message: 'Not connected.' };
    const ctx = { now: new Date().toISOString(), rng: createRng(randomSeed()) };
    const requestId = args.requestId ?? '';
    switch (op) {
      case 'profile':
        return { ok: true, data: { profile: p } };
      case 'claimStarter':
        return this.apply(claimStarter(p, { requestId }, ctx));
      case 'openPack':
        return this.apply(openPack(p, { requestId, packId: args.packId ?? '' }, ctx));
      case 'buyCard':
        return this.apply(buyCard(p, { requestId, cardId: args.cardId ?? '' }, ctx));
      case 'claimDaily':
        return this.apply(claimDaily(p, { requestId }, ctx));
      case 'claimWeekly':
        return this.apply(claimWeekly(p, { requestId }, ctx));
      case 'upgrade':
        return this.apply(upgradeCard(p, { requestId, instanceId: args.instanceId ?? '' }, ctx));
      case 'devGems':
        return this.apply(grantDevGems(p, { requestId }, ctx));
      case 'saveSquad': {
        const r = saveSquad(p, args.squad!);
        if (!r.ok) return { ok: false, code: r.issues[0].code, message: r.issues.map((i) => i.message).join(' ') };
        this.profile = r.profile;
        void this.persist();
        this.emitter.emit({ type: 'profile', profile: r.profile });
        return { ok: true, data: { profile: r.profile } };
      }
      case 'rename': {
        const name = (args.name ?? '').trim().slice(0, 24);
        if (name.length < 2) return { ok: false, code: 'BAD_NAME', message: 'Pick a name of 2-24 characters.' };
        this.profile = { ...p, displayName: name };
        void this.persist();
        this.emitter.emit({ type: 'profile', profile: this.profile });
        return { ok: true, data: { profile: this.profile } };
      }
      case 'practice':
        return this.startPractice();
      case 'match.resume':
        return { ok: true, data: { events: this.match && this.match.matchId === args.matchId ? this.match.eventsSince(args.sinceSeq ?? 0) : [] } };
      case 'leaderboard':
      case 'queue.join':
      case 'queue.leave':
      case 'room.create':
      case 'room.join':
      case 'room.leave':
      case 'friends.list':
      case 'friends.add':
      case 'friends.invite':
        return { ok: false, code: 'NEEDS_SERVER', message: 'This needs the online PvP server. The offline demo only plays practice matches against the AI.' };
      default:
        return { ok: false, code: 'UNKNOWN_OP', message: `Unknown request ${op}.` };
    }
  }

  private startPractice(): CallResult {
    const p = this.profile!;
    if (auditProfile(p).some((i) => i.code === 'SCHEMA')) return { ok: false, code: 'BAD_PROFILE', message: 'This collection cannot be played.' };
    const me = sideFromProfile(p, false);
    if (!me) return { ok: false, code: 'NO_SQUAD', message: 'Pick a valid XI first (Squad).' };
    const seed = randomSeed();
    this.stopTimer();
    const matchId = `practice-${seed.toString(36)}`;
    this.match = new PvpMatch({ matchId, seed, mode: 'PRACTICE', sides: [me, botSide(seed ^ 0x5bd1e995, new Date().toISOString())] }, this.now());
    this.emitter.emit({ type: 'events', matchId, events: this.match.events });
    this.schedule();
    return { ok: true, data: { matchId, events: this.match.events } };
  }

  async sendAction(matchId: string, action: MatchAction): Promise<CallResult> {
    const m = this.match;
    if (!m || m.matchId !== matchId || !this.profile) return { ok: false, code: 'NO_MATCH', message: 'That match is not running.' };
    const r = m.submit(this.profile.userId, action, this.now());
    if (!r.ok) return { ok: false, code: r.code, message: r.message };
    if (r.events.length) this.emitter.emit({ type: 'events', matchId, events: r.events });
    this.afterEvents();
    this.schedule();
    return { ok: true, data: { events: r.events } };
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Drive deadlines and the AI side from the match's own wake-up times. */
  private schedule(): void {
    this.stopTimer();
    const m = this.match;
    if (!m || m.complete || this.pausedAt !== null) return;
    const wake = m.nextWakeAt();
    if (wake === null) return;
    this.timer = setTimeout(() => {
      if (this.match !== m) return;
      const events = m.tick(this.now());
      if (events.length) this.emitter.emit({ type: 'events', matchId: m.matchId, events });
      this.afterEvents();
      this.schedule();
    }, Math.max(15, wake - this.now()));
  }

  /** Pay out once the match is over - once, keyed by match id. */
  private afterEvents(): void {
    const m = this.match;
    if (!m || !m.complete || !m.result || !this.profile) return;
    const summary = summarize({ matchId: m.matchId, at: new Date().toISOString(), mode: 'PRACTICE', side: 0, opponent: m.setup.sides[1].displayName, result: m.result, ratingChange: null });
    const r = recordMatch(this.profile, { summary, ranked: false, newRating: null }, { now: new Date().toISOString(), rng: createRng(1) });
    if (r.ok && !r.replayed) this.apply(r);
  }

  serverNow(): number {
    return this.now();
  }

  on(listener: Parameters<Emitter['on']>[0]): () => void {
    return this.emitter.on(listener);
  }

  dispose(): void {
    this.stopTimer();
    this.match = null;
    this.emitter.clear();
  }
}
