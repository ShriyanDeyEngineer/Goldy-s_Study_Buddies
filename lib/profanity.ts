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
 */

const STRONG =
  /(fuck|shit|cunt|bitch|whore|slut|faggot|nigger|nigga|asshole)/gi;
const WHOLE_WORD = /\b(ass|dick|cock|pussy|bastard|tits)\b/gi;

export function censorProfanity(text: string): string {
  return text.replace(STRONG, "****").replace(WHOLE_WORD, "****");
}
