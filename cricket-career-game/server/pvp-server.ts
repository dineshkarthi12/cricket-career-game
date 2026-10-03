/**
 * Cricket Career 26 - Live PvP server.
 *
 * The authority for online play: guest accounts with server-issued tokens,
 * persistent profiles and inventories, ranked matchmaking, private rooms,
 * friends and invites, and authoritative matches run by the same engine as
 * the client (`src/engine/pvp`). Clients only ever send requests; the server
 * validates each one, decides every outcome, and pays every reward.
 *
 * Run:   npm run pvp:server        (PORT=8787, data in server-data/)
 * Env:   PORT, PVP_DATA_FILE, PVP_DEV_GEMS=1 or --dev-gems (development gems), PVP_ALLOWED_ORIGINS
 *
 * Storage is a JSON file written atomically - fine for development and small
 * deployments. A production deployment should swap `JsonStore` for a database.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { dirname } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { createRng } from '../src/engine/match/rng';
import {
  MatchQueue,
  PROTOCOL_VERSION,
  PvpMatch,
  RANKED,
  ROOM_ALPHABET,
  botSide,
  buyCard,
  claimDaily,
  claimStarter,
  claimWeekly,
  createProfile,
  eloUpdate,
  grantDevGems,
  isRoomCode,
  migrateProfile,
  openPack,
  rankedTier,
  recordMatch,
  saveSquad,
  sideFromProfile,
  squadStrength,
  summarize,
  upgradeCard,
  type ClientMessage,
  type FriendView,
  type LeaderRow,
  type MatchAction,
  type MatchEvent,
  type MatchMode,
  type OpData,
  type OpResult,
  type PvpProfile,
  type RequestArgs,
  type ServerMessage,
} from '../src/engine/pvp/index';

// ---------------------------------------------------------------- storage

interface UserRecord {
  userId: string;
  tokenHash: string;
  profile: PvpProfile;
  friends: string[];
  createdAt: string;
}

interface Db {
  users: Record<string, UserRecord>;
}

export class JsonStore {
  private file: string | null;
  data: Db = { users: {} };
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(file: string | null) {
    this.file = file;
    if (file) {
      try {
        this.data = JSON.parse(readFileSync(file, 'utf8')) as Db;
      } catch {
        this.data = { users: {} };
      }
    }
    // Bring older profiles up to date once, at load; each change is on the player's ledger.
    let migrated = 0;
    const at = new Date().toISOString();
    for (const user of Object.values(this.data.users)) {
      const r = migrateProfile(user.profile, at);
      if (r.changed) {
        user.profile = r.profile;
        migrated += 1;
      }
    }
    if (migrated && file) this.flush();
  }

  save(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => this.flush(), 300);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }
}

// ---------------------------------------------------------------- helpers

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const seed32 = () => randomInt(1, 2 ** 31);

function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}): void {
  if (process.env.PVP_QUIET === '1') return;
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), level, event, ...data })}\n`);
}

/** A token bucket: `rate` messages per second, bursts up to `burst`. */
class Bucket {
  private tokens: number;
  private last: number;
  private rate: number;
  private burst: number;
  constructor(rate: number, burst: number) {
    this.rate = rate;
    this.burst = burst;
    this.tokens = burst;
    this.last = Date.now();
  }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

interface Conn {
  ws: WebSocket;
  userId: string | null;
  bucket: Bucket;
  ip: string;
  /** Measured with WebSocket ping/pong frames (server clock only), for matchmaking. */
  rttMs: number | null;
  pingSentAt: number | null;
}

interface LiveMatch {
  match: PvpMatch;
  mode: MatchMode;
  humans: string[];
  timer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
  forfeitTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export interface PvpServerOptions {
  port?: number;
  dataFile?: string | null;
  devGems?: boolean;
  allowedOrigins?: string[];
  /** Injectable clock for tests. */
  now?: () => number;
  /** How long a disconnected player has to come back before forfeiting. */
  forfeitAfterMs?: number;
  matchmakingIntervalMs?: number;
}

export interface PvpServer {
  http: Server;
  port: number;
  store: JsonStore;
  pump(): void;
  close(): Promise<void>;
}

export async function startPvpServer(options: PvpServerOptions = {}): Promise<PvpServer> {
  const now = options.now ?? (() => Date.now());
  const store = new JsonStore(options.dataFile === undefined ? 'server-data/pvp-db.json' : options.dataFile);
  const devGems = Boolean(options.devGems);
  const conns = new Map<string, Conn>();
  const byUser = new Map<string, Conn>();
  const matches = new Map<string, LiveMatch>();
  const matchOf = new Map<string, string>();
  const queue = new MatchQueue();
  const rooms = new Map<string, { host: string; guest: string | null; createdAt: number }>();
  const registrations = new Map<string, number[]>();
  const iso = () => new Date(now()).toISOString();

  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, users: Object.keys(store.data.users).length, matches: matches.size, queued: queue.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });

