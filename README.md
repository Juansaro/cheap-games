# cheap-games

Briefing público de **ofertas verificadas**: Halo MCC, Xbox en PC y Meta VR.

El visor vive en GitHub Pages. Los precios salen de APIs y fichas oficiales. Si un precio no se puede confirmar, el juego no se inventa: se omite o queda en “sin confirmar”.

## Cómo se actualiza sin tu PC encendido

Hay **dos motores en la nube**. Con uno solo basta; los dos pueden convivir.

1. **GitHub Actions (recomendado para “PC apagado”)**  
   Cada día a las **10:00 America/Bogota** (`cron` UTC `0 15 * * *`, Colombia no usa DST) corre `scripts/fetch-deals.mjs` en los servidores de GitHub, escribe `docs/data/deals.json` + `DEALS.md`, hace commit a `main` y Pages se refresca solo.  
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

Luego **Actions → Daily deals → Run workflow** en GitHub, o corre la automatización de Cursor con **Run now**.

## Estructura

```
cheap-games/
  docs/                 # sitio Pages (móvil-first, HUD Halo/Xbox/VR)
    index.html
    css/styles.css
    js/app.js
    data/deals.json     # corte que lee la página
  data/deals.json       # misma foto en la raíz
  data/new-deals.json   # ofertas nuevas vs la corrida anterior
  DEALS.md              # el mismo corte en Markdown
  scripts/
    fetch-deals.mjs     # Steam + Microsoft Store PC + Meta/SteamVR
    catalog.json        # AppIDs / consultas (fácil de ampliar)
  .github/workflows/daily-deals.yml
  AUTOMATION.md         # prompt para Cursor Automation
```

## Qué captura cada oferta

Nombre, plataforma (`Steam PC` | `Xbox PC` | `Meta Quest` | `SteamVR`), precio actual / anterior, % off, moneda (COP si el store la da), fin de oferta si existe, URL de ficha, si es base / DLC / bundle.

Halo MCC **siempre** aparece en “precio actual”, aunque no esté en oferta.

## Fuentes

- Steam: `store.steampowered.com/api/appdetails` + búsqueda de specials por publisher.
- Xbox PC: Microsoft Store search + Display Catalog (`Windows.Desktop` / Play Anywhere).
- Meta: ficha pública de Quest si responde; si Meta bloquea el bot, solo equivalentes SteamVR del catálogo.

Sin G2A ni keys de terceros. Sin secretos en el repo.

## Ampliar la lista

Edita `scripts/catalog.json` (publishers Xbox, queries de Microsoft Store, títulos Quest + AppID SteamVR). No hace falta tocar el HTML.
