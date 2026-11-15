-- =====================================================================================
-- Menu platform: initial schema, Row-Level Security and Storage.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run: every
-- statement is idempotent (create if not exists / create or replace / drop ... if exists).
-- =====================================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------------------
-- Generic helpers
-- -------------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------------------------

create table if not exists public.restaurants (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  custom_domain       text unique
                        check (custom_domain is null or custom_domain = lower(custom_domain)),
  name_ar             text not null default '',
  name_en             text not null default '',
  tagline_ar          text not null default '',
  tagline_en          text not null default '',
  description_ar      text not null default '',
  description_en      text not null default '',
  logo_url            text,
  cover_url           text,
  cover_blur          text,
  theme               jsonb not null default
                        '{"template":"aurora","primary":"#C2410C","accent":"#0F766E","mode":"light","font":"cairo","radius":"round"}'::jsonb,
  currency            text not null default 'USD',
  secondary_currency  text,
  exchange_rate       numeric check (exchange_rate is null or exchange_rate > 0),
  contact             jsonb not null default '{}'::jsonb,
  opening_hours       jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  plan                text not null default 'trial' check (plan in ('trial', 'basic', 'pro')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  name_ar         text not null default '',
  name_en         text not null default '',
  description_ar  text not null default '',
  description_en  text not null default '',
  image_url       text,
  image_blur      text,
  icon            text,
  sort_order      integer not null default 0,
  is_visible      boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- lets items reference (category, restaurant) so an item can never sit in another restaurant's category
  unique (id, restaurant_id)
);

create table if not exists public.items (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  category_id     uuid not null,
  slug            text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'),
  name_ar         text not null default '',
  name_en         text not null default '',
  description_ar  text not null default '',
  description_en  text not null default '',
  price           numeric not null default 0 check (price >= 0),
  old_price       numeric check (old_price is null or old_price >= 0),
  image_url       text,
  image_blur      text,
  options         jsonb not null default '[]'::jsonb,
  tags            text[] not null default '{}',
  calories        integer check (calories is null or calories >= 0),
  is_available    boolean not null default true,
  is_featured     boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, slug),
  foreign key (category_id, restaurant_id)
    references public.categories (id, restaurant_id) on delete cascade
);

create table if not exists public.restaurant_members (
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           text not null default 'owner' check (role in ('owner', 'staff')),
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------------------------

create index if not exists restaurants_active_idx       on public.restaurants (is_active) where is_active;
create index if not exists categories_restaurant_idx    on public.categories (restaurant_id, sort_order);
create index if not exists items_restaurant_idx         on public.items (restaurant_id, sort_order);
create index if not exists items_category_idx           on public.items (category_id, sort_order);
create index if not exists items_featured_idx           on public.items (restaurant_id) where is_featured;
create index if not exists restaurant_members_user_idx  on public.restaurant_members (user_id);
create index if not exists profiles_email_idx           on public.profiles (lower(email));

-- -------------------------------------------------------------------------------------
-- updated_at triggers
-- -------------------------------------------------------------------------------------

drop trigger if exists restaurants_updated_at on public.restaurants;
create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists items_updated_at on public.items;
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so policies can call them without recursion)
-- -------------------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_restaurant_member(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = rid and user_id = auth.uid()
  );
$$;

-- Member of the restaurant or platform admin.
create or replace function public.can_manage_restaurant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or public.is_restaurant_member(rid);
$$;

