import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, Tabs } from '@/components';
import { climateNote, pendingMatch } from '@/engine/calendar';
import { addDays, weekdayOf } from '@/engine/development';
import { CATEGORY_OF, CATEGORY_STYLE, WINDOW_STYLE, styleForKind, type EventCategory } from '@/lib/calendar';
import { formatDayMonth, formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { CalendarWindow, CalendarWindowKind, Fixture, GameState } from '@/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Which window colours a day when several overlap. */
const WINDOW_PRIORITY: CalendarWindowKind[] = ['EXAMS', 'ICC_EVENT', 'IPL', 'TOURNAMENT', 'INTERNATIONAL', 'HOLIDAYS', 'CLUB_SEASON', 'SCHOOL_TERM'];

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function CalendarScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <SeasonCalendar state={state} />;
}

function SeasonCalendar({ state }: { state: GameState }) {
  const today = state.season.currentDate;
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [selected, setSelected] = useState<string>(today);
  const [hidden, setHidden] = useState<EventCategory[]>([]);
  const [showPast, setShowPast] = useState(false);

  const events = useMemo(
    () =>
      Object.values(state.fixtures)
        .filter((f) => f.involvesUser && !hidden.includes(CATEGORY_OF[f.kind]))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.fixtures, hidden],
  );
  const pending = pendingMatch(state);

  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const m = month + delta;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });

  const climate = climateNote(state.calendar.region, cursor.month);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] leading-tight font-bold text-ink">Calendar</h1>
          <p className="text-[13px] text-ink-muted">
            {state.season.label} season · today is {formatLongDate(today)}. Only what your stage plays is on here.
          </p>
        </div>
        <Tabs
          label="Calendar view"
          tabs={[
            { id: 'month', label: 'Month' },
            { id: 'list', label: 'List' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <Card>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show event types">
          {(Object.keys(CATEGORY_STYLE) as EventCategory[]).map((category) => {
            const on = !hidden.includes(category);
            const style = CATEGORY_STYLE[category];
            return (
              <button
                key={category}
                type="button"
                aria-pressed={on}
                onClick={() => setHidden((h) => (on ? [...h, category] : h.filter((c) => c !== category)))}
                className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium', on ? style.chip : 'bg-page text-ink-soft line-through')}
              >
                <span className={cn('size-2 rounded-full', style.bar)} aria-hidden />
                {style.label}
              </button>
            );
          })}
        </div>
      </Card>

      {view === 'month' ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg hover:bg-page">
                <ChevronLeft className="size-4" />
              </button>
              <div className="text-center">
                <h2 className="text-[16px] font-semibold text-ink">
                  {MONTHS[cursor.month - 1]} {cursor.year}
                </h2>
                <p className="text-[11.5px] text-ink-muted" title={climate.detail}>
                  {climate.label} - {climate.detail}
                </p>
              </div>
              <button type="button" onClick={() => move(1)} aria-label="Next month" className="grid size-8 place-items-center rounded-lg hover:bg-page">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <MonthGrid
              year={cursor.year}
              month={cursor.month}
              today={today}
              selected={selected}
              onSelect={setSelected}
              events={events}
              windows={state.calendar.windows}
            />
            <WindowLegend windows={state.calendar.windows} year={cursor.year} month={cursor.month} />
          </Card>
          <DayPanel date={selected} events={events.filter((f) => f.date <= selected && f.endDate >= selected)} state={state} pendingId={pending?.id ?? null} windows={state.calendar.windows} />
        </div>
      ) : (
        <ListView events={events} today={today} showPast={showPast} onTogglePast={() => setShowPast((v) => !v)} pendingId={pending?.id ?? null} />
      )}
    </div>
  );
}

function windowOn(windows: CalendarWindow[], date: string): CalendarWindow | null {
  const covering = windows.filter((w) => w.start <= date && w.end >= date);
  covering.sort((a, b) => WINDOW_PRIORITY.indexOf(a.kind) - WINDOW_PRIORITY.indexOf(b.kind));
  return covering[0] ?? null;
}

