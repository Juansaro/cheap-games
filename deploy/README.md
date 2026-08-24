# Oracle VM

El visor sigue en GitHub Pages. Esta VM sirve la API y corre el ingest (oficial + Keys).

Zona del timer: el `OnCalendar=10:00` usa la zona del sistema. En la VM:

```bash
sudo timedatectl set-timezone America/Bogota
```

## Arranque

```bash
sudo mkdir -p /opt/cheap-games
sudo rsync -a --exclude node_modules --exclude data/catalog.sqlite ./ /opt/cheap-games/
cd /opt/cheap-games
node --experimental-sqlite server/seed.mjs
sudo cp deploy/cheap-games-api.service deploy/cheap-games-ingest.service deploy/cheap-games-ingest.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cheap-games-api.service
sudo systemctl enable --now cheap-games-ingest.timer
```

API por defecto: `http://<IP-de-la-VM>:8787`

Comprueba: `curl http://127.0.0.1:8787/health`

CORS: `https://juansaro.github.io` (variable `CORS_ORIGINS`).

Pon un reverse proxy (Caddy/nginx) con HTTPS y apunta `docs/js/config.js`:

```js
window.CHEAP_GAMES = { API_BASE: "https://api.tu-dominio.com" };
```

Mientras `API_BASE` esté vacío, Pages usa el JSON estático (solo carril oficial). El toggle Keys pide la API; si no hay backend, muestra el mensaje de VM.

Ingest manual:

```bash
sudo systemctl start cheap-games-ingest.service
```
