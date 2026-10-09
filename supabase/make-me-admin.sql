-- Run this AFTER you have created your login under Authentication → Users → Add user.
-- It gives every account that exists right now access to the Edit shop page.
-- Paste into Supabase → SQL Editor → New query, then click Run.

insert into public.admins (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Shows who is now an admin:
select u.email from public.admins a join auth.users u on u.id = a.user_id;
