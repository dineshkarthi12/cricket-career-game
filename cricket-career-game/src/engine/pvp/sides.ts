/** Building match sides from profiles - the same code on the server and in the offline demo. */
import { createRng } from '../match/rng';
import { quarantinedInstances, claimStarter, createProfile } from './economy';
import type { SideSetup } from './match';
import { autoPickSquad } from './squad';
import type { PvpProfile } from './types';

/**
 * The side a profile fields: its saved XI if every player in it is owned and
 * valid, otherwise an automatic pick. Quarantined (invalid) cards never play.
 */
export function sideFromProfile(profile: PvpProfile, isBot: boolean): SideSetup | null {
  const bad = quarantinedInstances(profile);
  const usable = profile.inventory.filter((o) => !bad.has(o.instanceId));
  const squad = profile.squad && profile.squad.xi.every((id) => usable.some((o) => o.instanceId === id)) ? profile.squad : autoPickSquad(usable);
  if (!squad) return null;
  const byId = new Map(usable.map((o) => [o.instanceId, o]));
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    isBot,
    xi: squad.xi.map((id) => ({ instanceId: id, cardId: byId.get(id)!.cardId, upgrades: byId.get(id)!.upgrades })),
    captainInstanceId: squad.captain,
  };
}

/** An AI opponent with a free-tier XI. */
export function botSide(seed: number, now: string, name = 'AI Practice XI'): SideSetup {
  const r = claimStarter(createProfile({ userId: `bot-${seed}`, displayName: name, friendCode: 'BOT000', now }), { requestId: `starter-bot-${seed}` }, { now, rng: createRng(seed) });
  if (!r.ok) throw new Error('bot squad');
  return sideFromProfile(r.profile, true)!;
}
