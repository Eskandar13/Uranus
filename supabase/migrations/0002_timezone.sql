-- Restaurant time zone (IANA name), used by the public menu for "open now" and today's hours.
-- Safe to run more than once.
alter table public.restaurants
  add column if not exists timezone text not null default 'Asia/Damascus';

-- Light sanity check: IANA names look like "Area/City" (or "UTC").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_timezone_format'
  ) then
    alter table public.restaurants
      add constraint restaurants_timezone_format
      check (timezone = 'UTC' or timezone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$');
  end if;
end $$;
