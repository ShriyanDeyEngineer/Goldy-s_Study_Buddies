/**
 * Profanity filter — the CLIENT/VALIDATION half.
 *
 * The authoritative chat masking happens in the database
 * (censor_profanity(), migrations 0013/0017) so it can't be bypassed by
 * calling the RPC directly. This mirror exists so (a) the sender's
 * optimistic chat echo matches what the server stores, and (b) the zod
 * schemas can REJECT profane names/titles before anything is saved.
 * KEEP THE WORD LISTS IN SYNC with the SQL — edit both or they drift.
 *
 * Matching rules:
 *   - STRONG words are caught even when spelled out with separators
 *     ("f u c k", "f-u-c-k") — each letter may be followed by any run of
 *     non-alphanumerics — and the WHOLE surrounding word is masked, so
 *     "fucking" becomes "****", not "****ing".
 *   - AMBIGUOUS words match only as exact whole words (the Scunthorpe
 *     problem), so "assessment", "cockpit", "Dickson", and "Dickens"
 *     pass untouched.
 */

const STRONG_WORDS = [
  "fuck", "shit", "cunt", "bitch", "whore", "slut",
  "faggot", "nigger", "nigga", "asshole",
];
const WHOLE_WORDS = ["ass", "dick", "cock", "pussy", "bastard", "tits"];

/** Any run of separators (space, dash, dot, underscore…) between letters. */
const SEP = "[\\W_]*";
const spacedOut = (word: string) => word.split("").join(SEP);

/** \w* on both sides swallows the rest of the word → whole-word masking. */
const STRONG_SRC = `\\w*(?:${STRONG_WORDS.map(spacedOut).join("|")})\\w*`;
const WHOLE_SRC = `\\b(?:${WHOLE_WORDS.join("|")})\\b`;

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
