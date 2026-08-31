-- ============================================================================
-- 0039 — a per-user record of legal-terms acceptance.
--
-- Sign-in already blocks anyone who does not tick the consent checkbox
-- ("I agree to the Terms, Privacy Policy, and Community Guidelines, and I
-- confirm I am at least 13 years old" — enforced server-side in
-- signInWithGoogleAction). This migration adds the *record* of that
-- acceptance so it can be shown if enforceability is ever questioned:
--
--   profiles.terms_accepted_at  — when the user accepted (server clock)
--   profiles.terms_version      — which version they accepted (lib/site.ts
--                                 TERMS_VERSION, e.g. '2026-08-31')
--
-- Written by record_terms_acceptance() when the user finishes onboarding
-- (every account must). NULL for accounts that onboarded before this
-- migration — the re-consent flow (a later change) will fill those in.
--
-- Idempotent.
-- ============================================================================

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

comment on column public.profiles.terms_accepted_at is
  'When this user accepted the current legal terms (server clock). Set by '
  'record_terms_acceptance() at onboarding. NULL = no stored record yet.';
comment on column public.profiles.terms_version is
  'The TERMS_VERSION string the user accepted (lib/site.ts). Bumped when '
  'the Terms / Privacy Policy / Community Guidelines change materially.';

-- SECURITY DEFINER so the timestamp is the server's, not something a
-- client could forge, and so the two columns need no UPDATE grant.
create or replace function public.record_terms_acceptance(p_version text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update public.profiles
    set terms_accepted_at = now(),
        terms_version = nullif(trim(coalesce(p_version, '')), '')
    where id = v_uid;
end;
$$;

revoke execute on function public.record_terms_acceptance(text) from public, anon;
grant execute on function public.record_terms_acceptance(text) to authenticated;
