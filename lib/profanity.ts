/**
 * Profanity filter — the CLIENT/VALIDATION half.
 *
 * The authoritative chat masking happens in the database
 * (censor_profanity(), migrations 0013/0017) so it can't be bypassed by
 * calling the RPC directly. This mirror exists so (a) the sender's
 * optimistic chat echo matches what the server stores, and (b) the zod
 * schemas can REJECT profane names/titles before anything is saved.
 * KEEP THE WORD LISTS AND PATTERNS IN SYNC with the SQL — the migration
 * generates its regex from these same rules.
 *
 * Matching rules:
 *   - STRONG words are caught with bypass hardening — leetspeak
 *     substitutions (f4ck, fvck), separators between letters ("f u c k",
 *     "f-u-c-k", "f.u.c.k"), zero-width/invisible unicode spacers, and
 *     repeated letters ("fuuuck") — and the WHOLE surrounding word is
 *     masked, so "fucking" becomes "****", not "****ing".
 *   - AMBIGUOUS words match only as whole words (the Scunthorpe problem),
 *     so "assessment", "cockpit", "Dickson", "Dickens" pass untouched.
 *
 * Known limitation: unicode homoglyphs (Cyrillic "а" for Latin "a") are
 * not normalized. Doing that properly needs a confusables pass — flag it
 * if it shows up in practice.
 */

// Letters mapped to the set of characters commonly used to stand in for them.
const LEET: Record<string, string> = {
  a: "a4@",
  b: "b8",
  c: "c(<{",
  e: "e3",
  g: "g9",
  i: "i1!|",
  l: "l1|",
  o: "o0",
  s: "s5$",
  t: "t7+",
  u: "uv",
};

// Characters that may be stuffed between letters to dodge a literal match:
// whitespace, common punctuation, and zero-width/invisible unicode.
const SEP = `[\\s\\-_.,*'"~\`\\u200B-\\u200D\\uFEFF]*`;

function escapeClass(chars: string): string {
  return chars.replace(/[\]\\^-]/g, "\\$&");
}

/** "fuck" → a source matching it plus bypass variants (spacing, leet,
 *  repeats): "f u c k", "f.u.c.k", "fuuuck", "f*ck", "f4ck", "f​uck". */
function fuzzyWord(word: string): string {
  return word
    .split("")
    .map((ch) => `[${escapeClass(LEET[ch.toLowerCase()] ?? ch)}]+`)
    .join(SEP);
}

function buildAlternation(words: string[]): string {
  // Longest-first so a longer match isn't shadowed by a shorter prefix
  // sharing a fuzzy pattern.
  return [...words]
    .sort((a, b) => b.length - a.length)
    .map(fuzzyWord)
    .join("|");
}

const STRONG_WORDS = [
  "fuck", "shit", "cunt", "bitch", "whore", "slut",
  "faggot", "nigger", "nigga", "asshole", "retard",
];
const WHOLE_WORD_WORDS = ["ass", "dick", "cock", "pussy", "bastard", "tits"];

/** \w* on both sides swallows the rest of the word → whole-word masking. */
const STRONG_SRC = `\\w*(?:${buildAlternation(STRONG_WORDS)})\\w*`;
const WHOLE_SRC = `\\b(?:${buildAlternation(WHOLE_WORD_WORDS)})\\b`;

export function censorProfanity(text: string): string {
  return text
    .replace(new RegExp(STRONG_SRC, "gi"), "****")
    .replace(new RegExp(WHOLE_SRC, "gi"), "****");
}

/** True when the text would be censored — used to REJECT names/titles. */
export function containsProfanity(text: string): boolean {
  return (
    new RegExp(STRONG_SRC, "i").test(text) || new RegExp(WHOLE_SRC, "i").test(text)
  );
}

export const PROFANITY_NAME_MESSAGE =
  "That name contains language that isn't allowed — please choose another.";
export const PROFANITY_TEXT_MESSAGE =
  "That contains language that isn't allowed here — please reword it.";