function MonthGrid({
  year,
  month,
  today,
  selected,
  onSelect,
  events,
  windows,
}: {
  year: number;
  month: number;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  events: Fixture[];
  windows: CalendarWindow[];
}) {
  const first = iso(year, month, 1);
  const lead = (weekdayOf(first) + 6) % 7; // Monday first
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(year, month, i + 1))];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div role="grid" aria-label={`${MONTHS[month - 1]} ${year}`}>
      <div className="grid grid-cols-7 gap-1 pb-1" role="row">
        {WEEKDAYS.map((d) => (
          <span key={d} role="columnheader" className="text-center text-[11px] font-semibold text-ink-soft uppercase">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} className="min-h-[64px]" aria-hidden />;
          const on = events.filter((f) => f.date <= date && f.endDate >= date);
          const band = windowOn(windows, date);
          const isToday = date === today;
          const past = date < today;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              aria-selected={date === selected}
              aria-label={`${formatLongDate(date)}${on.length ? `: ${on.map((f) => f.title).join(', ')}` : ''}`}
              onClick={() => onSelect(date)}
              className={cn(
                'flex min-h-[64px] flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left transition-colors sm:min-h-[78px]',
                band ? WINDOW_STYLE[band.kind].band : 'bg-surface',
                date === selected ? 'border-brand-blue' : 'border-line/60 hover:border-brand-blue/40',
                past && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full text-[11px] font-semibold',
                  isToday ? 'bg-brand-blue text-white' : 'text-ink',
                )}
              >
                {Number(date.slice(8, 10))}
              </span>
              {/* Phones: a dot per event. Wider screens: the event itself. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                {on.map((f) => (
                  <span key={f.id} className={cn('size-1.5 rounded-full', styleForKind(f.kind).bar)} />
                ))}
              </span>
              {on.slice(0, 2).map((f) => (
                <span key={f.id} className={cn('hidden truncate rounded px-1 text-[10px] leading-[1.5] font-medium sm:block', styleForKind(f.kind).chip)}>
                  {shortTitle(f)}
                </span>
              ))}
              {on.length > 2 ? <span className="hidden text-[9.5px] text-ink-soft sm:block">+{on.length - 2} more</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shortTitle(f: Fixture): string {
  if (f.kind === 'MATCH') return f.title.replace(/ vs /, ' v ');
  return f.title;
}

function WindowLegend({ windows, year, month }: { windows: CalendarWindow[]; year: number; month: number }) {
  const start = iso(year, month, 1);
  const end = addDays(iso(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1), -1);
  const inMonth = windows.filter((w) => w.start <= end && w.end >= start);
  if (inMonth.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {inMonth.map((w) => (
        <li key={w.id} className={cn('rounded-lg px-2 py-1 text-[11px] text-ink', WINDOW_STYLE[w.kind].band)}>
          <span className="font-semibold">{w.title}</span> · {formatDayMonth(w.start)} - {formatDayMonth(w.end)}
        </li>
      ))}
    </ul>
  );
}

function EventLine({ f, pendingId }: { f: Fixture; pendingId: string | null }) {
  const style = styleForKind(f.kind);
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span className={cn('h-8 w-[3px] shrink-0 rounded-full', style.bar)} aria-hidden />
      <span className="w-[52px] shrink-0 text-[11.5px] font-semibold text-ink">{formatDayMonth(f.date)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{f.title}</span>
        <span className="block truncate text-[11px] text-ink-soft">
          {[f.subtitle, f.endDate !== f.date ? `to ${formatDayMonth(f.endDate)}` : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0">
        {f.kind === 'MATCH' && f.matchId ? (
          <Link to={`/matches/${f.matchId}`} className="text-[12px] font-semibold text-brand-blue">
            Scorecard
          </Link>
        ) : f.id === pendingId ? (
          <Link to={`/match/${f.id}`} className="rounded-lg bg-brand-blue px-2.5 py-1 text-[12px] font-semibold text-white">
            Play
          </Link>
        ) : f.played ? (
          <Badge tone="grey">Done</Badge>
        ) : (
          <Badge tone="grey">{style.label}</Badge>
        )}
      </span>
    </li>
  );
}

function DayPanel({
  date,
  events,
  state,
  pendingId,
  windows,
}: {
  date: string;
  events: Fixture[];
  state: GameState;
  pendingId: string | null;
  windows: CalendarWindow[];
}) {
  const band = windowOn(windows, date);
  const climate = climateNote(state.calendar.region, Number(date.slice(5, 7)));
  return (
    <Card>
      <CardHeader title={formatLongDate(date)} subtitle={band ? band.title : 'No competition window'} className="mb-1" />
      {events.length === 0 ? (
        <p className="py-3 text-[13px] text-ink-muted">
          {date < state.season.currentDate ? 'A training day.' : 'Nothing scheduled - a training day.'}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {events.map((f) => (
            <EventLine key={f.id} f={f} pendingId={pendingId} />
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-ink-muted">
        Weather: <span className="font-medium text-ink">{climate.label}</span>. {climate.detail}
      </p>
    </Card>
  );
}

function ListView({
  events,
  today,
  showPast,
  onTogglePast,
  pendingId,
}: {
  events: Fixture[];
  today: string;
  showPast: boolean;
  onTogglePast: () => void;
  pendingId: string | null;
}) {
  const shown = events.filter((f) => showPast || f.endDate >= today);
  const byMonth = new Map<string, Fixture[]>();
  for (const f of shown) {
    const key = f.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), f]);
  }
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{showPast ? 'The whole season' : 'Coming up'}</h2>
        <button type="button" onClick={onTogglePast} className="text-[12.5px] font-semibold text-brand-blue">
          {showPast ? 'Hide past events' : 'Show past events'}
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-[13px] text-ink-muted">Nothing on the calendar.</p>
      ) : (
        [...byMonth.entries()].map(([key, list]) => (
          <section key={key} className="mb-2">
            <h3 className="mt-2 text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              {MONTHS[Number(key.slice(5, 7)) - 1]} {key.slice(0, 4)}
            </h3>
            <ul className="divide-y divide-line">
              {list.map((f) => (
                <EventLine key={f.id} f={f} pendingId={pendingId} />
              ))}
            </ul>
          </section>
        ))
      )}
    </Card>
  );
}
