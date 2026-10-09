-- Pixel Toys database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.

-- ---------- Tables ----------

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  tagline text not null default 'Fresh toys, straight off the printer',
  currency text not null default 'R',
  default_print_time text not null default '0.5-2 days',
  how_to_order text not null default 'Fill in the order form and we''ll get back to you. We print every toy just for you!',
  colors jsonb not null default '[
    {"name":"Black","hex":"#111111"},
    {"name":"Lime green","hex":"#a6e22e"},
    {"name":"Cyan","hex":"#22d3ee"},
    {"name":"Yellow","hex":"#ffd60a"},
    {"name":"Orange","hex":"#ff8a1f"},
    {"name":"Red","hex":"#e53935"},
    {"name":"Blue","hex":"#2f6bff"}
  ]'::jsonb,
  price_per_kg numeric not null default 250,
  rate_per_hour numeric not null default 20,
  profit_pct numeric not null default 50,
  electricity_pct numeric not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.toys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  price numeric check (price is null or price >= 0),
  grams numeric check (grams is null or grams >= 0),
  print_hours numeric check (print_hours is null or print_hours >= 0),
  print_time text not null default '' check (char_length(print_time) <= 40),
  images text[] not null default '{}',
  hidden boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  toy_id uuid references public.toys(id) on delete set null,
  toy_name text not null check (char_length(toy_name) between 1 and 80),
  color text not null default '' check (char_length(color) <= 40),
  price numeric,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  contact text not null check (char_length(contact) between 3 and 120),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'printing', 'ready', 'done', 'cancelled'))
);

-- People allowed to use the Edit shop page.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- ---------- Row level security ----------

alter table public.settings enable row level security;
alter table public.toys enable row level security;
alter table public.orders enable row level security;
alter table public.admins enable row level security;

drop policy if exists "settings: anyone can read" on public.settings;
create policy "settings: anyone can read" on public.settings for select using (true);
drop policy if exists "settings: admins update" on public.settings;
create policy "settings: admins update" on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "toys: visible ones are public" on public.toys;
create policy "toys: visible ones are public" on public.toys for select
  using (hidden = false or (select public.is_admin()));
drop policy if exists "toys: admins insert" on public.toys;
create policy "toys: admins insert" on public.toys for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "toys: admins update" on public.toys;
create policy "toys: admins update" on public.toys for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "toys: admins delete" on public.toys;
create policy "toys: admins delete" on public.toys for delete to authenticated
  using ((select public.is_admin()));

-- Customers can send an order but never read anyone's orders.
drop policy if exists "orders: anyone can place a new order" on public.orders;
create policy "orders: anyone can place a new order" on public.orders for insert to anon, authenticated
  with check (status = 'new');
drop policy if exists "orders: admins read" on public.orders;
create policy "orders: admins read" on public.orders for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "orders: admins update" on public.orders;
create policy "orders: admins update" on public.orders for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "orders: admins delete" on public.orders;
create policy "orders: admins delete" on public.orders for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "admins: see yourself" on public.admins;
create policy "admins: see yourself" on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.settings, public.toys to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant update on public.settings to authenticated;
grant insert, update, delete on public.toys to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select on public.admins to authenticated;

-- ---------- Photo storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toy-photos', 'toy-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "toy photos: admins upload" on storage.objects;
create policy "toy photos: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'toy-photos' and (select public.is_admin()));
drop policy if exists "toy photos: admins update" on storage.objects;
create policy "toy photos: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'toy-photos' and (select public.is_admin()));
drop policy if exists "toy photos: admins delete" on storage.objects;
create policy "toy photos: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'toy-photos' and (select public.is_admin()));
