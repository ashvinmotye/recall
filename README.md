# Recall v2.3

A lightweight installable memory-game PWA with five modes.

## Modes

1. **Flash — Memory Grid**: remember all highlighted positions.
2. **Sequence — Follow the Pulse**: repeat a tile sequence in exact order.
3. **Numbers — Digit Hold**: memorise and reproduce an increasing digit span.
4. **Pairs — Pair Sprint**: clear three matching boards with efficient moves.
5. **Change — What Changed?**: study a symbol grid and identify the changed tile.

## Features

- Progressive difficulty per mode
- Personal best score per mode
- Overall best score, best streak and total games
- Migrates existing Recall v1 Flash stats automatically
- Light + Twilight themes
- Sound and haptic feedback
- Local-only persistence
- Offline service worker
- Installable on iOS/Android/desktop browsers that support PWAs

## Run

Serve the folder from any static host (GitHub Pages, Netlify, local web server, etc.).


## v2.4
- Restored the Light / Twilight theme toggle in the Home header.
- Light/Twilight choice remains saved locally.
- Increased Pair Sprint symbol size for faster visual matching.
- Removed leftover Flash-specific Home classes so all game modes stay visually equal.


## v2.6
- Added breathing room around the Best Recall orb so the outer ring does not feel clipped.
- Increased score contrast in Twilight mode with bright white text and a controlled dark shadow.


## v2.8
- Removed the border from `.orb-core`.
- Added a softly animated internal glow that drifts around the orb while the score remains stationary.
