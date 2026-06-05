-- =====================================================================
-- 0015: admin-triggered password reset (no email/SMTP required).
-- =====================================================================
create or replace function public.admin_reset_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.auth_is_admin() then
    raise exception 'Only administrators may reset passwords';
  end if;
  if length(coalesce(p_password,'')) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  update auth.users set
    encrypted_password     = extensions.crypt(p_password, extensions.gen_salt('bf')),
    updated_at             = now(),
    confirmation_token     = coalesce(confirmation_token, ''),
    recovery_token         = coalesce(recovery_token, ''),
    email_change           = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, '')
  where id = p_user_id;
end;
$$;

revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
