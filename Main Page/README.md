# LexAssist.uk — static site

Pixel-faithful static recreation of the live GoDaddy site at [lexassist.uk](https://lexassist.uk/).

## Open locally

From this directory:

```bash
cd /workspace/lexassist.uk/site
python3 -m http.server 8080
```

Then open http://localhost:8080/

No build step. Plain HTML + CSS (+ minimal mobile-nav JS).

## Files

| Path | Role |
|------|------|
| `index.html` | Full single-page home (hero, services, pricing, booking, footer) |
| `about.html` | About stub with shared chrome |
| `contact.html` | Contact stub with shared chrome |
| `styles.css` | Palette, typography, layout |
| `assets/logo.png` | Brand mark |

## Design tokens

- `#163018` deep forest
- `#0F4C3A` primary green
- `#F9F2E6` cream
- `#2F4F4F` slate
- `#F7F7EB` ivory

Fonts: **Old Standard TT** (display) + **Karla** (body) via Google Fonts.
