const INDEX_URL = "./data/index.json";

const bootLines = [
  "handshake://docs/data/index.json",
  "source toggle // official | keys",
  "visor calibration // America/Bogota",
  "price intel online",
];

function statusLabel(store) {
  if (store.status === "live") {
    return store.dealCount ? `${store.dealCount} ofertas` : "Sin ofertas hoy";
  }
  return "Sin API pública";
}

function tileHtml(store, delay) {
  const platforms = (store.platforms || []).map((p) => escapeHtml(p)).join(" · ");
  const spotlight = store.spotlightLabel
    ? `<p class="tile-spot">Halo MCC · ${escapeHtml(store.spotlightLabel)}</p>`
    : "";
  return `
    <a class="store-tile accent-${escapeHtml(store.accent)} is-${escapeHtml(store.status)}" href="${escapeHtml(store.href)}" style="animation-delay:${delay}ms">
      <p class="tile-kicker">${escapeHtml(store.kicker)}</p>
      <h2>${escapeHtml(store.name)}</h2>
      <p class="tile-platforms">${platforms}</p>
      <p class="tile-blurb">${escapeHtml(store.blurb)}</p>
      ${spotlight}
      <span class="tile-count">${escapeHtml(statusLabel(store))}</span>
    </a>
  `;
}

async function loadIndex(source) {
  try {
    const data = await fetchApi(`/v1/index?source=${encodeURIComponent(source)}&t=${Date.now()}`);
    if (data) return { data, from: "api" };
  } catch (err) {
    console.warn("API index fallback", err);
  }
  if (source === "unofficial") return { data: null, from: "none" };
  const res = await fetch(`${INDEX_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error("index.json missing");
  return { data: await res.json(), from: "static" };
}

async function main() {
  startHudClock();
  mountSourceToggle();
  bootSequence(bootLines);
  const source = currentSource();

  const kicker = $("#hub-kicker");
  const title = $("#hub-title");
  const lede = $("#hub-lede");
  const deferred = document.querySelector(".sector-deferred");
  if (source === "unofficial") {
    if (kicker) kicker.textContent = "MAPA // ENEBA · G2A";
    if (title) title.textContent = "Keys de terceros";
    if (lede) {
      lede.textContent =
        "Solo Eneba y G2A. No son tiendas oficiales. Precio verificado en ficha, o la tienda queda vacía.";
    }
    if (deferred) deferred.hidden = true;
  }

  try {
    const loaded = await loadIndex(source);
    if (!loaded.data) {
      $("#updated-at").textContent = "sin backend";
      $("#store-board").innerHTML =
        `<div class="empty">El carril Keys necesita la API de la VM. Arranca npm run api o configura CHEAP_GAMES.API_BASE.</div>`;
      return;
    }
    const data = loaded.data;
    $("#updated-at").textContent = data.updatedAtBogota || "—";
    const liveEl = $("#live-count");
    if (liveEl) liveEl.textContent = String(data.liveDealCount ?? 0);

    const liveStores = (data.stores || []).filter((s) => s.status === "live");
    const deferredStores = (data.stores || []).filter((s) => s.status !== "live");
    $("#store-board").innerHTML = liveStores.map((s, i) => tileHtml(s, 70 * i)).join("");
    if ($("#deferred-board") && !deferred?.hidden) {
      $("#deferred-board").innerHTML = deferredStores.map((s, i) => tileHtml(s, 70 * i)).join("");
    }

    window.addEventListener("keydown", (e) => {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && liveStores[idx]?.href) location.href = liveStores[idx].href;
    });
  } catch (err) {
    $("#updated-at").textContent = "sin datos";
    $("#store-board").innerHTML = `<div class="empty">No se pudo leer el índice de tiendas</div>`;
    console.error(err);
  }
}

main();
