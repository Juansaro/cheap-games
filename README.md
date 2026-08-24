# cheap-games

Briefing público de **ofertas verificadas por tienda oficial**.

El visor vive en GitHub Pages. El hub carga solo `docs/data/index.json`. Cada tienda abre `store.html#steam` (un JSON propio). Si un precio no se puede confirmar, el juego no se inventa.

Tiendas en vivo: Steam, Microsoft Store / Xbox PC, SteamVR, Meta Quest Store. PlayStation, Nintendo eShop, Google Play y App Store están en el mapa como fase 2 (sin filas falsas).

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

Luego **Actions → Daily deals → Run workflow** en GitHub, o corre la automatización de Cursor con **Run now**.

## Estructura

```
cheap-games/
  docs/                      # sitio Pages (móvil-first, HUD)
    index.html               # hub: solo el índice de tiendas
    store.html               # una tienda: #steam | #xbox | #steam/2
    css/styles.css
    js/hud.js hub.js store.js
    data/index.json          # lo único que carga el hub
    data/stores/{id}.json    # ofertas de esa tienda
    data/deals.json          # agregado (automatización / compat)
  data/deals.json
  data/new-deals.json
  DEALS.md
  scripts/
    fetch-deals.mjs
    catalog.json             # AppIDs / consultas de tiendas en vivo
    stores.json              # registro de tiendas (escalable)
  .github/workflows/daily-deals.yml
  AUTOMATION.md
```

## Qué captura cada oferta

Nombre, plataforma, precio actual / anterior, % off, moneda (COP si el store la da), fin de oferta si existe, URL de ficha, si es base / DLC / bundle.

Halo MCC **siempre** aparece como spotlight en Steam, aunque no esté en oferta.

## Fuentes

- Steam: `store.steampowered.com/api/appdetails` + búsqueda de specials por publisher.
- Xbox PC: Microsoft Store search + Display Catalog (`Windows.Desktop` / Play Anywhere).
- Meta: ficha pública de Quest si responde; si Meta bloquea el bot, la tienda Quest queda vacía y SteamVR sigue aparte.

Sin G2A ni keys de terceros. Sin secretos en el repo.

## Ampliar la lista

- **Más ofertas en tiendas vivas:** edita `scripts/catalog.json`.
- **Nueva tienda en el mapa:** agrega una entrada en `scripts/stores.json` (`live` o `deferred`). El fetcher escribe `docs/data/stores/{id}.json` y el hub la pinta sin tocar HTML.
- **Catálogo completo Android/iOS/PS5/Switch:** fase 2, con backend. No se mezcla en el scroll estático.
