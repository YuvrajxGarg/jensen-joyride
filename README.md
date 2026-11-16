# Jensen Joyride

A parody jetpack runner. Hold to fly through HQ, collect chips, dodge export bans, subpoenas, paparazzi
flashes and sell-offs, ride "new products", and beat the bosses of the news cycle. Original art, sound and
names, all hand-drawn in canvas code; the hero is a cartoon caricature of a public figure.

## Play

- Hold Space / click / touch to fly, let go to fall. M mutes, Esc or P pauses.
- Chips are the currency: they pay for jackets in the Wardrobe and for a Golden Parachute (revive, 300 chips, doubling each use in a run).
- Three missions at a time; every 3 completed raises your rank.
- Bosses (public business story only): The Board, The Probe, The Hearing, The Short Seller, The Press Pack,
  The Regulator, at 450 / 1100 / 1850 / 2700 / 3600 / 4600 m, then every 1000 m with more HP.
  Grab the VOTE ballots during a boss fight to fire them back.
- New products (gift box): Keynote Podium (tap flips gravity), Superchip Mech (tap jumps), Server Rack Glider
  (hold to rise, glide down). A product absorbs one hit.
- Chip Magnet pulls chips in for 10 s.
- Best distance, chip bank, missions and jackets are saved in localStorage. Share makes a 1080×1080 card.

## Content rules

Parody of a public news story (board investigation, resignation, market drop, investor push, congressional
briefing, export controls). No private people, family or relationships as characters, bosses or jokes; nothing
sexual. Keep the parody label and footer disclaimer.

## Run

Plain HTML + ES modules, no build step, no dependencies.

```
python3 -m http.server 8000   # then open http://localhost:8000
```

Debug: `?play` starts a run, `?boss=board|probe|hearing|short|press|regulator` starts with that boss,
`?dist=1000` starts at a distance.

## Files

- `src/main.js`: screens, input, canvas sizing, loop, share card.
- `src/game.js`: physics, spawning, hazards, vehicles, bosses and their attacks, collisions, render.
- `src/draw.js`: all art (caricature, chips, hazards, vehicles, bosses, HQ rooms).
- `src/audio.js`: procedural WebAudio music (menu / run / boss) and SFX.
- `src/meta.js`: save data, missions, ranks, jackets.

## Deploy

Repo `YuvrajxGarg/jensen-joyride`, own Vercel project `jensen-joyride`. Production deploys from `main` only
(`vercel.json` turns off other branches). Batch changes: one push per deploy.
