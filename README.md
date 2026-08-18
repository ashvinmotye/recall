# Recall

Recall is a lightweight visual memory PWA.

## v1 features
- Flash Memory Grid
- Starts on a 3×3 grid and increases to 4×4, 5×5 and 6×6
- More tiles to remember as rounds increase
- Preview time gradually shortens
- Score, streak and personal best tracking
- Local persistence using localStorage
- Optional sound and haptic feedback
- Offline PWA support
- Mobile-first interface

## Run locally
Serve the folder over HTTP (service workers do not run from `file://`). Examples:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy
The folder can be deployed directly to GitHub Pages, Netlify, Cloudflare Pages, or any static host.