  const send = (conn: Conn | undefined, msg: ServerMessage) => {
    if (conn && conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(msg));
  };
  const toUser = (userId: string, msg: ServerMessage) => send(byUser.get(userId), msg);
  const user = (userId: string) => store.data.users[userId];

  function friendCode(): string {
    const taken = new Set(Object.values(store.data.users).map((u) => u.profile.friendCode));
    for (;;) {
      const code = Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
      if (!taken.has(code)) return code;
    }
  }

  function register(conn: Conn, name: string): void {
    const recent = (registrations.get(conn.ip) ?? []).filter((t) => now() - t < 60_000);
    if (recent.length >= 5) {
      send(conn, { t: 'error', code: 'RATE_LIMITED', message: 'Too many new accounts from this address. Try again in a minute.' });
      return;
    }
    registrations.set(conn.ip, [...recent, now()]);
    const userId = `u-${randomBytes(6).toString('hex')}`;
    const token = randomBytes(24).toString('base64url');
    const clean = String(name ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24) || 'Player';
    store.data.users[userId] = { userId, tokenHash: sha(token), profile: createProfile({ userId, displayName: clean, friendCode: friendCode(), now: iso() }), friends: [], createdAt: iso() };
    store.save();
    log('info', 'register', { userId });
    attach(conn, userId, token);
  }

  function authenticate(conn: Conn, token: string): void {
    const hash = sha(String(token ?? ''));
    const record = Object.values(store.data.users).find((u) => u.tokenHash === hash);
    if (!record) {
      send(conn, { t: 'error', code: 'BAD_TOKEN', message: 'Unknown account.' });
      return;
    }
    attach(conn, record.userId, token);
  }

  function attach(conn: Conn, userId: string, token: string): void {
    const previous = byUser.get(userId);
    if (previous && previous !== conn) {
      previous.userId = null;
      previous.ws.close(4000, 'Signed in elsewhere');
    }
    conn.userId = userId;
    byUser.set(userId, conn);
    const live = matchOf.get(userId);
    if (live) {
      const lm = matches.get(live);
      const t = lm?.forfeitTimers.get(userId);
      if (t) clearTimeout(t);
      lm?.forfeitTimers.delete(userId);
    }
    send(conn, { t: 'welcome', userId, token, profile: user(userId).profile, serverTime: now(), devGems, v: PROTOCOL_VERSION });
  }

  // ------------------------------------------------------------ matches

  function startMatch(mode: MatchMode, userIds: string[]): string | null {
    const sides = userIds.map((id) => sideFromProfile(user(id).profile, false));
    if (sides.some((s) => !s)) return null;
    const seed = seed32();
    if (sides.length === 1) sides.push(botSide(seed ^ 0x2545f491, iso(), 'Server AI XI'));
    const matchId = `${mode.toLowerCase()}-${seed.toString(36)}-${now().toString(36)}`;
    const match = new PvpMatch({ matchId, seed, mode, sides: [sides[0]!, sides[1]!] }, now());
    const lm: LiveMatch = { match, mode, humans: userIds, timer: null, settled: false, forfeitTimers: new Map() };
    matches.set(matchId, lm);
    userIds.forEach((id, side) => {
      matchOf.set(id, matchId);
      queue.leave(id);
      const opponent = userIds.length === 2 ? user(userIds[1 - side]).profile.displayName : 'Server AI XI';
      toUser(id, { t: 'matchFound', matchId, mode, opponent, side: side as 0 | 1 });
    });
    broadcast(lm, match.events);
    schedule(lm);
    log('info', 'match.start', { matchId, mode, users: userIds });
    return matchId;
  }

