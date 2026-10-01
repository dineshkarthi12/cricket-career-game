/**
 * Changing the player's role mid-career. A deliberate decision, never
 * automatic: skills do not jump - a batter who takes up bowling starts from
 * whatever bowling they have - and the role rules (engine/roles.ts) apply from
 * the next match. Bowling drills that the new role cannot run leave the plan.
 */
import { DRILLS_BY_ID } from '@/data/drills';
import { computeOverall } from '../ratings';
import { playerRoleFor, type CreationRole } from '../development/creation';
import { drillAllowed } from '../development/training';
import { canUserControlBowling, ROLE_CATEGORY_LABEL, roleCategory } from '../roles';
import type { BowlingStyle, GameState, InboxMessage } from '@/types';

export interface RoleChangeResult {
  ok: boolean;
  state: GameState;
  error?: string;
}

/** The creation role a saved player corresponds to. */
export function creationRoleOf(state: GameState): CreationRole {
  switch (roleCategory(state.player.role)) {
    case 'PURE_BATTER':
      return 'BATTER';
    case 'WICKETKEEPER':
      return 'WICKETKEEPER';
    case 'ALL_ROUNDER':
      return 'ALLROUNDER';
    case 'BOWLER':
      return 'BOWLER';
  }
}

export function changePlayerRole(state: GameState, role: CreationRole, bowlingStyle: BowlingStyle): RoleChangeResult {
  const bowls = role === 'BOWLER' || role === 'ALLROUNDER';
  if (bowls && bowlingStyle === 'NONE') return { ok: false, state, error: 'A role that bowls needs a bowling type.' };
  if (state.activeMatchId) return { ok: false, state, error: 'Finish the match in progress first.' };
  const style: BowlingStyle = bowls ? bowlingStyle : 'NONE';
  const approach = state.player.development?.battingApproach ?? 'STROKE_MAKER';
  const nextRole = playerRoleFor(role, style, approach);
  if (nextRole === state.player.role && style === state.player.bowlingStyle) return { ok: true, state };

  const player = {
    ...state.player,
    role: nextRole,
    bowlingStyle: style,
    overall: computeOverall(state.player.attributes, nextRole),
    potentialOverall: computeOverall(state.player.potential, nextRole),
  };
  // Sessions the new role cannot run come out of the plan.
  const sessions = state.trainingPlan.sessions.filter((s) => {
    const drill = DRILLS_BY_ID[s.drill];
    return !drill || drillAllowed(drill, player);
  });
  const label = ROLE_CATEGORY_LABEL[roleCategory(nextRole)];
  const message: InboxMessage = {
    id: `inbox-role-${state.season.currentDate}-${nextRole}`,
    date: state.season.currentDate,
    sender: 'COACH',
    senderName: 'Coach',
    subject: `Role changed: ${label}`,
    body: canUserControlBowling(player)
      ? `You are now listed as ${label.toLowerCase()}. The captain may give you overs from the next match; your bowling skills start where they are.`
      : `You are now listed as ${label.toLowerCase()}. You will not bowl in matches, and bowling drills are off your plan.`,
    category: 'TRAINING',
    read: false,
    important: false,
    actions: [],
    relatedId: null,
  };
  return {
    ok: true,
    state: {
      ...state,
      player,
      trainingPlan: { ...state.trainingPlan, sessions },
      inbox: [message, ...state.inbox],
    },
  };
}
