import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader } from '@/components';
import { EntryLayout } from './entry/EntryLayout';
import { useGameStore } from '@/store/gameStore';
import { DEFAULT_START_DATE, ageOn } from '@/engine/newCareer';
import { battingStyleLabel, bowlingStyleLabel, formatLongDate, roleLabel } from '@/lib/format';
import { CAREER_STAGES } from '@/data/stages';
import { cn } from '@/lib/cn';
import {
  SAVE_SLOT_IDS,
  type BattingStyle,
  type BowlingStyle,
  type PlayerRole,
  type SaveSlotId,
} from '@/types';

const ROLES: PlayerRole[] = [
  'BATTER',
  'OPENING_BATTER',
  'WICKET_KEEPER_BATTER',
  'BATTING_ALLROUNDER',
  'BOWLING_ALLROUNDER',
  'PACE_BOWLER',
  'SPIN_BOWLER',
];

const BATTING_STYLES: BattingStyle[] = ['RIGHT_HAND_BAT', 'LEFT_HAND_BAT'];

const BOWLING_STYLES: BowlingStyle[] = [
  'RIGHT_ARM_FAST',
  'RIGHT_ARM_FAST_MEDIUM',
  'RIGHT_ARM_MEDIUM',
  'LEFT_ARM_FAST',
  'LEFT_ARM_FAST_MEDIUM',
  'LEFT_ARM_MEDIUM',
  'OFF_SPIN',
  'LEG_SPIN',
  'LEFT_ARM_ORTHODOX',
  'LEFT_ARM_WRIST_SPIN',
  'NONE',
];

/** The youngest and oldest a career may begin at (stage 1 is an 8-12 beginner). */
const MIN_AGE = 8;
const MAX_AGE = 16;

interface FormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  hometown: string;
  state: string;
  country: string;
  role: PlayerRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  shirtNumber: string;
  motto: string;
}

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  dateOfBirth: '2014-04-12',
  hometown: 'Chennai',
  state: 'Tamil Nadu',
  country: 'India',
  role: 'BATTER',
  battingStyle: 'RIGHT_HAND_BAT',
  bowlingStyle: 'RIGHT_ARM_MEDIUM',
  shirtNumber: '18',
  motto: 'A better version of myself, every single day.',
};

