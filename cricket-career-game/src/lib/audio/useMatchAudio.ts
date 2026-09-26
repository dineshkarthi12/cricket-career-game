/**
 * Sound for the match screen: each new delivery gets its effects and, when
 * the moment deserves it, a line from the commentator; the crowd murmurs
 * while play is on; the result gets the last word.
 */
import { useEffect, useRef } from 'react';
import { callForBall, callForResult } from './calls';
import { lastSpokenLine, playCall, speak, playSfx, startAmbience, stopAmbience, stopSpeech } from './player';
import type { LiveSnapshot } from '@/engine/match/live';
import type { Ball } from '@/types';

interface Options {
  lastBall: Ball | null;
  snap: LiveSnapshot | null;
  playing: boolean;
  userId: string | null;
  userTeamId: string | null;
  teamName: (id: string) => string;
  /** How long a ball takes at the current pace, ms. */
  ballMs: number;
}

export function useMatchAudio({ lastBall, snap, playing, userId, userTeamId, teamName, ballMs }: Options): void {
  const heard = useRef<string | null>(null);
  const resultSaid = useRef<string | null>(null);

  useEffect(() => {
    if (!lastBall || !snap || heard.current === lastBall.id) return;
    heard.current = lastBall.id;
    // The innings the ball belongs to: the one in progress, or the one it just ended.
    const current = snap.current && snap.current.deliveries.some((d) => d.id === lastBall.id) ? snap.current : null;
    const lines = current ?? snap.completed.at(-1);
    if (!lines) return;
    const call = callForBall(lastBall, lines, userId, lastSpokenLine());
    let seed = 0;
    for (let i = 0; i < lastBall.id.length; i += 1) seed = (seed * 31 + lastBall.id.charCodeAt(i)) >>> 0;
    playCall(call, ballMs, seed);
  }, [lastBall, snap, userId, ballMs]);

  useEffect(() => {
    const result = snap?.result;
    if (!result || snap?.phase !== 'COMPLETE' || resultSaid.current === result.summary) return;
    resultSaid.current = result.summary;
    const call = callForResult(result, userTeamId, teamName);
    // After the last ball's line has had its moment.
    const timer = window.setTimeout(() => {
      playSfx(call.sfx);
      if (call.line) speak(call.line, call.priority, call.mine);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [snap?.result, snap?.phase, userTeamId, teamName]);

  useEffect(() => {
    if (playing) startAmbience();
    else stopAmbience();
  }, [playing]);

  // Leaving the match: quiet.
  useEffect(
    () => () => {
      stopAmbience();
      stopSpeech();
    },
    [],
  );
}
