-- Ejecuta este parche en Supabase SQL Editor para:
-- 1) Permitir borrar clientes a admin/socio con la policy existente.
-- 2) Permitir que cliente y agencia escriban en comunicacion sin abrir update total.

create or replace function public.append_client_chat(
  client_slug text,
  message jsonb
)
returns clients
language plpgsql
security definer
set search_path = public
as $$
declare
  c clients;
  allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if message is null or coalesce(message->>'text', '') = '' then
    raise exception 'message text is required';
  end if;

  select
    current_user_role() in ('admin','socio')
    or (
      current_user_role() = 'client'
      and client_slug = (select workspace from profiles where id = auth.uid())
    )
  into allowed;

  if not coalesce(allowed, false) then
    raise exception 'not allowed to write this chat';
  end if;

  update clients
  set chat = coalesce(chat, '[]'::jsonb) || jsonb_build_array(message),
      updated_at = now()
  where slug = client_slug
  returning * into c;

  if c.slug is null then
    raise exception 'client not found';
  end if;

  return c;
end;
$$;

grant execute on function public.append_client_chat(text, jsonb) to authenticated;
grant execute on function public.append_client_chat(text, jsonb) to service_role;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.clients to service_role;

drop policy if exists "clients_admin_socio_editor" on public.clients;
drop policy if exists "clients_client_own" on public.clients;
drop policy if exists "clients_admin_socio_write" on public.clients;

create policy "clients_admin_socio_editor" on public.clients for select
  using (current_user_role() in ('admin','socio','editor'));

create policy "clients_client_own" on public.clients for select
  using (
    current_user_role() = 'client'
    and slug = (select workspace from profiles where id = auth.uid())
  );

create policy "clients_admin_socio_write" on public.clients for all
  using (current_user_role() in ('admin','socio'))
  with check (current_user_role() in ('admin','socio'));
