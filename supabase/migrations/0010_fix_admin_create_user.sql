-- =====================================================================
-- 0010_fix_admin_create_user: set GoTrue token columns to '' on user creation.
-- Manually-created auth.users rows leave confirmation_token / recovery_token /
-- email_change / email_change_token_new as NULL (nullable, no default), which
-- makes GoTrue's password sign-in fail when it scans NULL into a Go string.
-- Setting them to '' fixes login for all admin-invited users.
-- =====================================================================
create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text, p_tier int
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
begin
  if not public.auth_is_admin() then
    raise exception 'Only administrators may create users';
  end if;
  if p_tier not in (1,2,3) then
    raise exception 'Invalid role tier';
  end if;
  if length(coalesce(p_password,'')) < 8 then
    raise exception 'Temporary password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'A user with this email already exists';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers', array['email']),
    jsonb_build_object('full_name', p_full_name),
    false, false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.users (id, full_name, email, role_tier, active)
  values (v_uid, p_full_name, lower(p_email), p_tier, true);

  return v_uid;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, int) from public, anon;
grant execute on function public.admin_create_user(text, text, text, int) to authenticated;
