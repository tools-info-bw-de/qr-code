# QR-Code Erklärung

Webseite für interaktive QR-Code Erklärung.  
Geschrieben in Svelte.  
Aktuell zu finden unter https://tools.info-bw.de/qr/.

# Weiterentwicklung

- Installiere Node (am besten Version 24+)
- `npm install`
- `npm run dev`

# Zum Bauen der Release-Version

- `npm run build`  
  Wichtig: Das `--base=/qr/` in `package.json` ist notwendig, damit die Seite auf dem Subpath läuft. Das muss u. U. angepasst werden
