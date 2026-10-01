/**
 * AI rivals: the players competing with you for a place at each of your
 * sides, with their rating, form, fitness and this season's figures. They
 * develop on their own through the simulated seasons.
 */
import { Badge, Card, CardHeader } from '@/components';
import { rivalGroups, type RivalGroup } from '@/engine/career/rivals';
import { roleLabel } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

export default function RivalsScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Rivals state={state} />;
}

function Rivals({ state }: { state: GameState }) {
  const groups = rivalGroups(state);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Rivals</h1>
        <p className="text-[13px] text-ink-muted">
          The players in your role group at each of your sides. They train, play, age and get injured like you do - out-perform
          them and the selectors notice.
        </p>
      </div>
      {groups.length === 0 ? (
        <Card>
          <p className="text-[13px] text-ink-muted">You are not with a side yet, so there is nobody to compete with. Trials come first.</p>
        </Card>
      ) : (
        groups.map((g) => <GroupCard key={g.teamId} group={g} />)
      )}
    </div>
  );
}

function GroupCard({ group }: { group: RivalGroup }) {
  return (
    <Card>
      <CardHeader
        title={group.teamName}
        subtitle={`You are ${ordinal(group.userRank)} of ${group.rows.length} in your role group by rating`}
        className="mb-3"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <caption className="sr-only">Rivals at {group.teamName}</caption>
          <thead className="text-[11px] tracking-wide text-ink-soft uppercase">
            <tr>
              <th scope="col" className="py-1.5 pr-2">#</th>
              <th scope="col" className="py-1.5 pr-2">Player</th>
              <th scope="col" className="py-1.5 pr-2">Rating</th>
              <th scope="col" className="py-1.5 pr-2">Form</th>
              <th scope="col" className="py-1.5 pr-2">Fitness</th>
              <th scope="col" className="py-1.5 pr-2">M</th>
              <th scope="col" className="py-1.5 pr-2">Runs (avg)</th>
              <th scope="col" className="py-1.5 pr-2">Wkts</th>
              <th scope="col" className="py-1.5">Selectors</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r, i) => (
              <tr key={r.id} className={cn('border-t border-line', r.isUser && 'bg-brand-gold/15 font-semibold')}>
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2">
                  <span className="text-ink">{r.name}</span>
                  {r.isUser ? <Badge tone="gold" className="ml-1.5 text-[10.5px]">You</Badge> : null}
                  {r.direct ? <Badge tone="red" className="ml-1.5 text-[10.5px]">Direct rival</Badge> : null}
                  {r.injured ? <Badge tone="orange" className="ml-1.5 text-[10.5px]">Injured</Badge> : null}
                  <span className="block text-[11.5px] font-normal text-ink-muted">
                    {roleLabel(r.role)} · {r.age}
                  </span>
                </td>
                <td className="py-2 pr-2">{r.overall}</td>
                <td className="py-2 pr-2">{r.form}</td>
                <td className="py-2 pr-2">{r.fitness}</td>
                <td className="py-2 pr-2">{r.matches}</td>
                <td className="py-2 pr-2">
                  {r.runs}
                  {r.battingAverage !== null ? ` (${r.battingAverage})` : ''}
                </td>
                <td className="py-2 pr-2">{r.wickets}</td>
                <td className="py-2">{r.selectorFavour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
