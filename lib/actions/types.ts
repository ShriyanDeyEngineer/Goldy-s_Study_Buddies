/**
 * The result shape every form-handling server action returns (when it
 * doesn't redirect instead).
 *
 * Forms use React's useActionState, so an action either:
 *   - redirect()s on success (throws internally — nothing is returned), or
 *   - returns one of these, and the form renders the errors inline.
 *
 * fieldErrors is keyed by field name, one message list per invalid field —
 * that is how "per-field validation errors, one message per field" (spec
 * §5.6) travels from zod to the inputs.
 */
export interface ActionResult {
  /** Form-level error (wrong password, group full, …). */
  error?: string;
  /** Per-field errors from zod — key matches the input's name attribute. */
  fieldErrors?: Record<string, string[]>;
  /** Success note for actions that stay on the page (e.g. "email sent"). */
  success?: string;
}

export const OK: ActionResult = {};
