const INDEX_URL = "./data/index.json";

const bootLines = [
  "handshake://docs/data/index.json",
  "store map // official shops only",
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

async function main() {
  startHudClock();
  bootSequence(bootLines);

  try {
    const res = await fetch(`${INDEX_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error("index.json missing");
    const data = await res.json();
    $("#updated-at").textContent = data.updatedAtBogota || "—";
    const live = data.liveDealCount ?? 0;
    const liveEl = $("#live-count");
    if (liveEl) liveEl.textContent = String(live);

    const liveStores = (data.stores || []).filter((s) => s.status === "live");
    const deferred = (data.stores || []).filter((s) => s.status !== "live");

    $("#store-board").innerHTML = liveStores.map((s, i) => tileHtml(s, 70 * i)).join("");
    $("#deferred-board").innerHTML = deferred.map((s, i) => tileHtml(s, 70 * i)).join("");

    window.addEventListener("keydown", (e) => {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && liveStores[idx]?.href) location.href = liveStores[idx].href;
    });
  } catch (err) {
    $("#updated-at").textContent = "sin datos";
    $("#store-board").innerHTML = `<div class="empty">No se pudo leer data/index.json</div>`;
    console.error(err);
  }
}

main();
