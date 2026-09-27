/**
 * Sound for the match screen: each new delivery gets its effects, the
 * crowd murmurs while play is on, and the result gets a last cheer.
 */
import { useEffect, useRef } from 'react';
import { sfxForBall, sfxForResult } from './calls';
import { playSfx, startAmbience, stopAmbience } from './player';
import type { LiveSnapshot } from '@/engine/match/live';
import type { Ball } from '@/types';

interface Options {
  lastBall: Ball | null;
  snap: LiveSnapshot | null;
  playing: boolean;
  userId: string | null;
  userTeamId: string | null;
}

export function useMatchAudio({ lastBall, snap, playing, userId, userTeamId }: Options): void {
  const heard = useRef<string | null>(null);
  const resultHeard = useRef<string | null>(null);

  useEffect(() => {
    if (!lastBall || !snap || heard.current === lastBall.id) return;
    heard.current = lastBall.id;
    // The innings the ball belongs to: the one in progress, or the one it just ended.
    const current = snap.current && snap.current.deliveries.some((d) => d.id === lastBall.id) ? snap.current : null;
    const lines = current ?? snap.completed.at(-1);
    if (lines) playSfx(sfxForBall(lastBall, lines, userId));
  }, [lastBall, snap, userId]);

  useEffect(() => {
    const result = snap?.result;
    if (!result || snap?.phase !== 'COMPLETE' || resultHeard.current === result.summary) return;
    resultHeard.current = result.summary;
    const timer = window.setTimeout(() => playSfx(sfxForResult(result, userTeamId)), 1200);
    return () => window.clearTimeout(timer);
  }, [snap?.result, snap?.phase, userTeamId]);

  useEffect(() => {
    if (playing) startAmbience();
    else stopAmbience();
  }, [playing]);

  // Leaving the match: quiet.
  useEffect(() => () => stopAmbience(), []);
}
