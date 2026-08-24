/**
 * Chat profanity filter — the CLIENT half.
 *
 * The authoritative masking happens in the database (censor_profanity(),
 * migration 0013) so it can't be bypassed by calling the RPC directly.
 * This mirror exists for one reason: the sender's own message is rendered
 * optimistically from local state before the round trip, and it must show
 * exactly what everyone else will receive. KEEP THE TWO WORD LISTS IN
 * SYNC — edit both this file and 0013 or the echo will lie.
 *
 * Two tiers (the Scunthorpe problem):
 *   - STRONG words mask wherever they appear ("bullshit" → "bull****").
 *   - AMBIGUOUS words mask only as whole words, so "assessment",
 *     "Dickson", and "cockpit" pass through.
 *
 * Bypass hardening: each word is compiled into a "fuzzy" pattern that
 * tolerates:
 *   - leetspeak substitutions (a↔4/@, e↔3, i↔1/!, o↔0, s↔5/$, t↔7, ...)
 *   - separators/punctuation inserted between letters ("f.u.c.k", "f u c k")
 *   - zero-width/invisible unicode used as spacers ("f\u200Buck")
 *   - repeated characters ("fuuuuck")
 *
 * Known limitation: this does NOT catch unicode homoglyphs (Cyrillic "а"
 * for Latin "a", etc). Doing that properly needs a confusables-normalization
 * pass (e.g. based on the Unicode confusables table) — flag if that's a
 * real problem in practice and we can add it.
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

// Turns a plain word into a regex source that matches it plus common
// bypass variants, e.g. "fuck" -> matches "f u c k", "f.u.c.k", "fuuuck",
// "f*ck", "f4ck", "f\u200Buck", etc.
function fuzzyWord(word: string): string {
  return word
    .split("")
    .map((ch) => {
      const cls = escapeClass(LEET[ch.toLowerCase()] ?? ch);
      return `[${cls}]+`;
    })
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
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "whore",
  "slut",
  "faggot",
  "nigger",
  "nigga",
  "asshole",
  "retard",
];

const WHOLE_WORD_WORDS = ["ass", "dick", "cock", "pussy", "bastard", "tits"];

const STRONG = new RegExp(`(${buildAlternation(STRONG_WORDS)})`, "gi");
const WHOLE_WORD = new RegExp(
  `\\b(${buildAlternation(WHOLE_WORD_WORDS)})\\b`,
  "gi"
);

export function censorProfanity(text: string): string {
  return text.replace(STRONG, "[REDACTED]").replace(WHOLE_WORD, "#&%*@!");
}