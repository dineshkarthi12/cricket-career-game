/**
 * Match sound, made in the browser: every effect is synthesised with the
 * Web Audio API (no sound files to load or license), and the commentator
 * speaks through the browser's own text-to-speech. Browsers only start
 * audio after a tap, so the context is created on the first gesture.
 * Everything here fails quietly - a game without sound is still a game.
 */
import type { BallCall, Sfx } from './calls';

export interface AudioPrefs {
  effects: boolean;
  voice: boolean;
  ambience: boolean;
  /** 0-1. */
  volume: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let prefs: AudioPrefs = { effects: true, voice: true, ambience: true, volume: 0.8 };
let lastLine: string | null = null;
let speakingPriority = -1;

export function setAudioPrefs(next: AudioPrefs): void {
  prefs = next;
  if (master) master.gain.value = next.volume;
  if (!next.ambience || !next.effects || next.volume === 0) stopAmbience();
  if (!next.voice) stopSpeech();
}

/** The last commentary line spoken, so the next one can differ. */
export function lastSpokenLine(): string | null {
  return lastLine;
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = prefs.volume;
    master.connect(ctx.destination);
    // Two seconds of white noise: the raw material for bat, stumps and crowd.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap or click: browsers keep audio locked until then. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

function noise(c: AudioContext, loop = false): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = loop;
  return src;
}

/** A shaped burst of filtered noise. */
function burst(c: AudioContext, at: number, opts: { type: BiquadFilterType; freq: number; q?: number; attack: number; hold?: number; release: number; gain: number; sweepTo?: number }): void {
  const src = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.setValueAtTime(opts.freq, at);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, at + opts.attack + (opts.hold ?? 0) + opts.release);
  filter.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(opts.gain, at + opts.attack);
  g.gain.setValueAtTime(opts.gain, at + opts.attack + (opts.hold ?? 0));
  g.gain.exponentialRampToValueAtTime(0.0001, at + opts.attack + (opts.hold ?? 0) + opts.release);
  src.connect(filter).connect(g).connect(master!);
  src.start(at, Math.random());
  src.stop(at + opts.attack + (opts.hold ?? 0) + opts.release + 0.05);
}

function tone(c: AudioContext, at: number, type: OscillatorType, from: number, to: number, dur: number, gain: number): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

const EFFECTS: Record<Sfx, (c: AudioContext, t: number) => void> = {
  // Willow on leather: a sharp woody crack.
  BAT: (c, t) => {
    burst(c, t, { type: 'bandpass', freq: 2200, q: 3, attack: 0.002, release: 0.07, gain: 0.9 });
    tone(c, t, 'triangle', 1100, 600, 0.06, 0.35);
  },
  BAT_BIG: (c, t) => {
    burst(c, t, { type: 'bandpass', freq: 1800, q: 2.5, attack: 0.002, release: 0.12, gain: 1 });
    tone(c, t, 'triangle', 950, 420, 0.1, 0.5);
  },
  // The crowd lifts for a boundary...
  CHEER: (c, t) => burst(c, t + 0.15, { type: 'bandpass', freq: 900, q: 0.7, attack: 0.35, hold: 0.5, release: 1.2, gain: 0.35 }),
  // ...and goes up for a six or a wicket.
  ROAR: (c, t) => {
    burst(c, t + 0.1, { type: 'bandpass', freq: 800, q: 0.6, attack: 0.25, hold: 1.1, release: 1.6, gain: 0.55 });
    burst(c, t + 0.2, { type: 'highpass', freq: 2500, attack: 0.3, hold: 0.9, release: 1.2, gain: 0.12 });
  },
  // Stumps rattled: a woody knock and the bails flying.
  STUMPS: (c, t) => {
    tone(c, t, 'triangle', 240, 140, 0.18, 0.7);
    burst(c, t, { type: 'bandpass', freq: 3200, q: 4, attack: 0.001, release: 0.09, gain: 0.8 });
    burst(c, t + 0.09, { type: 'bandpass', freq: 4200, q: 6, attack: 0.001, release: 0.05, gain: 0.45 });
    burst(c, t + 0.16, { type: 'bandpass', freq: 3800, q: 6, attack: 0.001, release: 0.04, gain: 0.3 });
  },
  // "Howzat!": a rising shout from the fielders.
  APPEAL: (c, t) => burst(c, t, { type: 'bandpass', freq: 500, q: 1.2, attack: 0.08, hold: 0.25, release: 0.4, gain: 0.5, sweepTo: 1300 }),
  // The crowd's "ooh" when it goes wrong.
  GROAN: (c, t) => burst(c, t + 0.05, { type: 'bandpass', freq: 700, q: 1.5, attack: 0.2, hold: 0.3, release: 0.9, gain: 0.4, sweepTo: 260 }),
  // Applause: a few hundred hand-claps.
  APPLAUSE: (c, t) => {
    for (let i = 0; i < 160; i += 1) {
      burst(c, t + Math.random() * 3.2, { type: 'bandpass', freq: 1400 + Math.random() * 1800, q: 1.2, attack: 0.002, release: 0.03 + Math.random() * 0.03, gain: 0.05 + Math.random() * 0.06 });
    }
  },
  LIGHT_CLAP: (c, t) => {
    for (let i = 0; i < 40; i += 1) {
      burst(c, t + Math.random() * 1.4, { type: 'bandpass', freq: 1600 + Math.random() * 1500, q: 1.2, attack: 0.002, release: 0.03, gain: 0.04 + Math.random() * 0.04 });
    }
  },
};

