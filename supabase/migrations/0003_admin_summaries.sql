-- Item count per restaurant in one query (agency admin list). Runs with the caller's rights
-- (security invoker), so it only counts what RLS lets the caller see; the admin page uses the
-- service-role client. Safe to run more than once.
create or replace function public.restaurant_item_counts()
returns table (restaurant_id uuid, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select i.restaurant_id, count(*)::bigint as item_count
  from public.items i
  group by i.restaurant_id
$$;

revoke all on function public.restaurant_item_counts() from public, anon;
grant execute on function public.restaurant_item_counts() to authenticated, service_role;
