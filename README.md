# Pixel Toys

Tiaan's shop for 3D printed toys. Live at https://pixeltoys.netlify.app (Netlify deploys every commit to this repository).

## How it fits together

| Part | Where |
| --- | --- |
| Shop page | `index.html`, `app.js`, `style.css` |
| Edit shop page (owner only) | `admin.html`, `admin.js`, `admin.css` → https://pixeltoys.netlify.app/admin.html |
| Price formula | `pricing.js` |
| Supabase connection | `config.js` (project URL + publishable key; both are safe to be public) |
| Database setup | `supabase/setup.sql`, `supabase/make-me-admin.sql` |

Data lives in Supabase project `rwmcrnmtyeilhmzgaaom`:

- `settings`: one row with the tagline, currency, order-form message, colors and pricing numbers.
- `toys`: name, description, price, grams, print hours, print time text, photo paths, hidden flag.
- `orders`: sent from the shop's order form. Customers can only insert; only admins can read.
- `admins`: user ids allowed to use the Edit shop page.
- Storage bucket `toy-photos` (public read, admin-only upload).

Row level security is on for every table. Never put the secret / service_role key in this repository.

## One-time setup

1. Supabase → **SQL Editor** → New query → paste `supabase/setup.sql` → **Run**.
2. Supabase → **Authentication → Users → Add user → Create new user**. Enter the owner's email and a password, and tick **Auto Confirm User**.
3. SQL Editor → paste `supabase/make-me-admin.sql` → **Run**. It should list the owner's email.
4. Supabase → **Authentication → Sign In / Providers** (or Settings) → turn off **Allow new users to sign up**, so nobody else can create an account.
5. Upload the site files to GitHub. Netlify publishes them.

## Pricing

```
cost  = grams × (price per kg ÷ 1000) + print hours × rate per hour
price = cost + profit% of cost + electricity% of cost, rounded to the nearest R5
```

Defaults: R250 per kg, R20 per hour, 50% profit, 5% electricity. An 83 g toy that prints in 9 hours costs R310. All four numbers can be changed under **Settings** on the Edit shop page.

## Good to know

- Free Supabase projects pause after about a week with no activity. If the shop stops loading, open the project in Supabase and click **Restore**.
- Use your own photos of your own prints, and only sell designs whose license allows selling prints.