  function broadcast(lm: LiveMatch, events: MatchEvent[]): void {
    if (!events.length) return;
    for (const id of lm.humans) toUser(id, { t: 'events', matchId: lm.match.matchId, events, serverTime: now() });
    if (lm.match.complete) settle(lm);
  }

  function schedule(lm: LiveMatch): void {
    if (lm.timer) clearTimeout(lm.timer);
    lm.timer = null;
    const wake = lm.match.nextWakeAt();
    if (wake === null) return;
    lm.timer = setTimeout(() => {
      broadcast(lm, lm.match.tick(now()));
      schedule(lm);
    }, Math.max(10, Math.min(wake - now(), 60_000)));
  }

  /** Ratings, rewards and history - once per match, by the server only. */
  function settle(lm: LiveMatch): void {
    if (lm.settled || !lm.match.result) return;
    lm.settled = true;
    if (lm.timer) clearTimeout(lm.timer);
    for (const t of lm.forfeitTimers.values()) clearTimeout(t);
    const result = lm.match.result;
    const ranked = lm.mode === 'RANKED' && lm.humans.length === 2;
    let newRatings: (number | null)[] = lm.humans.map(() => null);
    if (ranked) {
      const [a, b] = lm.humans.map((id) => user(id).profile.rankedRating ?? RANKED.startRating);
      const score = result.winner === null ? 0.5 : result.winner === 0 ? 1 : 0;
      const r = eloUpdate(a, b, score);
      newRatings = [r.a, r.b];
    }
    lm.humans.forEach((id, side) => {
      const rec = user(id);
      const before = rec.profile.rankedRating ?? RANKED.startRating;
      const opponent = lm.humans.length === 2 ? user(lm.humans[1 - side]).profile.displayName : 'Server AI XI';
      const summary = summarize({ matchId: lm.match.matchId, at: iso(), mode: lm.mode, side: side as 0 | 1, opponent, result, ratingChange: ranked ? newRatings[side]! - before : null });
      const r = recordMatch(rec.profile, { summary, ranked, newRating: newRatings[side] }, { now: iso(), rng: createRng(seed32()) });
      if (r.ok) {
        rec.profile = r.profile;
        toUser(id, { t: 'profile', profile: r.profile });
      }
      matchOf.delete(id);
    });
    store.save();
    log('info', 'match.end', { matchId: lm.match.matchId, summary: result.summary, ranked });
    // Keep finished matches briefly for resume, then drop them.
    setTimeout(() => matches.delete(lm.match.matchId), 120_000).unref?.();
  }

  function onDisconnect(userId: string): void {
    queue.leave(userId);
    for (const [code, room] of rooms) if (room.host === userId && !room.guest) rooms.delete(code);
    const live = matchOf.get(userId);
    const lm = live ? matches.get(live) : null;
    if (!lm || lm.match.complete) return;
    // The match carries on (deadlines act for an absent player); a long absence forfeits.
    lm.forfeitTimers.set(
      userId,
      setTimeout(() => {
        if (byUser.has(userId) || lm.match.complete) return;
        const r = lm.match.submit(userId, { type: 'FORFEIT', actionId: `disconnect-${userId}` }, now());
        if (r.ok) broadcast(lm, r.events);
        log('warn', 'match.forfeit.disconnect', { matchId: lm.match.matchId, userId });
      }, options.forfeitAfterMs ?? 45_000),
    );
  }

  // ------------------------------------------------------------ requests

  function economy(userId: string, result: OpResult): { ok: true; data: OpData } | { ok: false; code: string; message: string } {
    if (!result.ok) return result;
    user(userId).profile = result.profile;
    store.save();
    return { ok: true, data: { profile: result.profile, txn: result.txn, replayed: result.replayed } };
  }

