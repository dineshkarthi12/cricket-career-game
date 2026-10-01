/**
 * Change the player's role. A confirmed, explicit decision: the role rules in
 * `engine/roles.ts` apply from the next match, and skills do not jump.
 */
import { useState } from 'react';
import { Card, CardHeader, ConfirmDialog } from '@/components';
import { changePlayerRole, creationRoleOf } from '@/engine/career/roleChange';
import type { CreationRole } from '@/engine/development';
import { roleMatchNote } from '@/engine/roles';
import { bowlingStyleLabel } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import type { BowlingStyle } from '@/types';

const ROLES: { id: CreationRole; label: string }[] = [
  { id: 'BATTER', label: 'Pure Batter' },
  { id: 'BOWLER', label: 'Bowler' },
  { id: 'ALLROUNDER', label: 'All-rounder' },
  { id: 'WICKETKEEPER', label: 'Wicketkeeper' },
];

const STYLES: BowlingStyle[] = ['RIGHT_ARM_FAST', 'RIGHT_ARM_FAST_MEDIUM', 'RIGHT_ARM_MEDIUM', 'LEFT_ARM_FAST', 'LEFT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'];

export function RoleCard() {
  const state = useGameStore((s) => s.state);
  const update = useGameStore((s) => s.update);
  const [role, setRole] = useState<CreationRole | null>(null);
  const [style, setStyle] = useState<BowlingStyle | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state || state.player.retired) return null;

  const currentRole = creationRoleOf(state);
  const chosenRole = role ?? currentRole;
  const bowls = chosenRole === 'BOWLER' || chosenRole === 'ALLROUNDER';
  const chosenStyle: BowlingStyle = bowls ? (style ?? (state.player.bowlingStyle !== 'NONE' ? state.player.bowlingStyle : 'RIGHT_ARM_MEDIUM')) : 'NONE';
  const changed = chosenRole !== currentRole || chosenStyle !== (bowls ? state.player.bowlingStyle : 'NONE');

  const apply = () => {
    const result = changePlayerRole(state, chosenRole, chosenStyle);
    if (!result.ok) {
      setError(result.error ?? 'That change is not possible.');
      return;
    }
    update(() => result.state);
    setRole(null);
    setStyle(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader title="Playing role" subtitle={roleMatchNote(state.player)} className="mb-2" />
      <label className="mb-2 block text-[12.5px] font-semibold text-ink">
        Role
        <select
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[13px]"
          value={chosenRole}
          onChange={(e) => setRole(e.target.value as CreationRole)}
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </label>
      <label className="mb-2 block text-[12.5px] font-semibold text-ink">
        Bowling type
        <select
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-[13px] disabled:opacity-50"
          value={chosenStyle}
          disabled={!bowls}
          onChange={(e) => setStyle(e.target.value as BowlingStyle)}
        >
          {!bowls ? <option value="NONE">None ({chosenRole === 'BATTER' ? 'Pure Batter' : 'keeper'})</option> : null}
          {bowls ? STYLES.map((s) => <option key={s} value={s}>{bowlingStyleLabel(s)}</option>) : null}
        </select>
      </label>
      {error ? <p role="alert" className="mb-2 text-[12px] font-medium text-brand-red">{error}</p> : null}
      <button
        type="button"
        disabled={!changed}
        onClick={() => setConfirm(true)}
        className="min-h-11 rounded-lg bg-brand-blue px-4 text-[13px] font-semibold text-white disabled:opacity-40"
      >
        Change role
      </button>
      <ConfirmDialog
        open={confirm}
        title="Change your playing role?"
        message={`From the next match you play as ${ROLES.find((r) => r.id === chosenRole)?.label}. Your skills stay where they are; training and the overs you get follow the new role.`}
        confirmLabel="Change role"
        onConfirm={() => {
          setConfirm(false);
          apply();
        }}
        onCancel={() => setConfirm(false)}
      />
    </Card>
  );
}