-- True when the signed-in user and `other` belong to at least one common restaurant.
create or replace function public.is_co_member(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members me
    join public.restaurant_members them on them.restaurant_id = me.restaurant_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;

-- Slug availability across ALL restaurants (RLS would hide inactive / foreign ones).
create or replace function public.is_slug_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select candidate ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
     and not exists (select 1 from public.restaurants where slug = candidate);
$$;

-- Storage: may the signed-in user write the object `object_name` ("<restaurantId>/<folder>/<file>")?
create or replace function public.can_write_menu_image(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  if public.is_platform_admin() then
    return true;
  end if;
  if folder is null
     or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_restaurant_member(folder::uuid);
end;
$$;

revoke all on function public.is_co_member(uuid) from public;
grant execute on function public.is_platform_admin() to anon, authenticated, service_role;
grant execute on function public.is_restaurant_member(uuid) to anon, authenticated, service_role;
grant execute on function public.can_manage_restaurant(uuid) to anon, authenticated, service_role;
grant execute on function public.is_co_member(uuid) to authenticated, service_role;
grant execute on function public.is_slug_available(text) to authenticated, service_role;
grant execute on function public.can_write_menu_image(text) to authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Owners/staff may edit their restaurant row, but NOT plan / is_active / slug / custom_domain.
-- Only platform admins (or the service role / SQL editor) may change those.
-- SECURITY INVOKER on purpose: current_user is the API role (anon/authenticated/service_role).
-- -------------------------------------------------------------------------------------

create or replace function public.guard_restaurant_admin_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_platform_admin() then
    if new.plan is distinct from old.plan
       or new.is_active is distinct from old.is_active
       or new.slug is distinct from old.slug
       or new.custom_domain is distinct from old.custom_domain then
      raise exception 'Only platform admins can change plan, is_active, slug or custom_domain'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_guard_admin_columns on public.restaurants;
create trigger restaurants_guard_admin_columns before update on public.restaurants
  for each row execute function public.guard_restaurant_admin_columns();

-- -------------------------------------------------------------------------------------
-- Profiles: filled from auth.users
-- -------------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Backfill users created before this migration.
insert into public.profiles (id, email, display_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name')
from auth.users u
on conflict (id) do nothing;

-- profiles.email is a read-only mirror of auth.users.email: only the SECURITY DEFINER triggers
-- above and the service role write it (see the grants below; users may edit display_name only).
-- Re-sync it so rows edited while an older version of this migration let users rewrite their
-- own email no longer show a borrowed address.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- Resolve an account by email from auth.users itself (never from profiles). Server-only: the
-- owner-invite flow uses it with the service role to link an existing account.
create or replace function public.auth_user_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(btrim(lookup_email))
  order by u.created_at
  limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- -------------------------------------------------------------------------------------
-- Reordering (SECURITY INVOKER: RLS still applies). Listed ids first, the rest after them.
-- -------------------------------------------------------------------------------------

create or replace function public.reorder_categories(rid uuid, ordered_ids uuid[])
returns void
language sql
set search_path = public
as $$
  with listed as (
    select id, min(ord) as ord from unnest(ordered_ids) with ordinality as t(id, ord) group by id
  ),
  ranked as (
    select c.id,
           row_number() over (order by (l.ord is null), l.ord, c.sort_order, c.created_at) - 1 as new_order
    from public.categories c
    left join listed l on l.id = c.id
    where c.restaurant_id = rid
  )
  update public.categories c
     set sort_order = r.new_order
    from ranked r
   where c.id = r.id and c.sort_order is distinct from r.new_order;
$$;

create or replace function public.reorder_items(cid uuid, ordered_ids uuid[])
returns void
language sql
set search_path = public
as $$
  with listed as (
    select id, min(ord) as ord from unnest(ordered_ids) with ordinality as t(id, ord) group by id
  ),
  ranked as (
    select i.id,
           row_number() over (order by (l.ord is null), l.ord, i.sort_order, i.created_at) - 1 as new_order
    from public.items i
    left join listed l on l.id = i.id
    where i.category_id = cid
  )
  update public.items i
     set sort_order = r.new_order
    from ranked r
   where i.id = r.id and i.sort_order is distinct from r.new_order;
$$;

grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_items(uuid, uuid[]) to authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Grants (explicit, in case the project does not auto-expose new tables to the Data API)
-- -------------------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select on public.restaurants, public.categories, public.items to anon, authenticated;
grant insert, update, delete on public.restaurants, public.categories, public.items to authenticated;
grant select, insert, update, delete on public.restaurant_members, public.platform_admins to authenticated;
-- profiles: email identifies accounts (members list, owner invites), so it must stay a mirror of
-- auth.users. Drop whatever the project granted by default (Supabase grants ALL to anon and
-- authenticated on new tables) and let users update their display name only. Revoking the
-- table-level privilege also removes column privileges, so this is safe to re-run.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant all on public.restaurants, public.categories, public.items, public.restaurant_members,
             public.platform_admins, public.profiles to service_role;

-- -------------------------------------------------------------------------------------
-- Row-Level Security
-- -------------------------------------------------------------------------------------

alter table public.restaurants        enable row level security;
alter table public.categories         enable row level security;
alter table public.items              enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.platform_admins    enable row level security;
alter table public.profiles           enable row level security;

-- restaurants ------------------------------------------------------------------------
drop policy if exists "restaurants: public read active" on public.restaurants;
create policy "restaurants: public read active" on public.restaurants
  for select to anon, authenticated
  using (is_active);

drop policy if exists "restaurants: members read" on public.restaurants;
create policy "restaurants: members read" on public.restaurants
  for select to authenticated
  using (public.can_manage_restaurant(id));

drop policy if exists "restaurants: members update" on public.restaurants;
create policy "restaurants: members update" on public.restaurants
  for update to authenticated
  using (public.can_manage_restaurant(id))
  with check (public.can_manage_restaurant(id));

drop policy if exists "restaurants: admins insert" on public.restaurants;
create policy "restaurants: admins insert" on public.restaurants
  for insert to authenticated
  with check ((select public.is_platform_admin()));

drop policy if exists "restaurants: admins delete" on public.restaurants;
create policy "restaurants: admins delete" on public.restaurants
  for delete to authenticated
  using ((select public.is_platform_admin()));

-- categories -------------------------------------------------------------------------
drop policy if exists "categories: public read visible" on public.categories;
create policy "categories: public read visible" on public.categories
  for select to anon, authenticated
  using (
    is_visible
    and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active)
  );

drop policy if exists "categories: members manage" on public.categories;
create policy "categories: members manage" on public.categories
  for all to authenticated
  using (public.can_manage_restaurant(restaurant_id))
  with check (public.can_manage_restaurant(restaurant_id));

-- items ------------------------------------------------------------------------------
drop policy if exists "items: public read visible" on public.items;
create policy "items: public read visible" on public.items
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.categories c
      join public.restaurants r on r.id = c.restaurant_id
      where c.id = category_id and c.is_visible and r.is_active
    )
  );

