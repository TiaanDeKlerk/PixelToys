-- Pixel Toys update: orders from the cart can be for more than one of a toy.
-- Paste into Supabase → SQL Editor → New query, then click Run. Safe to run more than once.

alter table public.orders add column if not exists quantity int not null default 1
  check (quantity between 1 and 20);

-- Most popular now counts every toy in an order, not just one per order.
create or replace function public.toy_popularity()
returns table (toy_id uuid, sold bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         t.sold_in_person + coalesce((select sum(o.quantity) from public.orders o where o.toy_id = t.id and o.status <> 'cancelled'), 0)
  from public.toys t
  where t.hidden = false;
$$;

grant execute on function public.toy_popularity() to anon, authenticated;