  function handle(conn: Conn, userId: string, op: string, args: RequestArgs): { ok: true; data: OpData } | { ok: false; code: string; message: string } {
    const rec = user(userId);
    const p = rec.profile;
    const ctx = { now: iso(), rng: createRng(seed32()) };
    const requestId = typeof args.requestId === 'string' ? args.requestId : '';
    switch (op) {
      case 'profile':
        return { ok: true, data: { profile: p } };
      case 'claimStarter':
        return economy(userId, claimStarter(p, { requestId }, ctx));
      case 'openPack':
        return economy(userId, openPack(p, { requestId, packId: String(args.packId ?? '') }, ctx));
      case 'buyCard':
        return economy(userId, buyCard(p, { requestId, cardId: String(args.cardId ?? '') }, ctx));
      case 'claimDaily':
        return economy(userId, claimDaily(p, { requestId }, ctx));
      case 'claimWeekly':
        return economy(userId, claimWeekly(p, { requestId }, ctx));
      case 'upgrade':
        return economy(userId, upgradeCard(p, { requestId, instanceId: String(args.instanceId ?? '') }, ctx));
      case 'devGems':
        if (!devGems) return { ok: false, code: 'DISABLED', message: 'Development gems are switched off on this server.' };
        return economy(userId, grantDevGems(p, { requestId }, ctx));
      case 'saveSquad': {
        const r = saveSquad(p, args.squad as never);
        if (!r.ok) return { ok: false, code: r.issues[0]?.code ?? 'BAD_SQUAD', message: r.issues.map((i) => i.message).join(' ') };
        rec.profile = r.profile;
        store.save();
        return { ok: true, data: { profile: r.profile } };
      }
      case 'rename': {
        const name = String(args.name ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24);
        if (name.length < 2) return { ok: false, code: 'BAD_NAME', message: 'Pick a name of 2-24 characters.' };
        rec.profile = { ...p, displayName: name };
        store.save();
        return { ok: true, data: { profile: rec.profile } };
      }
      case 'practice': {
        if (matchOf.has(userId)) return { ok: false, code: 'IN_MATCH', message: 'You are already in a match.' };
        const id = startMatch('PRACTICE', [userId]);
        return id ? { ok: true, data: { matchId: id } } : { ok: false, code: 'NO_SQUAD', message: 'Pick a valid XI first.' };
      }
      case 'queue.join': {
        if (matchOf.has(userId)) return { ok: false, code: 'IN_MATCH', message: 'You are already in a match.' };
        const side = sideFromProfile(p, false);
        if (!side) return { ok: false, code: 'NO_SQUAD', message: 'Pick a valid XI first.' };
        // Strength comes from the server's copy of the collection, never from the client.
        const r = queue.join({ userId, rating: p.rankedRating ?? RANKED.startRating, joinedAt: now(), squad: squadStrength(side.xi), played: p.stats.played, rttMs: conn.rttMs });
        if (!r.ok) return { ok: false, code: r.code, message: 'You are already searching.' };
        send(conn, { t: 'queue', searching: true });
        return { ok: true, data: { queued: true } };
      }
      case 'queue.leave':
        queue.leave(userId);
        send(conn, { t: 'queue', searching: false });
        return { ok: true, data: { queued: false } };
      case 'room.create': {
        for (const [code, room] of rooms) if (room.host === userId) rooms.delete(code);
        let code = '';
        do code = Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
        while (rooms.has(code));
        rooms.set(code, { host: userId, guest: null, createdAt: now() });
        return { ok: true, data: { code } };
      }
      case 'room.join': {
        const code = String(args.code ?? '').toUpperCase();
        const room = isRoomCode(code) ? rooms.get(code) : undefined;
        if (!room) return { ok: false, code: 'NO_ROOM', message: 'No room with that code.' };
        if (room.host === userId) return { ok: false, code: 'OWN_ROOM', message: 'That is your own room - share the code with a friend.' };
        if (room.guest || matchOf.has(room.host)) return { ok: false, code: 'ROOM_FULL', message: 'That room is already playing.' };
        if (matchOf.has(userId)) return { ok: false, code: 'IN_MATCH', message: 'You are already in a match.' };
        room.guest = userId;
        rooms.delete(code);
        const id = startMatch('PRIVATE', [room.host, userId]);
        return id ? { ok: true, data: { matchId: id } } : { ok: false, code: 'NO_SQUAD', message: 'Both players need a valid XI.' };
      }
      case 'room.leave':
        for (const [code, room] of rooms) if (room.host === userId) rooms.delete(code);
        return { ok: true, data: {} };
      case 'friends.list':
        return { ok: true, data: { friends: friendsOf(userId) } };
      case 'friends.add': {
        const code = String(args.friendCode ?? '').toUpperCase();
        const friend = Object.values(store.data.users).find((u) => u.profile.friendCode === code);
        if (!friend) return { ok: false, code: 'NO_USER', message: 'No player with that friend code.' };
        if (friend.userId === userId) return { ok: false, code: 'SELF', message: 'That is your own code.' };
        if (!rec.friends.includes(friend.userId)) rec.friends.push(friend.userId);
        if (!friend.friends.includes(userId)) friend.friends.push(userId);
        store.save();
        return { ok: true, data: { friends: friendsOf(userId) } };
      }
      case 'friends.invite': {
        const target = String(args.userId ?? '');
        if (!rec.friends.includes(target)) return { ok: false, code: 'NOT_FRIEND', message: 'You can only invite friends.' };
        if (!byUser.has(target)) return { ok: false, code: 'OFFLINE', message: 'Your friend is offline.' };
        const created = handle(conn, userId, 'room.create', {});
        if (!created.ok) return created;
        toUser(target, { t: 'invite', from: userId, fromName: p.displayName, code: created.data.code! });
        return created;
      }
      case 'leaderboard': {
        const rows: LeaderRow[] = Object.values(store.data.users)
          .filter((u) => u.profile.rankedRating !== null)
          .sort((a, b) => b.profile.rankedRating! - a.profile.rankedRating!)
          .slice(0, 50)
          .map((u, i) => ({ rank: i + 1, userId: u.userId, displayName: u.profile.displayName, rating: u.profile.rankedRating!, tier: rankedTier(u.profile.rankedRating!), won: u.profile.stats.won, played: u.profile.stats.played }));
        return { ok: true, data: { leaderboard: rows } };
      }
      case 'match.action': {
        const lm = matches.get(String(args.matchId ?? ''));
        if (!lm) return { ok: false, code: 'NO_MATCH', message: 'That match is not running.' };
        const r = lm.match.submit(userId, args.action as MatchAction, now());
        if (!r.ok) return { ok: false, code: r.code, message: r.message };
        broadcast(lm, r.events);
        schedule(lm);
        return { ok: true, data: {} };
      }
      case 'match.resume': {
        const lm = matches.get(String(args.matchId ?? ''));
        if (!lm || !lm.humans.includes(userId)) return { ok: false, code: 'NO_MATCH', message: 'That match is not available.' };
        const since = Number.isFinite(args.sinceSeq) ? Number(args.sinceSeq) : 0;
        return { ok: true, data: { matchId: lm.match.matchId, events: lm.match.eventsSince(since) } };
      }
      default:
        return { ok: false, code: 'UNKNOWN_OP', message: 'Unknown request.' };
    }
  }