drop policy if exists "items: members manage" on public.items;
create policy "items: members manage" on public.items
  for all to authenticated
  using (public.can_manage_restaurant(restaurant_id))
  with check (public.can_manage_restaurant(restaurant_id));

-- restaurant_members -----------------------------------------------------------------
drop policy if exists "members: read own, co-members, admins" on public.restaurant_members;
create policy "members: read own, co-members, admins" on public.restaurant_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_restaurant_member(restaurant_id)
    or (select public.is_platform_admin())
  );

drop policy if exists "members: admins insert" on public.restaurant_members;
create policy "members: admins insert" on public.restaurant_members
  for insert to authenticated
  with check ((select public.is_platform_admin()));

drop policy if exists "members: admins update" on public.restaurant_members;
create policy "members: admins update" on public.restaurant_members
  for update to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

drop policy if exists "members: admins delete" on public.restaurant_members;
create policy "members: admins delete" on public.restaurant_members
  for delete to authenticated
  using ((select public.is_platform_admin()));

-- platform_admins --------------------------------------------------------------------
drop policy if exists "platform_admins: read self or admin" on public.platform_admins;
create policy "platform_admins: read self or admin" on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists "platform_admins: admins insert" on public.platform_admins;
create policy "platform_admins: admins insert" on public.platform_admins
  for insert to authenticated
  with check ((select public.is_platform_admin()));

drop policy if exists "platform_admins: admins delete" on public.platform_admins;
create policy "platform_admins: admins delete" on public.platform_admins
  for delete to authenticated
  using ((select public.is_platform_admin()));

-- profiles ---------------------------------------------------------------------------
drop policy if exists "profiles: read own, co-members, admins" on public.profiles;
create policy "profiles: read own, co-members, admins" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_platform_admin())
    or public.is_co_member(id)
  );

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -------------------------------------------------------------------------------------
-- Storage: public bucket "menu-images", paths "<restaurantId>/<folder>/<uuid>.<ext>"
-- -------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  8388608,
  array['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public URLs work without a policy (public bucket). This policy lets members list/download
-- their own files through the API (also needed by update/delete).
drop policy if exists "menu-images: members read" on storage.objects;
create policy "menu-images: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'menu-images' and public.can_write_menu_image(name));

drop policy if exists "menu-images: members insert" on storage.objects;
create policy "menu-images: members insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-images' and public.can_write_menu_image(name));

drop policy if exists "menu-images: members update" on storage.objects;
create policy "menu-images: members update" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and public.can_write_menu_image(name))
  with check (bucket_id = 'menu-images' and public.can_write_menu_image(name));

drop policy if exists "menu-images: members delete" on storage.objects;
create policy "menu-images: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-images' and public.can_write_menu_image(name));
