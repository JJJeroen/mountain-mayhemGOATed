# Mountain Mayhem: GOATed - web prototype

Static site, no build step. ES modules + Web Worker need http (not file://):

    cd web && python3 -m http.server 8080     # then open http://localhost:8080

- `engine.js`, `bots.js`: copies of the rules engine and AI from the parent folder (keep in sync, or symlink).
- `art.js`: all artwork as code (5 goats x 4 expressions + mud, the Ram, 12 avatars). `art.html` = gallery.
- `export-art.mjs`: writes standalone SVGs to `assets/`.
- `main.js`, `style.css`, `index.html`, `bot-worker.js`: the game UI. Bots run in a worker.
