# cheap-games

Briefing público de **ofertas verificadas por tienda oficial**.

El visor vive en GitHub Pages. El hub carga el índice (JSON estático o API). Toggle **Oficial / Keys** (Eneba y G2A). Si un precio no se puede confirmar, el juego no se inventa.

Tiendas oficiales en vivo: Steam, Microsoft Store / Xbox PC, SteamVR, Meta Quest Store. PlayStation, Nintendo eShop, Google Play y App Store siguen sin API pública (sin filas falsas). Keys: solo Eneba y G2A, vía la API en la VM.

## Cómo se actualiza sin tu PC encendido

Hay **dos motores en la nube**. Con uno solo basta; los dos pueden convivir.

1. **GitHub Actions (recomendado para “PC apagado”)**  
   Cada día a las **10:00 America/Bogota** (`cron` UTC `0 15 * * *`, Colombia no usa DST) corre `scripts/fetch-deals.mjs` en los servidores de GitHub, escribe el índice + un JSON por tienda + `DEALS.md`, hace commit a `main` y Pages se refresca solo.  
   Trigger extra: **Actions → Daily deals → Run workflow**.

2. **Cursor Automation (agente en la nube de Cursor)**  
   Mismo horario, mismo script. También corre con el PC apagado si tienes Cloud Agents activos. El prompt listo está en [`AUTOMATION.md`](./AUTOMATION.md).

## Activar GitHub Pages

1. Sube este repo a GitHub como **público**.
2. **Settings → Pages**.
3. Source: **Deploy from a branch**.
4. Branch: **`main`** / folder: **`/docs`**.
5. Save. En 1–2 minutos:

`https://<tu-usuario>.github.io/cheap-games/`

(Si el repo no se llama `cheap-games`, cambia el último segmento.)

## Primera prueba

```bash
npm run deals
```

Si ya tienes `docs/data/deals.json` y solo quieres partirlo por tienda:

```bash
npm run deals:split
```

```bash
npm run seed   # SQLite desde los JSON oficiales actuales
npm run api    # API en :8787
```

En el visor local (`npx serve docs -l 4173`) puedes apuntar a la API:

```js
localStorage.setItem("cheap-games-api", "http://127.0.0.1:8787");
```

En producción, edita `docs/js/config.js` (`API_BASE`) y ver [`deploy/README.md`](./deploy/README.md) para systemd en Oracle (10:00 Bogotá).

## Estructura

```
cheap-games/
  config/
    stores.json              # registro de tiendas (live | deferred)
    catalog.json             # AppIDs / consultas de tiendas en vivo
  src/
    collectors/              # un módulo por tienda live
    lib/                     # http, reloj Bogotá, Deal
    write/                   # index.json, stores/{id}.json, DEALS.md
  docs/                      # sitio Pages (móvil-first, HUD)
    index.html               # hub: solo el índice de tiendas
    store.html               # una tienda: #steam | #xbox | #steam/2
    css/styles.css
    js/config.js hud.js hub.js store.js
    data/index.json          # fallback oficial si la API no responde
    data/stores/{id}.json
    data/deals.json
  server/                    # API + SQLite (VM Oracle)
  data/catalog.sqlite        # no se commitea; npm run seed
  scripts/fetch-deals.mjs    # snapshot oficial → Pages
  scripts/ingest.mjs         # oficial + keys → SQLite
  deploy/                    # systemd API + timer 10:00 Bogotá
  .github/workflows/daily-deals.yml
  AUTOMATION.md
```

## Qué captura cada oferta

Nombre, plataforma, precio actual / anterior, % off, moneda (COP si el store la da), fin de oferta si existe, URL de ficha, si es base / DLC / bundle.

Halo MCC **siempre** aparece como spotlight en Steam, aunque no esté en oferta.

## Fuentes

- Steam, Xbox PC, Meta: igual que antes.
- Keys: fichas públicas de Eneba y G2A con precio en JSON-LD. Si bloquean la lectura, el carril queda vacío.

Oficial y Keys no se mezclan en el mismo grid. Toggle en el header.

## Ampliar la lista

- **Más ofertas en tiendas vivas:** edita `config/catalog.json`.
- **Nueva tienda en el mapa:** agrega una entrada en `config/stores.json` (`live` o `deferred`). Si es `live`, añade `src/collectors/{id}.mjs` que exporte `collect(ctx)` y regístralo en `src/collectors/index.mjs`. El writer emite `docs/data/stores/{id}.json` y el hub la pinta sin tocar HTML.
- **Catálogo / Keys:** la API pagina en SQLite. Eneba y G2A son `sources: ["unofficial"]` en `config/stores.json`.
