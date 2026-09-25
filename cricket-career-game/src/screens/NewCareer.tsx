import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Shuffle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, Stepper, type StepItem } from '@/components';
import { EntryLayout } from './entry/EntryLayout';
import { AggressionBar } from './match/controls/AggressionBar';
import { useGameStore } from '@/store/gameStore';
import { DEFAULT_START_DATE, createNewCareer, type NewCareerOptions } from '@/engine/newCareer';
import { randomTraits, type CreationRole } from '@/engine/development';
import { createRng } from '@/engine/match/rng';
import { STATES, TAMIL_NADU_DISTRICTS, stateOfTown } from '@/data/places';
import { TRAITS, TRAITS_BY_ID, validTraitSet } from '@/data/traits';
import { CAREER_STAGES } from '@/data/stages';
import { bowlingStyleLabel, formatLongDate, roleLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  SAVE_SLOT_IDS,
  type BattingApproach,
  type BattingStyle,
  type BowlingStyle,
  type PersonalityTrait,
  type SaveSlotId,
} from '@/types';

const ROLES: { id: CreationRole; label: string; help: string }[] = [
  { id: 'BATTER', label: 'Batter', help: 'Runs are your job. Top or middle order.' },
  { id: 'BOWLER', label: 'Bowler', help: 'Wickets are your job. Pace or spin.' },
  { id: 'ALLROUNDER', label: 'All-rounder', help: 'Bat and bowl. Twice the work, twice the ways in.' },
  { id: 'WICKETKEEPER', label: 'Wicketkeeper', help: 'Gloves first, and runs in the middle order.' },
];

const APPROACHES: { id: BattingApproach; label: string; help: string }[] = [
  { id: 'ANCHOR', label: 'Anchor', help: 'Bats time, holds an innings together.' },
  { id: 'STROKE_MAKER', label: 'Stroke-maker', help: 'Timing and a full range of shots.' },
  { id: 'FINISHER', label: 'Finisher', help: 'Power at the end of an innings.' },
];

const BOWLING_TYPES: BowlingStyle[] = [
  'RIGHT_ARM_FAST',
  'LEFT_ARM_FAST',
  'RIGHT_ARM_MEDIUM',
  'LEFT_ARM_MEDIUM',
  'OFF_SPIN',
  'LEG_SPIN',
  'LEFT_ARM_ORTHODOX',
  'LEFT_ARM_WRIST_SPIN',
  'NONE',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STEPS = ['Who you are', 'How you play', 'Personality', 'Review'];

/** The age range a career may start in (stage 1 is an 8-12 beginner). */
export const MIN_AGE = 8;
export const MAX_AGE = 12;

interface FormState {
  firstName: string;
  lastName: string;
  age: number;
  birthMonth: number;
  birthDay: number;
  hometown: string;
  shirtNumber: string;
  motto: string;
  role: CreationRole;
  battingStyle: BattingStyle;
  approach: BattingApproach;
  bowlingStyle: BowlingStyle;
  preferredAggression: number;
  traits: PersonalityTrait[];
}

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  age: 10,
  birthMonth: 4,
  birthDay: 12,
  hometown: 'Chennai',
  shirtNumber: '18',
  motto: 'A better version of myself, every single day.',
  role: 'BATTER',
  battingStyle: 'RIGHT_HAND_BAT',
  approach: 'STROKE_MAKER',
  bowlingStyle: 'RIGHT_ARM_MEDIUM',
  preferredAggression: 3,
  traits: ['HARD_WORKER', 'BIG_MATCH_TEMPERAMENT'],
};

/** A date of birth that makes the player exactly `age` on the start date. */
export function dateOfBirthFor(age: number, month: number, day: number, start = DEFAULT_START_DATE): string {
  const startYear = Number(start.slice(0, 4));
  const startMonthDay = start.slice(5);
  const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const year = monthDay <= startMonthDay ? startYear - age : startYear - age - 1;
  return `${year}-${monthDay}`;
}

function daysInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Player creation: a four-step wizard. The career starts at stage 1 with nothing won. */
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
  const fromUrl = SAVE_SLOT_IDS.includes(requestedSlot as SaveSlotId) ? (requestedSlot as SaveSlotId) : null;
  const [picked, setPicked] = useState<SaveSlotId | null>(fromUrl);
  const firstEmpty = SAVE_SLOT_IDS.find((id) => !slots[id - 1]) ?? 1;
  const slot = picked ?? firstEmpty;

  const [form, setForm] = useState<FormState>(INITIAL);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  // One seed for the whole wizard, so the preview is the career you get.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const errors = useMemo(() => {
    const found: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) found.firstName = 'Your player needs a first name.';
    if (form.age < MIN_AGE || form.age > MAX_AGE) found.age = `A career starts between ${MIN_AGE} and ${MAX_AGE}.`;
    const shirt = Number(form.shirtNumber);
    if (!Number.isInteger(shirt) || shirt < 1 || shirt > 99) found.shirtNumber = 'Pick a number from 1 to 99.';
    if (form.role === 'BOWLER' && form.bowlingStyle === 'NONE') found.bowlingStyle = 'A bowler needs a bowling type.';
    if (!validTraitSet(form.traits)) found.traits = 'Pick two or three traits that go together.';
    return found;
  }, [form]);

  const stepFields: (keyof FormState)[][] = [
    ['firstName', 'age', 'shirtNumber'],
    ['bowlingStyle'],
    ['traits'],
    [],
  ];
  const stepValid = (i: number) => stepFields[i].every((key) => !errors[key]);

  const options: NewCareerOptions = useMemo(
    () => ({
      firstName: form.firstName.trim() || 'Player',
      lastName: form.lastName.trim(),
      dateOfBirth: dateOfBirthFor(form.age, form.birthMonth, form.birthDay),
      hometown: form.hometown,
      state: stateOfTown(form.hometown).name,
      country: 'India',
      creationRole: form.role,
      battingStyle: form.battingStyle,
      bowlingStyle: form.bowlingStyle,
      battingApproach: form.approach,
      traits: form.traits,
      preferredAggression: form.preferredAggression,
      motto: form.motto.trim() || undefined,
      shirtNumber: Number(form.shirtNumber) || 18,
      seed,
    }),
    [form, seed],
  );

  // Only build the preview on the review step: it is a whole career.
  const preview = useMemo(() => (step === 3 && Object.keys(errors).length === 0 ? createNewCareer(options) : null), [step, errors, options]);

  const next = () => {
    setTried((t) => ({ ...t, [step]: true }));
    if (stepValid(step)) setStep((s) => Math.min(3, s + 1));
  };

  const onStart = () => {
    setTried({ 0: true, 1: true, 2: true, 3: true });
    if (Object.keys(errors).length > 0) {
      const firstBad = [0, 1, 2].find((i) => !stepValid(i));
      if (firstBad !== undefined) setStep(firstBad);
      return;
    }
    if (startNewCareer(slot, options)) navigate('/');
  };

  const showError = (key: keyof FormState, i: number) => (tried[i] ? errors[key] : undefined);
  const occupied = slots[slot - 1];
  const firstStage = CAREER_STAGES[0];

  const steps: StepItem[] = STEPS.map((label, i) => ({
    id: label,
    index: i + 1,
    label,
    status: i < step ? 'done' : i === step ? 'current' : 'locked',
  }));

  return (
    <EntryLayout
      title="Create your cricketer"
      subtitle={`Everyone starts at ${firstStage.name}, aged 8 to 12. From here on, every squad, every promotion and every contract has to be earned.`}
      back={{ label: 'Back', to: '/start' }}
    >
      <Card className="mb-4">
        <Stepper steps={steps} />
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) next();
          else onStart();
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        {lastError ? (
          <p role="alert" className="rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3 text-[13.5px] text-ink">
            {lastError.message}
          </p>
        ) : null}

        {step === 0 ? (
          <Card>
            <CardHeader title="Who are you?" className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" error={showError('firstName', 0)} htmlFor="firstName">
                <input id="firstName" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Dinesh" className={inputClass(Boolean(showError('firstName', 0)))} />
              </Field>
              <Field label="Last name" hint="Optional" htmlFor="lastName">
                <input id="lastName" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputClass(false)} />
              </Field>
              <Field label="Age" error={showError('age', 0)} hint={`On ${formatLongDate(DEFAULT_START_DATE)}`} htmlFor="age">
                <select id="age" value={form.age} onChange={(e) => set('age', Number(e.target.value))} className={inputClass(false)}>
                  {[8, 9, 10, 11, 12].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Birthday" htmlFor="birthMonth">
                <div className="flex gap-2">
                  <select id="birthMonth" aria-label="Birth month" value={form.birthMonth} onChange={(e) => set('birthMonth', Number(e.target.value))} className={inputClass(false)}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Birth day" value={Math.min(form.birthDay, daysInMonth(form.birthMonth))} onChange={(e) => set('birthDay', Number(e.target.value))} className={inputClass(false)}>
                    {Array.from({ length: daysInMonth(form.birthMonth) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Hometown" hint={`${stateOfTown(form.hometown).name}`} htmlFor="hometown">
                <select id="hometown" value={form.hometown} onChange={(e) => set('hometown', e.target.value)} className={inputClass(false)}>
                  <optgroup label="Tamil Nadu">
                    {TAMIL_NADU_DISTRICTS.map((town) => (
                      <option key={town} value={town}>
                        {town}
                      </option>
                    ))}
                  </optgroup>
                  {STATES.filter((s) => s.name !== 'Tamil Nadu').map((s) => (
                    <optgroup key={s.name} label={s.name}>
                      {s.towns.map((town) => (
                        <option key={town} value={town}>
                          {town}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Jersey number" error={showError('shirtNumber', 0)} htmlFor="shirtNumber">
                <input id="shirtNumber" type="number" min={1} max={99} value={form.shirtNumber} onChange={(e) => set('shirtNumber', e.target.value)} className={inputClass(Boolean(showError('shirtNumber', 0)))} />
              </Field>
            </div>
            <Field label="Your motto" hint="Shown on the hero banner" htmlFor="motto" className="mt-3">
              <input id="motto" value={form.motto} onChange={(e) => set('motto', e.target.value)} className={inputClass(false)} />
            </Field>
          </Card>
        ) : null}

        {step === 1 ? (
          <>
            <Card>
              <CardHeader title="Role" className="mb-3" />
              <ChoiceGrid
                name="Role"
                options={ROLES}
                value={form.role}
                onChange={(role) => {
                  set('role', role);
                  if (role === 'BOWLER' && form.bowlingStyle === 'NONE') set('bowlingStyle', 'RIGHT_ARM_FAST');
                  if (role === 'WICKETKEEPER') set('bowlingStyle', 'NONE');
                }}
              />
            </Card>
            <Card>
              <CardHeader title="Batting" className="mb-3" />
              <div className="mb-3 flex gap-2" role="radiogroup" aria-label="Batting hand">
                {(['RIGHT_HAND_BAT', 'LEFT_HAND_BAT'] as BattingStyle[]).map((hand) => (
                  <Pill key={hand} active={form.battingStyle === hand} onClick={() => set('battingStyle', hand)}>
                    {hand === 'RIGHT_HAND_BAT' ? 'Right-handed' : 'Left-handed'}
                  </Pill>
                ))}
              </div>
              <ChoiceGrid name="Batting style" options={APPROACHES} value={form.approach} onChange={(a) => set('approach', a)} columns={3} />
            </Card>
            <Card>
              <CardHeader title="Bowling type" className="mb-3" />
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bowling type">
                {BOWLING_TYPES.map((style) => (
                  <Pill
                    key={style}
                    active={form.bowlingStyle === style}
                    disabled={style === 'NONE' && form.role === 'BOWLER'}
                    onClick={() => set('bowlingStyle', style)}
                  >
                    {style === 'NONE' ? "Doesn't bowl" : bowlingStyleLabel(style)}
                  </Pill>
                ))}
              </div>
              {showError('bowlingStyle', 1) ? <p className="mt-2 text-[11.5px] font-medium text-brand-red">{errors.bowlingStyle}</p> : null}
            </Card>
            <Card>
              <CardHeader title="Preferred aggression" subtitle="Where you are comfortable at the crease. Playing far from it costs a little until you train there." className="mb-3" />
              <AggressionBar label="Batting" kind="batting" level={form.preferredAggression} onChange={(l) => set('preferredAggression', l ?? 3)} />
            </Card>
          </>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader
              title="Personality"
              subtitle="Pick two or three. They shape how you train, handle pressure, stay fit and lead."
              className="mb-3"
            />
            <button
              type="button"
              onClick={() => set('traits', randomTraits(createRng(Math.floor(Math.random() * 1e9))))}
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-page"
            >
              <Shuffle className="size-3.5" aria-hidden />
              Surprise me
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRAITS.map((trait) => {
                const on = form.traits.includes(trait.id);
                const blocked =
                  !on && (form.traits.length >= 3 || form.traits.some((t) => TRAITS_BY_ID[t].excludes.includes(trait.id)));
                return (
                  <button
                    key={trait.id}
                    type="button"
                    aria-pressed={on}
                    disabled={blocked}
                    onClick={() => set('traits', on ? form.traits.filter((t) => t !== trait.id) : [...form.traits, trait.id])}
                    className={cn(
                      'rounded-tile border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                      on ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page',
                    )}
                  >
                    <span className={cn('block text-[13px] font-semibold', on ? 'text-brand-blue' : 'text-ink')}>{trait.label}</span>
                    <span className="block text-[11.5px] text-ink-muted">{trait.description}</span>
                  </button>
                );
              })}
            </div>
            {showError('traits', 2) ? <p className="mt-2 text-[11.5px] font-medium text-brand-red">{errors.traits}</p> : null}
          </Card>
        ) : null}

        {step === 3 ? (
          <>
            {preview ? <PreviewCard options={options} state={preview} /> : null}
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
                      onClick={() => setPicked(id)}
                      aria-pressed={active}
                      className={cn('rounded-xl border px-4 py-2.5 text-left transition-colors', active ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                    >
                      <span className={cn('block text-[13px] font-semibold', active ? 'text-brand-blue' : 'text-ink')}>Slot {id}</span>
                      <span className="block text-[11.5px] text-ink-muted">{meta ? meta.playerName : 'Empty'}</span>
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
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink disabled:opacity-40"
          >
            Back
          </button>
          {step < 3 ? (
            <button type="submit" className="rounded-xl bg-brand-blue px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-blue/90">
              Next
            </button>
          ) : (
            <button type="submit" className="rounded-xl bg-brand-blue px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-blue/90">
              Start career
            </button>
          )}
        </div>
      </form>
    </EntryLayout>
  );
}

/** What the coaches see on day one. The hidden potential is never shown. */
function PreviewCard({ options, state }: { options: NewCareerOptions; state: ReturnType<typeof createNewCareer> }) {
  const { player } = state;
  const groups: { key: keyof typeof player.attributes; label: string }[] = [
    { key: 'batting', label: 'Batting' },
    { key: 'bowling', label: 'Bowling' },
    { key: 'fielding', label: 'Fielding' },
    { key: 'physical', label: 'Physical' },
    { key: 'mental', label: 'Mental' },
  ];
  const mean = (group: object) => {
    const values = Object.values(group) as number[];
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };
  return (
    <Card>
      <CardHeader title={`${options.firstName} ${options.lastName}`.trim()} subtitle={`${roleLabel(player.role)} · age ${player.age} · ${player.hometown}, ${player.state}`} className="mb-3" />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-1">
          <span className="grid size-16 place-items-center rounded-full bg-brand-green text-[24px] font-bold text-white ring-4 ring-brand-green/25">{player.overall}</span>
          <span className="text-[12px] text-ink-muted">Starting OVR</span>
        </div>
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
            const value = mean(player.attributes[g.key]);
            return (
              <li key={g.key} className="flex items-center gap-3">
                <span className="w-[70px] text-[12.5px] text-ink-muted">{g.label}</span>
                <ProgressBar value={value} height={7} className="flex-1" label={`${g.label} ${value}`} />
                <span className="w-7 text-right text-[12.5px] font-semibold text-ink">{value}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {player.development.traits.map((t) => (
          <Badge key={t} tone="blue">
            {TRAITS_BY_ID[t].label}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] font-medium text-ink">What the academy coach says</p>
      <ul className="mt-1 list-disc pl-5 text-[12.5px] text-ink-muted">
        {player.development.coachHints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-soft">
        Starts {formatLongDate(DEFAULT_START_DATE)} at {CAREER_STAGES[0].name}. No squad, no record, no reputation.
      </p>
    </Card>
  );
}

function ChoiceGrid<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = 4,
}: {
  name: string;
  options: { id: T; label: string; help: string }[];
  value: T;
  onChange: (id: T) => void;
  columns?: 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn('grid gap-2', columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={cn('rounded-tile border px-3 py-2.5 text-left transition-colors', active ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
          >
            <span className={cn('block text-[13.5px] font-semibold', active ? 'text-brand-blue' : 'text-ink')}>{option.label}</span>
            <span className="block text-[11.5px] text-ink-muted">{option.help}</span>
          </button>
        );
      })}
    </div>
  );
}

function Pill({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-brand-blue bg-brand-blue text-white' : 'border-line bg-surface text-ink hover:bg-page',
      )}
    >
      {children}
    </button>
  );
}

function inputClass(invalid: boolean): string {
  return cn(
    'h-10 w-full rounded-xl border bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2',
    invalid ? 'border-brand-red/50 focus:border-brand-red focus:ring-brand-red/15' : 'border-line focus:border-brand-blue/50 focus:ring-brand-blue/15',
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
      {error ? <p className="mt-1 text-[11.5px] font-medium text-brand-red">{error}</p> : hint ? <p className="mt-1 text-[11.5px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}
