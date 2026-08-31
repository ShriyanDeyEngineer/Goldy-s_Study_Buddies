/**
 * Profanity filter — the CLIENT/VALIDATION half.
 *
 * Detection and masking run as a single linear-time, forward-only scan —
 * NO regular expressions. The previous regex approach (`[class]+` per
 * letter with an optional separator between every pair, wrapped in `\w*`)
 * could be driven into catastrophic backtracking by a long run of one
 * character: `censorProfanity("a".repeat(2000))` took ~9 s. Because
 * `containsProfanity()` runs inside server-action zod validation, that
 * blocked the Node event loop — a trivial denial of service. The scan
 * below is O(text length × word count) for every input.
 *
 * The authoritative masking still happens in the database
 * (`censor_profanity()`, migrations 0013/0017/0036) so it can't be
 * bypassed by calling the RPC directly. This mirror exists so (a) the
 * sender's optimistic chat echo matches what the server stores, and
 * (b) the zod schemas can REJECT profane names/titles before anything is
 * saved. KEEP THE WORD LISTS AND MATCHING RULES IN SYNC with the SQL.
 *
 * Matching rules (unchanged in intent):
 *   - STRONG words are caught with bypass hardening — leetspeak
 *     substitutions (f4ck, fvck, f*ck — a masked vowel counts as the
 *     vowel), separators between letters ("f u c k", "f-u-c-k",
 *     "f.u.c.k"), zero-width/invisible unicode spacers, and repeated
 *     letters ("fuuuck") — and the WHOLE surrounding word is masked, so
 *     "fucking" becomes "****", not "****ing".
 *   - AMBIGUOUS words match only as whole words (the Scunthorpe problem),
 *     so "assessment", "cockpit", "Dickson", "Dickens" pass untouched.
 *
 * Known limitation: unicode homoglyphs (Cyrillic "а" for Latin "a") are
 * not normalized. Doing that properly needs a confusables pass — flag it
 * if it shows up in practice.
 */

const MASK = "****";

/** Letters mapped to the characters commonly used to stand in for them. */
const LEET: Record<string, string> = {
  a: "a4@*",
  b: "b8",
  c: "c(<{",
  e: "e3*",
  g: "g9",
  i: "i1!|*",
  l: "l1|",
  o: "o0*",
  s: "s5$",
  t: "t7+",
  u: "uv4*",
};

/** Characters that may be stuffed between letters to dodge a literal
 *  match: whitespace, common punctuation, and zero-width/invisible
 *  unicode. Mirrors the old SEP character class exactly. */
const SEPARATORS = new Set([
  " ", "\t", "\n", "\r", "\f", "\v",
  "-", "_", ".", ",", "*", "'", '"', "~", "`",
  "\u200B", "\u200C", "\u200D", "\uFEFF",
]);

const STRONG_WORDS = [
  "fuck", "shit", "cunt", "bitch", "whore", "slut",
  "faggot", "nigger", "nigga", "asshole", "retard",
];
const WHOLE_WORD_WORDS = ["ass", "dick", "cock", "pussy", "bastard", "tits"];

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && (ch === "_" ||
    (ch >= "0" && ch <= "9") ||
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z"));
}

/** True if `ch` can represent the canonical letter `letter` (case- and
 *  leet-insensitive). */
function matchesLetter(ch: string | undefined, letter: string): boolean {
  if (ch === undefined) return false;
  const lower = ch.toLowerCase();
  if (lower === letter) return true;
  const leet = LEET[letter];
  return leet !== undefined && leet.includes(lower);
}

/**
 * Try to match `word` in `text` starting exactly at `start`. Deterministic
 * and forward-only: `j` only ever advances, so this is
 * O(word length + run lengths) and can never backtrack.
 *
 * Returns the index just past the match, or -1 if `word` does not start here.
 */
function matchWordAt(text: string, start: number, word: string): number {
  let j = start;
  let first = true;
  let wi = 0;

  while (wi < word.length) {
    const letter = word[wi];
    // Consecutive copies of the same letter ("ass" → two s's) each need
    // their own text character, so count them and fill one "slot" apiece.
    let slots = 1;
    while (wi + slots < word.length && word[wi + slots] === letter) slots++;

    for (let s = 0; s < slots; s++) {
      // A separator run is allowed before every letter slot except the
      // very first character of the word. A separator that is itself a
      // leet variant of the expected letter is consumed AS the letter
      // (so "f*ck" matches: '*' stands in for 'u').
      if (!first) {
        while (
          j < text.length &&
          SEPARATORS.has(text[j]) &&
          !matchesLetter(text[j], letter)
        ) {
          j++;
        }
      }
      first = false;

      if (!matchesLetter(text[j], letter)) return -1;
      j++;

      // The last slot for this letter absorbs the rest of the run
      // ("fuuuck"); earlier slots take exactly one char so a later slot
      // still has something to match ("ass" needs s, then s).
      if (s === slots - 1) {
        while (matchesLetter(text[j], letter)) j++;
      }
    }
    wi += slots;
  }
  return j;
}

interface Span {
  start: number;
  end: number;
}

/** Every span of `text` that should be masked, merged and in order. */
function profaneSpans(text: string): Span[] {
  const spans: Span[] = [];

  const scan = (words: string[], wholeWordOnly: boolean) => {
    for (const word of words) {
      let i = 0;
      while (i < text.length) {
        if (!matchesLetter(text[i], word[0])) {
          i++;
          continue;
        }
        const rawEnd = matchWordAt(text, i, word);
        if (rawEnd === -1) {
          // Every start inside this first-letter run fails identically —
          // skip the whole run instead of re-scanning it. This is what
          // keeps the worst case linear.
          let k = i + 1;
          while (matchesLetter(text[k], word[0])) k++;
          i = k;
          continue;
        }
        if (wholeWordOnly) {
          const boundedLeft = i === 0 || !isWordChar(text[i - 1]);
          const boundedRight = rawEnd >= text.length || !isWordChar(text[rawEnd]);
          if (boundedLeft && boundedRight) spans.push({ start: i, end: rawEnd });
        } else {
          // STRONG: mask the whole surrounding word.
          let start = i;
          while (start > 0 && isWordChar(text[start - 1])) start--;
          let end = rawEnd;
          while (end < text.length && isWordChar(text[end])) end++;
          spans.push({ start, end });
        }
        i = rawEnd;
      }
    }
  };

  scan(STRONG_WORDS, false);
  scan(WHOLE_WORD_WORDS, true);

  if (spans.length < 2) return spans;
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [spans[0]];
  for (let x = 1; x < spans.length; x++) {
    const last = merged[merged.length - 1];
    if (spans[x].start <= last.end) {
      last.end = Math.max(last.end, spans[x].end);
    } else {
      merged.push(spans[x]);
    }
  }
  return merged;
}

export function censorProfanity(text: string): string {
  const spans = profaneSpans(text);
  if (spans.length === 0) return text;
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += text.slice(cursor, span.start) + MASK;
    cursor = span.end;
  }
  return out + text.slice(cursor);
}

/** True when the text would be censored — used to REJECT names/titles. */
export function containsProfanity(text: string): boolean {
  return profaneSpans(text).length > 0;
}

export const PROFANITY_NAME_MESSAGE =
  "That name contains language that isn't allowed — please choose another.";
export const PROFANITY_TEXT_MESSAGE =
  "That contains language that isn't allowed here — please reword it.";
