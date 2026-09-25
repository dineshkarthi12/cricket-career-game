/**
 * A full scorecard for one innings: batting, extras, total, fall of wickets and
 * bowling. Used live, at the innings break, after the match and on the Matches
 * screen, so it takes a plain `Innings` and nothing else.
 */
import { ballsToOvers } from '@/lib/format';
import type { BatterInningsLine, BowlerInningsLine, Innings } from '@/types';

export function Scorecard({
  innings,
  battingTeam,
  bowlingTeam,
  /** Highlight the user's own line. */
  userPlayerId,
  strikerId,
}: {
  innings: Innings;
  battingTeam: string;
  bowlingTeam: string;
  userPlayerId?: string | null;
  strikerId?: string | null;
}) {
  const batting = [...innings.batting].sort((a, b) => a.battingPosition - b.battingPosition);
  const yetToBat = 11 - batting.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <header className="flex items-baseline justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold text-ink">{battingTeam} batting</h3>
          <p className="text-[13.5px] font-bold text-ink">
            {innings.runs}
            {innings.allOut ? '' : `/${innings.wickets}`}
            <span className="ml-1.5 font-normal text-ink-soft">({ballsToOvers(innings.balls)})</span>
            {innings.declared ? <span className="ml-1 text-ink-soft">d</span> : null}
          </p>
        </header>

        <table className="mt-2 w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] tracking-wide text-ink-soft uppercase">
              <th className="pb-1 font-semibold">Batter</th>
              <th className="pb-1 text-right font-semibold">R</th>
              <th className="pb-1 text-right font-semibold">B</th>
              <th className="pb-1 text-right font-semibold">4s</th>
              <th className="pb-1 text-right font-semibold">6s</th>
              <th className="pb-1 text-right font-semibold">SR</th>
            </tr>
          </thead>
          <tbody>
            {batting.map((line) => (
              <BattingRow
                key={line.playerId}
                line={line}
                isUser={line.playerId === userPlayerId}
                onStrike={line.playerId === strikerId}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td className="pt-1.5 text-ink-muted">Extras</td>
              <td className="pt-1.5 text-right font-semibold text-ink">{innings.extrasTotal}</td>
              <td colSpan={4} className="pt-1.5 pl-2 text-[11.5px] text-ink-soft">
                {extrasText(innings)}
              </td>
            </tr>
            <tr>
              <td className="pt-1 font-semibold text-ink">Total</td>
              <td className="pt-1 text-right font-bold text-ink">{innings.runs}</td>
              <td colSpan={4} className="pt-1 pl-2 text-[11.5px] text-ink-soft">
                {innings.wickets} down, {ballsToOvers(innings.balls)} overs
                {yetToBat > 0 ? ` · ${yetToBat} yet to bat` : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {innings.fallOfWickets.length > 0 ? (
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">Fall of wickets: </span>
          {innings.fallOfWickets
            .map(
              (fow) =>
                `${fow.wicketNumber}-${fow.runs} (${
                  innings.batting.find((b) => b.playerId === fow.playerId)?.name ?? '?'
                }, ${fow.over.toFixed(1)})`,
            )
            .join(', ')}
        </p>
      ) : null}

      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">{bowlingTeam} bowling</h3>
        <table className="mt-2 w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] tracking-wide text-ink-soft uppercase">
              <th className="pb-1 font-semibold">Bowler</th>
              <th className="pb-1 text-right font-semibold">O</th>
              <th className="pb-1 text-right font-semibold">M</th>
              <th className="pb-1 text-right font-semibold">R</th>
              <th className="pb-1 text-right font-semibold">W</th>
              <th className="pb-1 text-right font-semibold">Econ</th>
            </tr>
          </thead>
          <tbody>
            {innings.bowling
              .filter((line) => line.balls > 0)
              .map((line) => (
                <BowlingRow key={line.playerId} line={line} isUser={line.playerId === userPlayerId} />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function extrasText(innings: Innings): string {
  const parts: string[] = [];
  const e = innings.extras;
  if (e.WIDE) parts.push(`${e.WIDE} wd`);
  if (e.NO_BALL) parts.push(`${e.NO_BALL} nb`);
  if (e.BYE) parts.push(`${e.BYE} b`);
  if (e.LEG_BYE) parts.push(`${e.LEG_BYE} lb`);
  if (e.PENALTY) parts.push(`${e.PENALTY} pen`);
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

function BattingRow({
  line,
  isUser,
  onStrike,
}: {
  line: BatterInningsLine;
  isUser: boolean;
  onStrike: boolean;
}) {
  return (
    <tr className={isUser ? 'bg-brand-blue-soft/60' : undefined}>
      <td className="py-1 pr-2">
        <span className={isUser ? 'font-semibold text-ink' : 'text-ink'}>
          {line.name}
          {onStrike ? <span className="text-brand-blue"> *</span> : null}
        </span>
        <span className="block text-[11px] text-ink-soft">
          {/* Only batters who came in are listed, so anyone not out is not out. */}
          {line.out ? line.dismissalText : 'not out'}
        </span>
      </td>
      <td className="py-1 text-right font-semibold text-ink">{line.runs}</td>
      <td className="py-1 text-right text-ink-muted">{line.balls}</td>
      <td className="py-1 text-right text-ink-muted">{line.fours}</td>
      <td className="py-1 text-right text-ink-muted">{line.sixes}</td>
      <td className="py-1 text-right text-ink-muted">{line.strikeRate.toFixed(1)}</td>
    </tr>
  );
}

function BowlingRow({ line, isUser }: { line: BowlerInningsLine; isUser: boolean }) {
  return (
    <tr className={isUser ? 'bg-brand-blue-soft/60' : undefined}>
      <td className={`py-1 pr-2 ${isUser ? 'font-semibold text-ink' : 'text-ink'}`}>{line.name}</td>
      <td className="py-1 text-right text-ink-muted">{line.overs.toFixed(1)}</td>
      <td className="py-1 text-right text-ink-muted">{line.maidens}</td>
      <td className="py-1 text-right text-ink-muted">{line.runsConceded}</td>
      <td className="py-1 text-right font-semibold text-ink">{line.wickets}</td>
      <td className="py-1 text-right text-ink-muted">{line.economy.toFixed(2)}</td>
    </tr>
  );
}
