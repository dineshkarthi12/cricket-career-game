/**
 * Parsers for the two squad lists in the data repo, and the mapping from the
 * team names they use onto the game's state and association sides.
 *
 * - "Ranji trophy.txt": one line per team,
 *   `<State> cricket team: Name (c), Name (vc/wk), Name, ...`, with extras
 *   such as `Standbyes: ...`, `(subject to fitness)` and `(C)` in any case.
 * - "VHT_2024-25_All_Team_Players.txt": a `[TEAM NAME]` header per team
 *   followed by one comma-separated line of names; header notes on top.
 */

export interface ListedPlayer {
  /** Name as listed, without markers. */
  name: string;
  captain: boolean;
  viceCaptain: boolean;
  keeper: boolean;
  /** Listed as a standby (travelling reserve), not in the main squad. */
  standby: boolean;
  /** "(subject to fitness)" and similar notes. */
  note?: string;
}

export interface ListedSquad {
  /** Team name as written in the file. */
  source: string;
  /** The game's side name (`ALL_SIDES[].team`), or null when unknown. */
  team: string | null;
  players: ListedPlayer[];
}

/** The game's 38 state and association sides, by the name their teams play under. */
export const GAME_SIDES = [
  'Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra', 'Hyderabad', 'Goa', 'Puducherry', 'Maharashtra', 'Gujarat', 'Rajasthan',
  'Madhya Pradesh', 'Uttar Pradesh', 'Delhi', 'Punjab', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Bengal', 'Odisha',
  'Jharkhand', 'Assam', 'Bihar', 'Chhattisgarh', 'Uttarakhand', 'Mumbai', 'Vidarbha', 'Saurashtra', 'Baroda', 'Railways',
  'Services', 'Tripura', 'Meghalaya', 'Manipur', 'Nagaland', 'Mizoram', 'Sikkim', 'Arunachal Pradesh', 'Chandigarh',
] as const;

/** Spellings used by the lists and by Cricsheet that differ from the game's side names. */
const TEAM_ALIASES: Record<string, string> = {
  'andhra pradesh': 'Andhra',
  andhra: 'Andhra',
  'hyderabad (india)': 'Hyderabad',
  hyderabad: 'Hyderabad',
  telangana: 'Hyderabad',
  'jammu & kashmir': 'Jammu & Kashmir',
  'jammu and kashmir': 'Jammu & Kashmir',
  'jammu kashmir': 'Jammu & Kashmir',
  bengal: 'Bengal',
  'west bengal': 'Bengal',
  himachal: 'Himachal Pradesh',
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  'uttaranchal': 'Uttarakhand',
};

/** The game's side for a team name from a list or a scorecard, or null. */
export function gameSideOf(raw: string): string | null {
  const key = raw
    .replace(/cricket team/i, '')
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (TEAM_ALIASES[key]) return TEAM_ALIASES[key];
  return GAME_SIDES.find((s) => s.toLowerCase() === key) ?? null;
}

const MARKER = /\(([^)]*)\)/g;

/** One listed name with its markers: "Abishek Porel (vc/wk)", "Aryan Rana (subject to fitness)". */
export function parseListedName(raw: string, standby = false): ListedPlayer | null {
  let captain = false;
  let viceCaptain = false;
  let keeper = false;
  const notes: string[] = [];
  const text = raw.replace(MARKER, (_m, inner: string) => {
    for (const part of inner.split(/[/,&]/).map((x) => x.trim().toLowerCase())) {
      if (part === 'c' || part === 'capt' || part === 'captain') captain = true;
      else if (part === 'vc' || part === 'vice-captain' || part === 'vice captain') viceCaptain = true;
      else if (part === 'wk' || part === 'wicketkeeper' || part === 'wicket-keeper') keeper = true;
      else if (part) notes.push(part);
    }
    return ' ';
  });
  const name = text
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')
    .trim();
  if (!name) return null;
  return { name, captain, viceCaptain, keeper, standby, ...(notes.length ? { note: notes.join('; ') } : {}) };
}

/** Split a names line, respecting brackets, and flag everything after "Standbyes:" / "Standby:". */
function splitNames(line: string): ListedPlayer[] {
  const out: ListedPlayer[] = [];
  let standby = false;
  // A standby label can come after a comma or straight after a name ("... (wk) Standbyes: A, B").
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of line) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  for (let part of parts) {
    const label = part.match(/\b(stand-?by(?:e?s)?|reserves?)\s*:/i);
    if (label && label.index !== undefined) {
      const before = part.slice(0, label.index);
      const beforePlayer = parseListedName(before, standby);
      if (beforePlayer) out.push(beforePlayer);
      standby = true;
      part = part.slice(label.index + label[0].length);
    }
    const player = parseListedName(part, standby);
    if (player) out.push(player);
  }
  return out;
}

/** "Ranji trophy.txt": `<State> cricket team: names...` per line. */
export function parseRanjiList(text: string): ListedSquad[] {
  const squads: ListedSquad[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = line.match(/^(.+?)\s+cricket team\s*:\s*(.+)$/i);
    if (!m) continue;
    const source = m[1].trim();
    squads.push({ source, team: gameSideOf(source), players: splitNames(m[2].replace(/\.\s*$/, '')) });
  }
  return squads;
}

/** "VHT_2024-25_All_Team_Players.txt": `[TEAM]` then a line of names. Notes and headers are skipped. */
export function parseVhtList(text: string): ListedSquad[] {
  const squads: ListedSquad[] = [];
  let current: ListedSquad | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      const source = header[1].trim();
      // "[UTTAR PRADESH - NOTE]" and similar are commentary, not a team.
      if (/\bnote\b/i.test(source)) {
        current = null;
        continue;
      }
      current = { source, team: gameSideOf(source), players: [] };
      squads.push(current);
      continue;
    }
    if (!current) continue;
    // A names line has commas; a stray sentence under a team is ignored.
    if (!line.includes(',')) continue;
    current.players.push(...splitNames(line));
  }
  return squads.filter((s) => s.players.length > 0);
}
