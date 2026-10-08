# Pixel Toys

A small static shop page for Tiaan's 3D printed toys, hosted on GitHub Pages.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `style.css` | All styling (black, lime green, cyan, yellow) |
| `app.js` | Renders the shop from `shop.json`, handles color picking and the order popup |
| `shop.json` | **All shop content.** Edit this to add toys or change settings |
| `images/` | Toy photos |

## Putting it online (one time)

1. Create a GitHub account named after the shop, e.g. `thepixeltoys`.
2. Create a **public** repository named exactly `thepixeltoys.github.io` (account name + `.github.io`).
3. Upload everything in this folder to the repository (Add file → Upload files), keeping the `images` folder.
4. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
5. After a minute or two the shop is live at `https://thepixeltoys.github.io`.

## Adding a toy

1. Put the photo in `images/`, e.g. `images/flexi-dragon.jpg`. Keep it under ~300 KB (around 800px wide is plenty).
2. Add an entry to the `toys` list in `shop.json`:

```json
{
  "id": "flexi-dragon",
  "name": "Flexi dragon",
  "price": 50,
  "desc": "Wiggly, bendy and about as long as your hand.",
  "img": "images/flexi-dragon.jpg",
  "hidden": false
}
```

- `id`: any unique word, no spaces.
- `price`: a number, or `""` to show "Price coming soon".
- `hidden`: `true` keeps the toy off the page without deleting it.
- Separate entries with commas. Paste the file into a JSON checker if the page stops loading.

Commit the change and the site updates in a minute or two.

## Shop settings (in `shop.json` → `shop`)

- `tagline`: line under the name
- `currency`: money sign, e.g. `R` or `$`
- `printTime`: shown in step 2, e.g. `3–5 days`
- `howToOrder`: shown when a customer taps **Order**. Think twice before putting a phone number or email here, since the page is public.
- `colors`: the filament colors customers can choose
