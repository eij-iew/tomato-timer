# Pocket Dex GIF Maker

A browser-only retro monster-dex GIF card maker for GitHub Pages.

## Features

- Upload PNG, JPG, or WebP images locally
- Optional pixel-art processing with adjustable block size
- Editable number, name, type, class, height, weight, stats, and four special moves
- Live card preview
- Animated GIF generation with scan-in, portrait motion, and stat reveal
- PNG snapshot export
- Multiple GIF sizes and animation speeds
- No backend, account, analytics, or image upload

## Run locally

Because the app imports `gifenc` as an ES module, serve the folder over HTTP rather than opening the HTML directly.

```sh
python -m http.server 8000
```

Then open `/pokedex-gif-maker/`.

## GitHub Pages

This directory is static and works under the repository's existing Pages deployment. No build step is required.

## Privacy

Uploaded images are decoded and processed entirely in the browser. The app does not send image data to a server.
