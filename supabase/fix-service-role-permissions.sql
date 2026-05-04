-- Ejecuta este parche en Supabase SQL Editor si /api/invitations devuelve:
-- {"error":"permission denied for table invitations"}

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on public.profiles     to service_role;
grant select, insert, update, delete on public.invitations  to service_role;
grant select, insert, update, delete on public.clients      to service_role;
grant select, insert, update, delete on public.time_entries to service_role;
grant select, insert, update, delete on public.deals        to service_role;

grant execute on function public.ensure_my_profile() to service_role;
grant execute on function public.upsert_invitation(text, text, text, text[]) to service_role;
grant execute on function public.create_client_workspace(text, text, text, text, text, integer) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, name, role, workspace, workspaces)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'workspace',
    case
      when jsonb_typeof(new.raw_user_meta_data->'workspaces') = 'array' then
        array(select jsonb_array_elements_text(new.raw_user_meta_data->'workspaces'))
      else
        array['frame']
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(profiles.name, ''), excluded.name),
        role = coalesce(excluded.role, profiles.role),
        workspace = coalesce(excluded.workspace, profiles.workspace),
        workspaces = coalesce(excluded.workspaces, profiles.workspaces),
        updated_at = now();

  return new;
end;
$$;
