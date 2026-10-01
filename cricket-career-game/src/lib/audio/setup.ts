/**
 * Wires sound to the app: audio unlocks on the first tap (browsers insist),
 * the device settings flow into the player, and buttons tick when that is
 * switched on.
 */
import { useAppSettings } from '@/store/appSettings';
import { playClick, setAudioPrefs, unlockAudio } from './player';

export function setupAudio(): void {
  if (typeof window === 'undefined') return;
  const apply = () => {
    const s = useAppSettings.getState();
    setAudioPrefs({ effects: s.soundEffects, ambience: s.crowdAmbience, volume: s.volume });
  };
  apply();
  useAppSettings.subscribe(apply);
  const unlock = () => unlockAudio();
  // Phones unlock audio on a finger lifting or a click, not a finger landing.
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, unlock, { passive: true });
  }
  window.addEventListener('click', (event) => {
    if (!useAppSettings.getState().buttonClicks) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a[href], [role="tab"], [role="radio"]')) playClick();
  });
}
