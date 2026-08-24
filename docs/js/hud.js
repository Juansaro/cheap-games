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
  const art = deal.image ? `style="--art: url('${escapeHtml(deal.image)}')"` : "";
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

function tickClock() {
  const el = $("#live-clock");
  if (!el) return;
  const fmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  el.textContent = fmt.format(new Date());
}

async function bootSequence(lines) {
  const log = $("#boot-log");
  for (const line of lines || []) {
    if (log) log.textContent = line;
    await new Promise((r) => setTimeout(r, 220));
  }
  $("#boot")?.classList.add("is-done");
}

function startHudClock() {
  tickClock();
  setInterval(tickClock, 1000);
}
