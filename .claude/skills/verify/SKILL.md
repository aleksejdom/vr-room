---
name: verify
description: Wie man VR-Rooms lokal startet und Editor-Änderungen end-to-end im Browser verifiziert (Playwright, E2E-Testuser, Test-Tour).
---

# VR-Rooms verifizieren

## Starten

```bash
npm run dev   # Next.js auf http://localhost:3000, nutzt .env.local (Remote-Postgres + MinIO)
```

## Test-Zugang (Editor braucht Login)

- E2E-User: `e2e-claude-test@example.com` — Passwort bei Bedarf per bcrypt neu setzen:
  ```js
  // node, im Projektordner (postgres + bcryptjs aus node_modules)
  const hash = require("bcryptjs").hashSync("<neues-pw>", 10);
  await sql`update users set password_hash=${hash} where email='e2e-claude-test@example.com'`;
  ```
- E2E-Tour: `a2f3570d-f470-459f-84cb-59403eb09d00` (Editor: `/tours/<id>`), Szene „E2E Szene"
  (`827b28fe-...`) hat ein Panoramabild. Die Tour „Neue Tour" gehört dem echten User — nicht anfassen.
- DB-Zugriff: `DATABASE_URL` aus `.env.local`, per `postgres`-Package abfragen. Spalten sind snake_case
  (`horizon_tilt`, `tour_id`), nicht camelCase wie im Drizzle-Schema.

## Browser-Steuerung

Playwright im Scratchpad installieren (`npm i playwright && npx playwright install chromium`), dann headless Chromium.
Selektoren: Login `#email`/`#password`, Szenen-Aktionsknöpfe erscheinen erst nach `hover()` über der Szenenzeile
(`button[title="Horizont-Korrektur öffnen"]`, `"Szene löschen"`), Level-Slider ist `input[type=range]`.

## Gotchas

- Das Panoramabild ist ein 18-MB-JPG über den `/api/media`-Proxy → Laden dauert ~15–20 s.
  Warten bis `.psv-loader-container` verschwindet, nicht mit festem Timeout.
- WebGL-Canvas hat kein `preserveDrawingBuffer` — Pixel nur synchron im selben JS-Task auslesen:
  `const r = window.__psv.renderer; r.renderer.render(r.scene, r.camera);` dann sofort `drawImage` auf 2D-Canvas.
- `window.__psv` (der PSV-Viewer) ist nur im Dev-Modus gesetzt (PanoramaViewer.tsx).
- Nach Tests aufräumen: angelegte Testszenen löschen und `horizon_tilt/horizon_roll` der E2E-Szene auf 0 zurücksetzen
  (Test-Läufe speichern Werte in die DB).