  function friendsOf(userId: string): FriendView[] {
    return user(userId).friends.map((id) => {
      const f = user(id);
      return { userId: id, displayName: f.profile.displayName, friendCode: f.profile.friendCode, online: byUser.has(id), rating: f.profile.rankedRating };
    });
  }

  // ------------------------------------------------------------ sockets

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (options.allowedOrigins?.length && origin && !options.allowedOrigins.includes(origin)) {
      ws.close(4003, 'Origin not allowed');
      return;
    }
    const id = randomBytes(8).toString('hex');
    const conn: Conn = { ws, userId: null, bucket: new Bucket(12, 40), ip: req.socket.remoteAddress ?? 'unknown', rttMs: null, pingSentAt: null };
    conns.set(id, conn);
    // Connection quality: protocol-level pings the client cannot fake or answer early.
    const measure = () => {
      if (ws.readyState !== ws.OPEN) return;
      conn.pingSentAt = Date.now();
      ws.ping();
    };
    ws.on('pong', () => {
      if (conn.pingSentAt === null) return;
      const sample = Date.now() - conn.pingSentAt;
      conn.pingSentAt = null;
      conn.rttMs = conn.rttMs === null ? sample : Math.round(conn.rttMs * 0.7 + sample * 0.3);
      if (conn.userId) queue.setRtt(conn.userId, conn.rttMs);
    });
    measure();
    const pinger = setInterval(measure, 5_000);
    ws.on('close', () => clearInterval(pinger));
    ws.on('message', (raw) => {
      if (!conn.bucket.take()) {
        send(conn, { t: 'error', code: 'RATE_LIMITED', message: 'Slow down.' });
        return;
      }
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        send(conn, { t: 'error', code: 'BAD_JSON', message: 'Malformed message.' });
        return;
      }
      if (msg.t === 'ping') return send(conn, { t: 'pong', at: msg.at, serverTime: now() });
      if (msg.t === 'register') return conn.userId ? undefined : register(conn, msg.name);
      if (msg.t === 'auth') return authenticate(conn, msg.token);
      if (msg.t !== 'req' || typeof msg.id !== 'string') return;
      if (!conn.userId) return send(conn, { t: 'res', id: msg.id, ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } });
      let result: ReturnType<typeof handle>;
      try {
        result = handle(conn, conn.userId, String(msg.op), (msg.args ?? {}) as RequestArgs);
      } catch (e) {
        log('error', 'request.failed', { op: msg.op, userId: conn.userId, error: e instanceof Error ? e.message : String(e) });
        result = { ok: false, code: 'SERVER_ERROR', message: 'Something went wrong on the server.' };
      }
      if (result.ok) send(conn, { t: 'res', id: msg.id, ok: true, data: result.data });
      else send(conn, { t: 'res', id: msg.id, ok: false, error: { code: result.code, message: result.message } });
    });
    ws.on('close', () => {
      conns.delete(id);
      if (conn.userId && byUser.get(conn.userId) === conn) {
        byUser.delete(conn.userId);
        onDisconnect(conn.userId);
      }
    });
  });

  // ------------------------------------------------------------ matchmaking loop

  const pump = () => {
    for (const [a, b] of queue.pair(now())) {
      if (!byUser.has(a.userId) || !byUser.has(b.userId)) continue;
      startMatch('RANKED', [a.userId, b.userId]);
    }
    for (const [code, room] of rooms) if (now() - room.createdAt > 30 * 60_000) rooms.delete(code);
  };
  const loop = setInterval(pump, options.matchmakingIntervalMs ?? 1000);

  await new Promise<void>((resolve) => http.listen(options.port ?? 8787, resolve));
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 8787;
  log('info', 'listening', { port, devGems });

  return {
    http,
    port,
    store,
    pump,
    async close() {
      clearInterval(loop);
      for (const lm of matches.values()) {
        if (lm.timer) clearTimeout(lm.timer);
        for (const t of lm.forfeitTimers.values()) clearTimeout(t);
      }
      for (const c of conns.values()) c.ws.terminate();
      store.flush();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

// Run directly: `tsx server/pvp-server.ts`
const isMain = typeof process !== 'undefined' && process.argv[1] && /pvp-server\.ts$/.test(process.argv[1]);
if (isMain) {
  const server = await startPvpServer({
    port: Number(process.env.PORT ?? 8787),
    dataFile: process.env.PVP_DATA_FILE ?? 'server-data/pvp-db.json',
    devGems: process.env.PVP_DEV_GEMS === '1' || process.argv.includes('--dev-gems'),
    allowedOrigins: process.env.PVP_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  });
  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
