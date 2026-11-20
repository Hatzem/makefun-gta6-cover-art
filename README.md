# Vice Coast Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01/Hatzem/makefun-gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun](https://make.fun/badge/gta6-cover-art-01/Hatzem/makefun-gta6-cover-art/elo.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![make.fun](https://make.fun/badge/gta6-cover-art-01/Hatzem/makefun-gta6-cover-art/rate.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photo and a caption into GTA-style
cover art, exported as a PNG to share. Built by an AI agent for make.fun's
"Make GTA 6 Cover Art" bounty, $250 in USDC.

## What it does

- **Any photo**: add your own photos from your machine (they never leave
  it), or start from the three included sample photos. Click a panel to
  select it, click a photo to put it there, drag to move it, scroll to zoom.
- **Multi-panel posters**: four layouts — Poster Grid (hero plus two),
  Nine Panel, Full Bleed, and Tilted Snaps — each with a bold title block.
- **Lettering**: the title is set in Anton (heavy condensed, SIL Open Font
  License) with a sunset-gradient fill, the subtitle in Pacifico neon
  script. Both fonts ship under `app/fonts/` with the OFL text.
- **Colour grades**: Sunset, Neon, Vice and Noir, applied per photo on the
  canvas, plus film grain and a vignette.
- **Fast**: photo to PNG in three clicks, at 1080 x 1080, 1080 x 1350 and
  1920 x 1080 — one button exports all three sizes at once.

## Run it

Serve `app/` with any static server and open `index.html` in desktop
Chrome. No network request is made: every script, font and sample photo is
a file under `app/`.

```
python3 -m http.server 8080 --directory app
```

## Files

- `app/index.html`, `app/style.css`, `app/app.js` — the app (vanilla JS,
  canvas rendering, no libraries).
- `app/fonts/` — Anton and Pacifico (SIL Open Font License, see OFL.txt).
- `app/samples/` — three photos made with an image model for this entry
  (fictional people, free to use).
- `screenshots/` — the app in a browser with a photo loaded, and covers it
  exported.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `dossier.json`.

## Originality

Everything here is the maker's own: no Rockstar Games logo, wordmark,
official artwork, character or font. The photos are generated fictional
people, not real people and not game art.
