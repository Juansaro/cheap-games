const DATA_URL = "./data/deals.json";

const bootLines = [
  "handshake://store.steampowered.com",
  "handshake://displaycatalog.mp.microsoft.com",
  "visor calibration // America/Bogota",
  "price intel online",
];

function $(sel) {
  return document.querySelector(sel);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function kindLabel(kind) {
  if (kind === "dlc") return "DLC";
  if (kind === "bundle") return "Bundle";
  return "Juego base";
}

function cardHtml(deal, extra = {}) {
  const art = deal.image
    ? `style="--art: url('${escapeHtml(deal.image)}')"`
    : "";
  const ends = deal.dealEndsAtBogota
    ? `Termina: ${escapeHtml(deal.dealEndsAtBogota)}`
    : "Fin de oferta: no publicado";
  const was =
    deal.discountPercent > 0
      ? `<span class="price-was">${escapeHtml(deal.pricePreviousLabel || "")}</span>
         <span class="off">−${escapeHtml(deal.discountPercent)}%</span>`
      : `<span class="tag-live">PRECIO ACTUAL (SIN OFERTA)</span>`;
  const unconfirmed = deal.confirmed === false ? `<span class="pill">sin confirmar</span>` : "";
  return `
    <article class="intel-card" data-platform="${escapeHtml(deal.platform)}" data-faction="${escapeHtml(extra.faction || "")}" style="animation-delay:${extra.delay || 0}ms">
      <div class="card-art" ${art}>
        <span class="badge">${escapeHtml(deal.platform)}</span>
      </div>
      <div class="card-body">
        ${deal.isNew && deal.discountPercent > 0 ? `<span class="new-flag">NUEVA SEÑAL</span>` : ""}
        <h3>${escapeHtml(deal.name)}</h3>
        <div class="meta-row">
          <span class="pill">${escapeHtml(kindLabel(deal.kind))}</span>
          ${deal.playAnywhere ? `<span class="pill">Play Anywhere</span>` : ""}
          ${unconfirmed}
        </div>
        <div class="price-block">
          <span class="price-now">${escapeHtml(deal.priceCurrentLabel || "—")}</span>
          ${was}
        </div>
        <div class="ends">${ends}</div>
        <a class="cta" href="${escapeHtml(deal.url)}" rel="noopener noreferrer" target="_blank">VER OFERTA</a>
      </div>
    </article>
  `;
}

function renderSection(target, deals, { empty, faction }) {
  const list = (deals || []).filter((d) => d.discountPercent > 0);
  if (!list.length) {
    target.innerHTML = `<div class="empty">${empty || "SIN OFERTAS HOY"}</div>`;
    return;
  }
  target.innerHTML = list.map((d, i) => cardHtml(d, { faction, delay: 80 * i })).join("");
}

function tickClock() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  $("#live-clock").textContent = fmt.format(now);
}

function setActiveNav() {
  const ids = ["halo", "steam", "xbox", "meta"];
  const fromTop = window.scrollY + 120;
  let current = "halo";
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= fromTop) current = id;
  }
  document.querySelectorAll(".faction").forEach((a) => {
    a.classList.toggle("is-active", a.getAttribute("href") === `#${current}`);
  });
}

async function bootSequence() {
  const log = $("#boot-log");
  for (const line of bootLines) {
    if (log) log.textContent = line;
    await new Promise((r) => setTimeout(r, 280));
  }
  $("#boot")?.classList.add("is-done");
}

async function main() {
  tickClock();
  setInterval(tickClock, 1000);
  window.addEventListener("scroll", setActiveNav, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "1") location.hash = "halo";
    if (e.key === "2") location.hash = "steam";
    if (e.key === "3") location.hash = "xbox";
    if (e.key === "4") location.hash = "meta";
  });
  bootSequence();

  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    if (!res.ok) throw new Error("deals.json missing");
    const data = await res.json();
    $("#updated-at").textContent = data.updatedAtBogota || "—";

    const current = data.sections?.halo?.currentPrice;
    $("#halo-current").innerHTML = current
      ? cardHtml(current, { faction: "halo" })
      : `<div class="empty">Precio actual: sin confirmar</div>`;

    renderSection(
      $("#halo-grid"),
      (data.sections?.halo?.deals || []).filter((d) => d.id !== data.sections?.halo?.currentPrice?.id),
      {
        empty: data.sections?.halo?.emptyMessage || "SIN OFERTAS HOY",
        faction: "halo",
      },
    );
    renderSection($("#steam-grid"), data.sections?.steamPc?.deals, {
      empty: data.sections?.steamPc?.emptyMessage,
      faction: "steam",
    });
    renderSection($("#xbox-grid"), data.sections?.xboxPc?.deals, {
      empty: data.sections?.xboxPc?.emptyMessage,
      faction: "xbox",
    });
    renderSection($("#meta-grid"), data.sections?.metaVr?.deals, {
      empty: data.sections?.metaVr?.emptyMessage,
      faction: "meta",
    });
  } catch (err) {
    $("#updated-at").textContent = "sin datos";
    $("#halo-grid").innerHTML =
      $("#steam-grid").innerHTML =
      $("#xbox-grid").innerHTML =
      $("#meta-grid").innerHTML =
        `<div class="empty">No se pudo leer data/deals.json</div>`;
    console.error(err);
  }
}

main();