/** Player creation. The career it builds starts at stage 1 with nothing won. */
export default function NewCareer() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slots = useGameStore((s) => s.slots);
  const startNewCareer = useGameStore((s) => s.startNewCareer);
  const refreshSlots = useGameStore((s) => s.refreshSlots);
  const lastError = useGameStore((s) => s.lastError);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const requestedSlot = Number(params.get('slot'));
  const fromUrl = SAVE_SLOT_IDS.includes(requestedSlot as SaveSlotId)
    ? (requestedSlot as SaveSlotId)
    : null;

  // Only pin a slot once the player picks one; until then follow the first
  // empty slot, which is not known until the slot headers have loaded.
  const [picked, setPicked] = useState<SaveSlotId | null>(fromUrl);
  const firstEmpty = SAVE_SLOT_IDS.find((id) => !slots[id - 1]) ?? 1;
  const slot = picked ?? firstEmpty;
  const setSlot = setPicked;

  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const age = useMemo(
    () => (form.dateOfBirth ? ageOn(form.dateOfBirth, DEFAULT_START_DATE) : null),
    [form.dateOfBirth],
  );

  const errors = useMemo(() => {
    const found: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) found.firstName = 'Your player needs a first name.';
    if (!form.dateOfBirth) {
      found.dateOfBirth = 'Pick a date of birth.';
    } else if (age === null || Number.isNaN(age)) {
      found.dateOfBirth = 'That date of birth is not valid.';
    } else if (age < MIN_AGE || age > MAX_AGE) {
      found.dateOfBirth = `A career starts between ${MIN_AGE} and ${MAX_AGE} years old — that is ${age}.`;
    }
    const shirt = Number(form.shirtNumber);
    if (!Number.isInteger(shirt) || shirt < 1 || shirt > 99) {
      found.shirtNumber = 'Pick a number from 1 to 99.';
    }
    return found;
  }, [form, age]);

  const occupied = slots[slot - 1];
  const firstStage = CAREER_STAGES[0];

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    const created = startNewCareer(slot, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dateOfBirth: form.dateOfBirth,
      hometown: form.hometown.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
      role: form.role,
      battingStyle: form.battingStyle,
      bowlingStyle: form.bowlingStyle,
      motto: form.motto.trim() || undefined,
      shirtNumber: Number(form.shirtNumber),
    });
    if (created) navigate('/');
  };

  const showError = (key: keyof FormState) => (submitted ? errors[key] : undefined);

  return (
    <EntryLayout
      title="Create your cricketer"
      subtitle={`Everyone starts at ${firstStage.name}. From here on, every squad, every promotion and every contract has to be earned.`}
      back={{ label: 'Back to your careers', to: '/slots' }}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {lastError ? (
          <p role="alert" className="rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3 text-[13.5px] text-ink">
            {lastError.message}
          </p>
        ) : null}

        <Card>
          <CardHeader title="Save slot" className="mb-3" />
          <div className="flex flex-wrap gap-2">
            {SAVE_SLOT_IDS.map((id) => {
              const meta = slots[id - 1];
              const active = id === slot;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSlot(id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-xl border px-4 py-2.5 text-left transition-colors',
                    active
                      ? 'border-brand-blue bg-brand-blue-soft'
                      : 'border-line bg-surface hover:bg-page',
                  )}
                >
                  <span
                    className={cn(
                      'block text-[13px] font-semibold',
                      active ? 'text-brand-blue' : 'text-ink',
                    )}
                  >
                    Slot {id}
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    {meta ? meta.playerName : 'Empty'}
                  </span>
                </button>
              );
            })}
          </div>
          {occupied ? (
            <p className="mt-3 rounded-tile bg-brand-orange/12 px-3 py-2 text-[12.5px] text-ink">
              Slot {slot} holds {occupied.playerName}&apos;s career. Starting here overwrites it.
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Who are you?" className="mb-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" error={showError('firstName')} htmlFor="firstName">
              <input
                id="firstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                placeholder="Dinesh"
                className={inputClass(Boolean(showError('firstName')))}
              />
            </Field>
            <Field label="Last name" hint="Optional" htmlFor="lastName">
              <input
                id="lastName"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={inputClass(false)}
              />
            </Field>
            <Field
              label="Date of birth"
              error={showError('dateOfBirth')}
              hint={
                age !== null && !Number.isNaN(age)
                  ? `Age ${age} on ${formatLongDate(DEFAULT_START_DATE)}`
                  : undefined
              }
              htmlFor="dateOfBirth"
            >
              <input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set('dateOfBirth', e.target.value)}
                className={inputClass(Boolean(showError('dateOfBirth')))}
              />
            </Field>
            <Field label="Shirt number" error={showError('shirtNumber')} htmlFor="shirtNumber">
              <input
                id="shirtNumber"
                type="number"
                min={1}
                max={99}
                value={form.shirtNumber}
                onChange={(e) => set('shirtNumber', e.target.value)}
                className={inputClass(Boolean(showError('shirtNumber')))}
              />
            </Field>
            <Field label="Hometown" htmlFor="hometown">
              <input
                id="hometown"
                value={form.hometown}
                onChange={(e) => set('hometown', e.target.value)}
                className={inputClass(false)}
              />
            </Field>
            <Field label="State" htmlFor="state">
              <input
                id="state"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                className={inputClass(false)}
              />
            </Field>
            <Field label="Country" htmlFor="country">
              <input
                id="country"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                className={inputClass(false)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="How do you play?" className="mb-3" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Role" htmlFor="role">
              <select
                id="role"
                value={form.role}
                onChange={(e) => set('role', e.target.value as PlayerRole)}
                className={inputClass(false)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Batting style" htmlFor="battingStyle">
              <select
                id="battingStyle"
                value={form.battingStyle}
                onChange={(e) => set('battingStyle', e.target.value as BattingStyle)}
                className={inputClass(false)}
              >
                {BATTING_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {battingStyleLabel(style)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bowling style" htmlFor="bowlingStyle">
              <select
                id="bowlingStyle"
                value={form.bowlingStyle}
                onChange={(e) => set('bowlingStyle', e.target.value as BowlingStyle)}
                className={inputClass(false)}
              >
                {BOWLING_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {bowlingStyleLabel(style)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Your motto" hint="Shown on the hero banner" htmlFor="motto" className="mt-3">
            <input
              id="motto"
              value={form.motto}
              onChange={(e) => set('motto', e.target.value)}
              className={inputClass(false)}
            />
          </Field>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-muted">
            Starting at <span className="font-semibold text-ink">{firstStage.name}</span> on{' '}
            {formatLongDate(DEFAULT_START_DATE)}. No squad, no record, no reputation.
          </p>
          <button
            type="submit"
            className="rounded-xl bg-brand-blue px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90"
          >
            Start career
          </button>
        </div>
      </form>
    </EntryLayout>
  );
}

function inputClass(invalid: boolean): string {
  return cn(
    'h-10 w-full rounded-xl border bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2',
    invalid
      ? 'border-brand-red/50 focus:border-brand-red focus:ring-brand-red/15'
      : 'border-line focus:border-brand-blue/50 focus:ring-brand-blue/15',
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-[12.5px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11.5px] font-medium text-brand-red">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11.5px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
