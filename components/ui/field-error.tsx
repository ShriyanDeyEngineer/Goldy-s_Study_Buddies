/**
 * Inline, per-field validation error message.
 *
 * The spec requires one message per invalid field, shown next to that
 * field. Render this directly under the input it describes and point the
 * input's aria-describedby at the id you pass here, so screen readers
 * connect the two.
 *
 * Renders nothing when there is no error, so you can include it
 * unconditionally in forms.
 */
export function FieldError({
  id,
  error,
}: {
  id?: string;
  error?: string | string[] | null;
}) {
  if (!error || (Array.isArray(error) && error.length === 0)) return null;
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-danger">
      {message}
    </p>
  );
}
