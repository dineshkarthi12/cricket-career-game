import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Shuffle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, Stepper, type StepItem } from '@/components';
import { EntryLayout } from './entry/EntryLayout';
import { AggressionBar } from './match/controls/AggressionBar';
import { useGameStore } from '@/store/gameStore';
import { DEFAULT_START_DATE, createNewCareer, type NewCareerOptions } from '@/engine/newCareer';
import { REAL_PLAYERS } from '@/engine/config';
import { loadRealSeason } from '@/data/real';
import { realSeasonFor } from '@/engine/world/realPlayers';
import { randomTraits, type CreationRole } from '@/engine/development';
import { createRng } from '@/engine/match/rng';
import { STATES, TAMIL_NADU_DISTRICTS, stateOfTown } from '@/data/places';
import { TRAITS, TRAITS_BY_ID, validTraitSet } from '@/data/traits';
import { traitDescription, traitLabel } from '@/lib/training';
import { tr, type Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
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

const ROLES: CreationRole[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'];

const APPROACHES: BattingApproach[] = ['ANCHOR', 'STROKE_MAKER', 'FINISHER'];

/** Choices with a label and a line of help, from `misc.new.<prefix>.<id>` keys. */
const choices = <T extends string>(prefix: string, ids: T[]) =>
  ids.map((id) => ({ id, label: tr(`misc.new.${prefix}.${id}` as Key), help: tr(`misc.new.${prefix}.${id}.help` as Key) }));

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

/** Roles that bowl in matches (see engine/roles.ts). */
const bowlingRole = (role: CreationRole) => role === 'BOWLER' || role === 'ALLROUNDER';

const STEPS = [0, 1, 2, 3];

/** The age range a career may start in (stage 1 is an 8-12 beginner). */
export const MIN_AGE = 8;
export const MAX_AGE = 12;

/** The first day of the season a career starts in. */
export function seasonStartDate(year: number): string {
  return `${year}-06-01`;
}

/** Birth years a career can have: from the 1980s (among the stars of the 2000s) to today's beginners. */
export const MIN_BIRTH_YEAR = 1980;

/** The season in which a player born on that day is `age` on its first day (1 June). */
export function careerStartYear(birthYear: number, month: number, day: number, age: number): number {
  const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return birthYear + age + (monthDay <= '06-01' ? 0 : 1);
}

interface FormState {
  /** Year of birth: an earlier one starts the career in the past, among that time's real cricketers. */
  birthYear: string;
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
  birthYear: String(Number(DEFAULT_START_DATE.slice(0, 4)) - 10),
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
  bowlingStyle: 'NONE',
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

/** Which real cricketers a career starting in `startYear` plays among. */
function eraHint(startYear: number, realSeason: number): string {
  const latest = REAL_PLAYERS.seasons.latest;
  if (!Number.isFinite(startYear) || startYear >= latest) return tr('misc.new.era.today');
  if (realSeason > startYear) return tr('misc.new.era.earliest', { start: startYear, real: realSeason, latest });
  return tr('misc.new.era.past', { start: startYear, latest });
}

function daysInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Player creation: a four-step wizard. The career starts at stage 1 with nothing won. */
export default function NewCareer() {
  const navigate = useNavigate();
  const t = useT();
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

  const birthYear = Number(form.birthYear);
  const latest = REAL_PLAYERS.seasons.latest;
  const startYear = careerStartYear(birthYear, form.birthMonth, form.birthDay, form.age);
  // The real players the career begins with: that season's, or the earliest data before it.
  const realStart = startYear < latest ? startYear : undefined;
  const realSeason = realSeasonFor(realStart, startYear);

  const errors = useMemo(() => {
    const found: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) found.firstName = t('misc.new.err.firstName');
    if (!Number.isInteger(birthYear) || birthYear < MIN_BIRTH_YEAR || birthYear > latest - MIN_AGE) {
      found.birthYear = t('misc.new.err.birthYear', { from: MIN_BIRTH_YEAR, to: latest - MIN_AGE });
    } else if (startYear > latest) {
      found.birthYear = t('misc.new.err.tooLate', { age: form.age, year: startYear });
    }
    if (form.age < MIN_AGE || form.age > MAX_AGE) found.age = t('misc.new.err.age', { min: MIN_AGE, max: MAX_AGE });
    const shirt = Number(form.shirtNumber);
    if (!Number.isInteger(shirt) || shirt < 1 || shirt > 99) found.shirtNumber = t('misc.new.err.shirt');
    if (form.role === 'BOWLER' && form.bowlingStyle === 'NONE') found.bowlingStyle = t('misc.new.err.bowler');
    if (form.role === 'ALLROUNDER' && form.bowlingStyle === 'NONE') found.bowlingStyle = t('misc.new.err.allrounder');
    if (!bowlingRole(form.role) && form.bowlingStyle !== 'NONE') found.bowlingStyle = t('misc.new.err.noBowl');
    if (!validTraitSet(form.traits)) found.traits = t('misc.new.err.traits');
    return found;
  }, [form, birthYear, startYear, latest, t]);

  const stepFields: (keyof FormState)[][] = [
    ['firstName', 'birthYear', 'age', 'shirtNumber'],
    ['bowlingStyle'],
    ['traits'],
    [],
  ];
  const stepValid = (i: number) => stepFields[i].every((key) => !errors[key]);

  const options: NewCareerOptions = useMemo(
    () => ({
      firstName: form.firstName.trim() || 'Player',
      lastName: form.lastName.trim(),
      dateOfBirth: `${birthYear}-${String(form.birthMonth).padStart(2, '0')}-${String(Math.min(form.birthDay, daysInMonth(form.birthMonth))).padStart(2, '0')}`,
      startDate: seasonStartDate(startYear),
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
    [form, seed, birthYear, startYear],
  );

  // Only build the preview on the review step: it is a whole career.
  const preview = useMemo(() => (step === 3 && Object.keys(errors).length === 0 ? createNewCareer(options) : null), [step, errors, options]);

  // That season's players, ready for the preview and the start.
  useEffect(() => {
    void loadRealSeason(realSeason);
  }, [realSeason]);

  const next = () => {
    setTried((t) => ({ ...t, [step]: true }));
    if (stepValid(step)) setStep((s) => Math.min(3, s + 1));
  };

  const onStart = async () => {
    setTried({ 0: true, 1: true, 2: true, 3: true });
    if (Object.keys(errors).length > 0) {
      const firstBad = [0, 1, 2].find((i) => !stepValid(i));
      if (firstBad !== undefined) setStep(firstBad);
      return;
    }
    // The squads are built from that season's players: have them first.
    await loadRealSeason(realSeason);
    if (startNewCareer(slot, options)) navigate('/');
  };

  const showError = (key: keyof FormState, i: number) => (tried[i] ? errors[key] : undefined);
  const occupied = slots[slot - 1];
  const firstStage = CAREER_STAGES[0];

  const steps: StepItem[] = STEPS.map((i) => ({
    id: String(i),
    index: i + 1,
    label: t(`misc.new.step.${i}` as Key),
    status: i < step ? 'done' : i === step ? 'current' : 'locked',
  }));

  return (
    <EntryLayout
      title={t('misc.new.title')}
      subtitle={t('misc.new.subtitle', { stage: t(`stage.${firstStage.id}` as Key) })}
      back={{ label: t('misc.new.back'), to: '/start' }}
    >
      <Card className="mb-4">
        <Stepper steps={steps} />
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) next();
          else void onStart();
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
            <CardHeader title={t('misc.new.who')} className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('misc.new.firstName')} error={showError('firstName', 0)} htmlFor="firstName">
                <input id="firstName" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Dinesh" className={inputClass(Boolean(showError('firstName', 0)))} />
              </Field>
              <Field label={t('misc.new.lastName')} hint={t('misc.new.optional')} htmlFor="lastName">
                <input id="lastName" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputClass(false)} />
              </Field>
              <Field label={t('misc.new.birthYear')} error={showError('birthYear', 0)} hint={eraHint(startYear, realSeason)} htmlFor="birthYear">
                <input
                  id="birthYear"
                  type="number"
                  inputMode="numeric"
                  min={MIN_BIRTH_YEAR}
                  max={latest - MIN_AGE}
                  value={form.birthYear}
                  onChange={(e) => set('birthYear', e.target.value)}
                  className={inputClass(Boolean(showError('birthYear', 0)))}
                />
              </Field>
              <Field label={t('misc.new.age')} error={showError('age', 0)} hint={errors.birthYear ? undefined : t('misc.new.on', { date: formatLongDate(seasonStartDate(startYear)) })} htmlFor="age">
                <select id="age" value={form.age} onChange={(e) => set('age', Number(e.target.value))} className={inputClass(false)}>
                  {[8, 9, 10, 11, 12].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('misc.new.birthday')} htmlFor="birthMonth">
                <div className="flex gap-2">
                  <select id="birthMonth" aria-label={t('misc.new.birthMonth')} value={form.birthMonth} onChange={(e) => set('birthMonth', Number(e.target.value))} className={inputClass(false)}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {t(`date.mon.${i}` as Key)}
                      </option>
                    ))}
                  </select>
                  <select aria-label={t('misc.new.birthDay')} value={Math.min(form.birthDay, daysInMonth(form.birthMonth))} onChange={(e) => set('birthDay', Number(e.target.value))} className={inputClass(false)}>
                    {Array.from({ length: daysInMonth(form.birthMonth) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label={t('misc.new.hometown')} hint={`${stateOfTown(form.hometown).name}`} htmlFor="hometown">
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
              <Field label={t('misc.new.jersey')} error={showError('shirtNumber', 0)} htmlFor="shirtNumber">
                <input id="shirtNumber" type="number" min={1} max={99} value={form.shirtNumber} onChange={(e) => set('shirtNumber', e.target.value)} className={inputClass(Boolean(showError('shirtNumber', 0)))} />
              </Field>
            </div>
            <Field label={t('misc.new.motto')} hint={t('misc.new.mottoHint')} htmlFor="motto" className="mt-3">
              <input id="motto" value={form.motto} onChange={(e) => set('motto', e.target.value)} className={inputClass(false)} />
            </Field>
          </Card>
        ) : null}

        {step === 1 ? (
          <>
            <Card>
              <CardHeader title={t('misc.new.role')} className="mb-3" />
              <ChoiceGrid
                name={t('misc.new.role')}
                options={choices('role', ROLES)}
                value={form.role}
                onChange={(role) => {
                  set('role', role);
                  if (bowlingRole(role) && form.bowlingStyle === 'NONE') set('bowlingStyle', role === 'BOWLER' ? 'RIGHT_ARM_FAST' : 'RIGHT_ARM_MEDIUM');
                  // A Pure Batter and a keeper never bowl: the bowling type goes with the role.
                  if (!bowlingRole(role)) set('bowlingStyle', 'NONE');
                }}
              />
            </Card>
            <Card>
              <CardHeader title={t('misc.new.batting')} className="mb-3" />
              <div className="mb-3 flex gap-2" role="radiogroup" aria-label={t('misc.new.hand')}>
                {(['RIGHT_HAND_BAT', 'LEFT_HAND_BAT'] as BattingStyle[]).map((hand) => (
                  <Pill key={hand} active={form.battingStyle === hand} onClick={() => set('battingStyle', hand)}>
                    {hand === 'RIGHT_HAND_BAT' ? t('misc.new.right') : t('misc.new.left')}
                  </Pill>
                ))}
              </div>
              <ChoiceGrid name={t('misc.new.battingStyle')} options={choices('app', APPROACHES)} value={form.approach} onChange={(a) => set('approach', a)} columns={3} />
            </Card>
            <Card>
              <CardHeader title={t('misc.new.bowlingType')} className="mb-3" />
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('misc.new.bowlingType')}>
                {BOWLING_TYPES.map((style) => (
                  <Pill
                    key={style}
                    active={form.bowlingStyle === style}
                    disabled={style === 'NONE' ? bowlingRole(form.role) : !bowlingRole(form.role)}
                    onClick={() => set('bowlingStyle', style)}
                  >
                    {style === 'NONE' ? (form.role === 'BATTER' ? t('misc.new.noneBatter') : t('misc.new.noBowl')) : bowlingStyleLabel(style)}
                  </Pill>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-ink-muted" role="note">
                {bowlingRole(form.role)
                  ? t('misc.new.bowlNote')
                  : t('misc.new.noBowlNote')}
              </p>
              {showError('bowlingStyle', 1) ? <p className="mt-2 text-[11.5px] font-medium text-brand-red">{errors.bowlingStyle}</p> : null}
            </Card>
            <Card>
              <CardHeader title={t('misc.new.aggression')} subtitle={t('misc.new.aggressionHint')} className="mb-3" />
              <AggressionBar label={t('misc.new.batting')} kind="batting" level={form.preferredAggression} onChange={(l) => set('preferredAggression', l ?? 3)} />
            </Card>
          </>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader
              title={t('misc.new.personality')}
              subtitle={t('misc.new.personalityHint')}
              className="mb-3"
            />
            <button
              type="button"
              onClick={() => set('traits', randomTraits(createRng(Math.floor(Math.random() * 1e9))))}
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-page"
            >
              <Shuffle className="size-3.5" aria-hidden />
              {t('misc.new.surprise')}
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
                    <span className={cn('block text-[13px] font-semibold', on ? 'text-brand-blue' : 'text-ink')}>{traitLabel(trait.id)}</span>
                    <span className="block text-[11.5px] text-ink-muted">{traitDescription(trait.id)}</span>
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
              <CardHeader title={t('misc.new.slot')} className="mb-3" />
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
                      <span className={cn('block text-[13px] font-semibold', active ? 'text-brand-blue' : 'text-ink')}>{t('common.slot', { n: id })}</span>
                      <span className="block text-[11.5px] text-ink-muted">{meta ? meta.playerName : t('common.empty')}</span>
                    </button>
                  );
                })}
              </div>
              {occupied ? (
                <p className="mt-3 rounded-tile bg-brand-orange/12 px-3 py-2 text-[12.5px] text-ink">
                  {t('misc.new.overwrite', { n: slot, name: occupied.playerName })}
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
            {t('misc.new.back')}
          </button>
          {step < 3 ? (
            <button type="submit" className="rounded-xl bg-brand-blue px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-blue/90">
              {t('misc.new.next')}
            </button>
          ) : (
            <button type="submit" className="rounded-xl bg-brand-blue px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-blue/90">
              {t('misc.new.start')}
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
  const t = useT();
  const groups: { key: keyof typeof player.attributes; label: string }[] = (['batting', 'bowling', 'fielding', 'physical', 'mental'] as const).map((key) => ({
    key,
    label: t(`misc.new.grp.${key}`),
  }));
  const mean = (group: object) => {
    const values = Object.values(group) as number[];
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };
  return (
    <Card>
      <CardHeader title={`${options.firstName} ${options.lastName}`.trim()} subtitle={t('misc.new.previewLine', { role: roleLabel(player.role), age: player.age, town: player.hometown, state: player.state })} className="mb-3" />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-1">
          <span className="grid size-16 place-items-center rounded-full bg-brand-green text-[24px] font-bold text-white ring-4 ring-brand-green/25">{player.overall}</span>
          <span className="text-[12px] text-ink-muted">{t('misc.new.startingOvr')}</span>
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
        {player.development.traits.map((trait) => (
          <Badge key={trait} tone="blue">
            {traitLabel(trait)}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] font-medium text-ink">{t('misc.new.coachSays')}</p>
      <ul className="mt-1 list-disc pl-5 text-[12.5px] text-ink-muted">
        {player.development.coachHints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-soft">
        {t('misc.new.startsOn', { date: formatLongDate(options.startDate ?? DEFAULT_START_DATE), stage: t(`stage.${CAREER_STAGES[0].id}` as Key) })}
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
