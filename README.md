# Pixton · Field Station 01 — clone

A faithful static recreation of [pixton.xyz](https://www.pixton.xyz/) — landing page,
the three content pages, and all the animations — rebuilt as plain HTML/CSS/JS
(no build step, no backend required).

## Run it

Any static server works. From this folder's parent (`D:\`):

```powershell
python -m http.server 8123 --directory pixhab-clone
# then open http://localhost:8123
```

Or just open `index.html` directly in a browser.

## Files

| File          | Purpose |
|---------------|---------|
| `index.html`  | Landing + live station (hero, canvas town, census, field log, adopt, residents, how-it-works) |
| `about.html`  | "Field manifest" — beliefs grid |
| `roadmap.html`| Four-phase roadmap with status badges |
| `faq.html`    | 14-question accordion |
| `styles.css`  | Original site stylesheet (Tailwind utilities + `pixhab-*` design system) + clone additions |
| `app.js`      | The town simulation engine (canvas renderer, 2s tick, encounters, field log, census, bio modal, wallet/adopt flow) |
| `faq.js`      | FAQ accordion data + renderer |
| `_raw/`       | Source HTML/CSS captured from the live site for reference |

## Animations reproduced

- **Live town canvas** — 25×18 pixel grid, fountain shimmer, lit windows, 6 pixel
  residents that wander on a 2-second tick with smooth eased interpolation and a
  walk-bob, drifting toward each other so encounters happen naturally.
- **Encounters → Field Log** — when two residents meet they stop, face each other,
  pop speech bubbles, and write a timestamped line into the live field log.
- **Pulsing live dots** (`pixhab-pulse` keyframe), hover colour transitions on every
  link/button, frame corner-bracket accents (`pixhab-frame`).
- **Resident bio modal** — click any resident (card, census, or sprite on the canvas)
  for a rise-in modal with bio + recent transcript.
- **Wallet + adopt flow** (mocked locally) — "waking wallet…" → connect → adopt a
  resident with a name, role, and palette; they join the next tick and appear in the
  census and "My residents".
- **FAQ accordion**, page fade-ins, log slide-ins.

## Fonts

Inter, IBM Plex Mono, and Silkscreen are loaded from Google Fonts (the same families
the original references via CSS variables).

## Notes

This is a front-end clone for learning/reference. The original's server-authoritative
simulation and on-chain pieces are replaced with an equivalent client-side mock, so the
town runs entirely in the browser with no backend.
