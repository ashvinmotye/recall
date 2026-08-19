# Recall v3.2 — AuraOS Arctic Depth

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
- AuraOS light + dark themes
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


## v2.9
- Reworked the Best Recall hero for phone layouts: the orb is centered with the copy stacked underneath.
- The orb now uses explicit equal width and height values instead of relying on aspect-ratio, preventing mobile distortion.
- Kept the moving internal glow and borderless orb core from v2.8.


## v3.0 — AuraOS
- Rebuilt the complete visual system to match the Workout app's AuraOS language.
- AuraOS depth and ambient color drift replace the previous violet theme.
- Translucent glass surfaces, compact uppercase labels, refined controls and gradient actions.
- Reworked orb, tiles, game HUD, keypad, results and toast styling into the same AuraOS family.
- Preserves all five game modes, local scores, sound/haptics and saved theme preference.
- Keeps the centered, fixed-size mobile orb and moving internal glow.


## v3.1 — Workout Blue
- Shifted the AuraOS color system from teal to Workout-style electric blue.
- Blue ambient glow, blue halo orb, blue gradient actions, blue active memory states and matching PWA theme colors.
- Layout, game logic, stats and interaction behavior remain unchanged.


## v3.2 — Arctic Depth
- Replaced the approximate Workout-blue palette with the exact Arctic Depth theme tokens from the Workout app.
- Light: #e9f8fb background, #065b98 primary, #1b7fdc secondary, #087d95 highlight, #193546 text.
- Dark: #193546 background, #0db8d3 primary, #1b7fdc secondary, #78e2ef highlight, #effcff text.
- Glass surfaces, borders, focus states, ambient glow, orb, tiles, progress and controls now derive from the Arctic Depth token system.
- Game logic, scores, local data, mobile orb layout, sound and haptics are unchanged.
