# Sprout — Marketing website

Static implementation of the Sprout landing page (design 4a in `design/Sprout.dc.html`):
Ocean palette, Fredoka display font, hero with phone mockup, "How Sprout works",
and footer.

## Run locally

Just open `index.html` in a browser, or serve it:

```bash
cd website
python3 -m http.server 8080
# → http://localhost:8080
```

## Structure

- `index.html` — the landing page
- `css/styles.css` — Ocean design tokens + all styles (responsive down to mobile)

## Next steps

- Parent web dashboard (login, family overview, reward shop management,
  redemption approvals, reports) — recommended as a Next.js + Tailwind app,
  per README_ProjectRundown section 6/7.
- Hook up the App Store / Google Play links once the apps are published.
