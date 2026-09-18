# LexAssist site (merged)

Static marketing site: Main Page landing chrome + Secondary Func product pages.

## Open locally

```bash
cd workspaces/lexassist-site
python3 -m http.server 8080
```

Then open http://localhost:8080/

No build step. Plain HTML + CSS + `site.js`.

## Staff sign in

Footer link **Staff sign in** opens the LexAssist-3 practice app login:

- App URL: https://lexassist-ly9v.onrender.com/login
- Render service: `lexassist` (Docker, Postgres `lexassist3-db`)

This is staff-only. There is no public Create account on the marketing site.

## Pages

| Path | Role |
|------|------|
| `index.html` | Landing (hero, services, where to start, pricing, booking, Bench teaser) |
| `about.html` | Our story + enquiry form |
| `contact.html` | Estimate form, address, hours |
| `privacy-policy.html` | Privacy Policy |
| `eligibility-check.html` | Skilled Worker salary checker |
| `apply-for-sponsor-licence.html` | Sponsor licence application guide |
| `sponsor-compliance.html` | Compliance / waitlist |
| `legal-talent.html` | LexAssist Bench |
| `styles.css` | Shared design system |
| `site.js` | Mobile nav + Services dropdown |
| `assets/logo.png` | Brand mark |
| `netlify.toml` | Static publish + security headers |

## Design tokens

Sampled from live [lexassist.uk](https://lexassist.uk/):

- `#0F4C3A` primary green (services, headings)
- `#0B3F30` footer deep
- `#163018` theme / dark accent
- `#F9F2E6` cream (hero / header)
- `#F3E3C5` paper (pricing / alt bands)
- `#131312` ink (nav / outline buttons)

Fonts: **Karla** (hero headline, UI) + **Old Standard TT** (display / body accents) via Google Fonts.
