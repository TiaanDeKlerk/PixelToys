-- Pixel Toys update: categories, in-person sales, and "Most popular".
-- Paste into Supabase → SQL Editor → New query, then click Run. Safe to run more than once.

alter table public.toys add column if not exists category text not null default ''
  check (char_length(category) <= 40);
alter table public.toys add column if not exists sold_in_person int not null default 0
  check (sold_in_person >= 0);

-- How many of each visible toy have sold: in-person sales plus website orders (not cancelled).
-- Returns only totals, never who ordered.
create or replace function public.toy_popularity()
returns table (toy_id uuid, sold bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         t.sold_in_person + (select count(*) from public.orders o where o.toy_id = t.id and o.status <> 'cancelled')
  from public.toys t
  where t.hidden = false;
$$;

grant execute on function public.toy_popularity() to anon, authenticated;