export function playSfx(list: Sfx[]): void {
  if (!prefs.effects || prefs.volume === 0) return;
  const c = audio();
  if (!c || !master || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  for (const s of list) {
    try {
      EFFECTS[s](c, t);
    } catch {
      // One missing effect never stops the match.
    }
  }
}

/** A short tick for buttons. */
export function playClick(): void {
  if (!prefs.effects || prefs.volume === 0) return;
  const c = audio();
  if (!c || !master || c.state !== 'running') return;
  tone(c, c.currentTime, 'sine', 1500, 900, 0.03, 0.12);
}

/** The murmur of a crowd, looped quietly under a match. */
export function startAmbience(): void {
  if (ambience || !prefs.effects || !prefs.ambience || prefs.volume === 0) return;
  const c = audio();
  if (!c || !master || c.state !== 'running') return;
  const source = noise(c, true);
  const low = c.createBiquadFilter();
  low.type = 'bandpass';
  low.frequency.value = 600;
  low.Q.value = 0.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 1.5);
  source.connect(low).connect(gain).connect(master);
  source.start();
  ambience = { source, gain };
}

export function stopAmbience(): void {
  if (!ambience || !ctx) return;
  const { source, gain } = ambience;
  ambience = null;
  try {
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    source.stop(ctx.currentTime + 0.7);
  } catch {
    // Already stopped.
  }
}

// --- The commentator ----------------------------------------------------------------------

let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return null;
  // An Indian English voice if the device has one, then British, then any English.
  voice = voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
  return voice;
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function stopSpeech(): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Nothing to stop.
  }
  speakingPriority = -1;
}

export type SpeakMode = 'polite' | 'interrupt' | 'queue';

/** Something is being said (or waiting to be). */
export function isSpeaking(): boolean {
  return speechAvailable() && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
}

/**
 * Say a line. `polite` (highlights): a bigger moment interrupts a smaller
 * one and a smaller one is dropped while something bigger is being said,
 * so the voice never falls behind. `interrupt`: the next ball cuts in (the
 * player tapped ahead). `queue`: follows what is being said.
 */
export function speak(text: string, priority: number, excited = false, mode: SpeakMode = 'polite'): void {
  if (!prefs.voice || prefs.volume === 0 || !speechAvailable()) return;
  const synth = window.speechSynthesis;
  if (mode === 'interrupt') {
    if (synth.speaking || synth.pending) synth.cancel();
  } else if (mode === 'polite' && synth.speaking) {
    if (priority < speakingPriority || (priority === speakingPriority && priority < 2)) return;
    synth.cancel();
  }
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-IN';
    u.volume = prefs.volume;
    u.rate = priority >= 3 || excited ? 1.12 : 1.04;
    u.pitch = priority >= 3 ? 1.15 : excited ? 1.08 : 1;
    u.onend = () => {
      if (!synth.pending) speakingPriority = -1;
    };
    speakingPriority = Math.max(mode === 'queue' ? speakingPriority : -1, priority);
    lastLine = text;
    synth.speak(u);
  } catch {
    speakingPriority = -1;
  }
}

/**
 * Play a delivery: its effects always; its commentary when the moment is big
 * enough for the pace of play (at speed only boundaries, wickets and
 * milestones get a word; routine singles and dots only now and then).
 */
export function playCall(call: BallCall, ballMs: number, seed: number): void {
  playSfx(call.sfx);
  if (!call.line) return;
  const fast = ballMs < 900;
  const speakIt = call.priority >= 2 || (!fast && call.priority === 1) || (!fast && call.priority === 0 && seed % 3 === 0);
  if (speakIt) speak(call.line, call.priority, call.mine);
}

/** Full commentary: every line for the ball, the first cutting in, the rest in turn. */
export function playFull(sfx: BallCall['sfx'], lines: { text: string; priority: number; queue: boolean; excited: boolean }[]): void {
  playSfx(sfx);
  lines.forEach((l, i) => speak(l.text, l.priority, l.excited, i === 0 && !l.queue ? 'interrupt' : 'queue'));
}
