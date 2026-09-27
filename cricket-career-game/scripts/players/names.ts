/**
 * Matching a squad-list name ("Hanuma Vihari", "Narayan Jagadeesan") to a
 * Cricsheet name ("GH Vihari", "N Jagadeesan"). Cricsheet shortens given
 * names to initials, keeps some in full, and orders South Indian initials
 * (family or place names) first, so the rules are:
 *
 * - every full word in the Cricsheet name must be in the listed name
 *   (exactly, or one letter off for words of five letters or more);
 * - the listed name's surname (last word) must be one of those words;
 * - each listed word not matched that way needs its first letter among the
 *   Cricsheet initials (one may be missing for names of three words or more).
 *
 * Every candidate that passes is scored; the state they play for, recent
 * seasons and an exact Kaggle full name push the score up. Ties are
 * reported as ambiguous - never guessed silently.
 */

export function normName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[.\-_]/g, ' ')
    .replace(/[^A-Za-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface NameParts {
  /** Full words, lower case. */
  words: string[];
  /** Initial letters, lower case, in order. */
  initials: string[];
}

/** Split a name into full words and initials ("GH Vihari" -> initials g,h; words vihari). */
export function nameParts(raw: string): NameParts {
  const tokens = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[.]/g, ' ')
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const words: string[] = [];
  const initials: string[] = [];
  for (const t of tokens) {
    // Upper-case runs of up to four letters are initials ("GH", "PVSN", "N"), wherever they sit ("Basil NP").
    if (/^[A-Z]{1,4}$/.test(t)) initials.push(...t.toLowerCase().split(''));
    else words.push(t.toLowerCase());
  }
  return { words, initials };
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Same word, or a spelling variant ("abishek"/"abhishek", "rajbongshi"/"rajbangshi"). */
export function wordsMatch(a: string, b: string): 0 | 1 | 2 {
  if (a === b) return 2;
  if (a.length >= 5 && b.length >= 5 && editDistance(a, b) <= 1) return 1;
  // "h" dropped or doubled letters are common transliteration variants.
  const squash = (w: string) => w.replace(/h/g, '').replace(/(.)\1/g, '$1').replace(/ee/g, 'i').replace(/oo/g, 'u');
  if (a.length >= 4 && b.length >= 4 && squash(a) === squash(b)) return 1;
  return 0;
}

/** How well a listed name fits a Cricsheet name: null when it cannot be the same player. */
export function nameScore(listed: string, cricsheet: string): number | null {
  return nameMatch(listed, cricsheet)?.score ?? null;
}

/**
 * The score, and whether the match is weak: the listed surname only matched
 * as an initial ("Ajitesh Guruswamy" / "G Ajitesh" - family name first on
 * the scorecard), which is trusted only for a player of the same side.
 */
export function nameMatch(listed: string, cricsheet: string): { score: number; weak: boolean } | null {
  const L = nameParts(listed);
  const C = nameParts(cricsheet);
  if (C.words.length === 0) return null;
  // Listed initials ("KV Sasikanth") are letters to find among the other name's letters.
  const listedWords = L.words;
  if (listedWords.length === 0) return null;
  const used = new Set<number>();
  let score = 0;
  for (const w of C.words) {
    let best = -1;
    let bestQ = 0;
    listedWords.forEach((lw, i) => {
      if (used.has(i)) return;
      const q = wordsMatch(lw, w);
      if (q > bestQ) {
        bestQ = q;
        best = i;
      }
    });
    if (best === -1) return null;
    used.add(best);
    score += bestQ === 2 ? 3 : 2;
  }
  // The listed surname must be one of the matched words - unless two or more full words
  // matched ("Jaskaranvir Singh Paul" is "Jaskaranvir Singh" on scorecards).
  let weak = false;
  if (!used.has(listedWords.length - 1)) {
    if (C.words.length >= 2) score -= 1;
    else if (C.initials.includes(listedWords[listedWords.length - 1][0])) {
      weak = true;
      score -= 2;
    } else return null;
  }
  const pool = [...C.initials];
  const take = (letter: string): boolean => {
    const i = pool.indexOf(letter);
    if (i === -1) return false;
    pool.splice(i, 1);
    return true;
  };
  let missing = 0;
  listedWords.forEach((w, i) => {
    if (used.has(i)) return;
    if (take(w[0])) score += 1;
    else missing += 1;
  });
  for (const letter of L.initials) {
    if (take(letter)) score += 1;
    else if (!C.words.some((w) => w[0] === letter)) missing += 1;
  }
  const allowed = listedWords.length + L.initials.length >= 3 ? 1 : 0;
  if (missing > allowed) return null;
  score -= missing * 2;
  if (normName(listed) === normName(cricsheet)) score += 6;
  return { score, weak };
}

export interface Candidate {
  id: string;
  /** Every Cricsheet name the id has appeared under. */
  names: string[];
  /** Kaggle full names for the id (normalised). */
  fullNames?: string[];
  /** Sides the player has played SMAT for (game side names). */
  states: string[];
  lastYear: number;
}

export interface MatchResult {
  id: string | null;
  score: number;
  /** Other candidates within the ambiguity margin. */
  alternatives: { id: string; name: string; score: number }[];
  matchedName: string | null;
  reason: 'matched' | 'unmatched' | 'ambiguous';
}

export const AMBIGUITY_MARGIN = 1;

/** Best candidate for a listed name in a state, or ambiguous / unmatched. */
export function matchListedName(listed: string, state: string | null, candidates: Candidate[], latestYear: number, surnameCount?: Map<string, number>): MatchResult {
  const target = normName(listed);
  const surname = target.split(' ').pop() ?? '';
  const common = (surnameCount?.get(surname) ?? 0) >= 3;
  const scored: { id: string; name: string; score: number }[] = [];
  for (const c of candidates) {
    let best: number | null = null;
    let bestName = c.names[0];
    let weak = false;
    for (const n of c.names) {
      const m = nameMatch(listed, n);
      if (m !== null && (best === null || m.score > best)) {
        best = m.score;
        bestName = n;
        weak = m.weak;
      }
    }
    const full = c.fullNames?.includes(target) ?? false;
    if (best === null && !full) continue;
    const inState = Boolean(state && c.states.includes(state));
    // A common surname matched on an initial alone is only trusted for someone who plays for the side.
    const byInitial = !full && !nameParts(bestName).words.some((w) => w !== surname && target.split(' ').includes(w));
    if (common && byInitial && !inState) continue;
    if (weak && !full && !inState) continue;
    // A known full name that does not contain the listed given name is someone else
    // ("Aditya Patel" is not AR Patel, whose full name is Axar Rajeshbhai Patel).
    if (!full && c.fullNames?.length) {
      const given = target.split(' ').filter((w) => w !== surname && w.length > 1);
      const fullWords = c.fullNames.flatMap((f) => f.split(' '));
      if (given.length && !given.some((g) => fullWords.some((w) => wordsMatch(g, w) > 0))) continue;
    }
    // A surname spelt differently ("Dalal"/"Dayal", "Pathak"/"Pathan") is only trusted within the side.
    if (!full && !inState && !nameParts(bestName).words.includes(surname)) continue;
    let score = (best ?? 4) + (full ? 12 : 0);
    if (inState) score += 6;
    if (c.lastYear >= latestYear - 2) score += 2;
    else if (c.lastYear >= latestYear - 5) score += 1;
    scored.push({ id: c.id, name: bestName, score });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { id: null, score: 0, alternatives: [], matchedName: null, reason: 'unmatched' };
  const [top, ...rest] = scored;
  const close = rest.filter((r) => top.score - r.score < AMBIGUITY_MARGIN);
  if (close.length > 0) return { id: null, score: top.score, alternatives: [top, ...close], matchedName: null, reason: 'ambiguous' };
  return { id: top.id, score: top.score, alternatives: rest.slice(0, 2), matchedName: top.name, reason: 'matched' };
}

/** How many candidates share each surname (last full word of any of their names). */
export function surnameCounts(candidates: Candidate[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const names = new Set(c.names.map((n) => nameParts(n).words.at(-1)).filter((w): w is string => Boolean(w)));
    for (const w of names) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
}
