const PAGE_SIZE = 12;
const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

function params() {
  const q = new URLSearchParams(location.search);
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [hashId, hashPage] = hash.split("/");
  const id = q.get("id") || hashId || "";
  const page = Math.max(1, Number(q.get("p") || hashPage) || 1);
  return { id, page };
}

function setPage(id, page) {
  const next = page <= 1 ? `#${id}` : `#${id}/${page}`;
  history.replaceState(null, "", next);
}

function pagerHtml(id, page, totalPages) {
  if (totalPages <= 1) return "";
  const prevDisabled = page <= 1 ? "disabled" : "";
  const nextDisabled = page >= totalPages ? "disabled" : "";
  const nums = [];
  for (let n = 1; n <= totalPages; n += 1) {
    nums.push(
      `<button type="button" class="page-num${n === page ? " is-active" : ""}" data-page="${n}">${n}</button>`,
    );
  }
  return `
    <nav class="pager" aria-label="Páginas">
      <button type="button" data-page="${page - 1}" ${prevDisabled}>Anterior</button>
      <div class="page-nums">${nums.join("")}</div>
      <button type="button" data-page="${page + 1}" ${nextDisabled}>Siguiente</button>
    </nav>
  `;
}

function bindPager(root, id, page, totalPages, render) {
  root.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.getAttribute("data-page"));
      if (!next || next < 1 || next > totalPages || next === page) return;
      setPage(id, next);
      render(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function renderStore(data, page) {
  const deals = data.deals || [];
  const totalPages = Math.max(1, Math.ceil(deals.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = deals.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const faction = data.accent || data.id;
  const empty = data.emptyMessage || "Sin ofertas hoy";

  document.body.dataset.accent = data.accent || "";
  document.title = `${data.name} // Ofertas verificadas`;
  $("#store-kicker").textContent = data.kicker || "";
  $("#store-title").textContent = data.name;
  $("#store-lede").textContent = data.blurb || "";
  $("#official-link").href = data.officialUrl || "#";
  $("#deal-count").textContent =
    data.status === "deferred"
      ? "Sin precios verificados"
      : deals.length
        ? `${deals.length} ofertas`
        : "Sin ofertas hoy";

  const spot = $("#store-spotlight");
  if (data.spotlight) {
    spot.hidden = false;
    spot.innerHTML = cardHtml(data.spotlight, { faction: "halo" });
  } else {
    spot.hidden = true;
    spot.innerHTML = "";
  }

  const grid = $("#store-grid");
  if (!deals.length) {
    grid.innerHTML = `<div class="empty">${escapeHtml(empty)}</div>`;
  } else {
    grid.innerHTML = slice.map((d, i) => cardHtml(d, { faction, delay: 60 * i })).join("");
  }

  const top = $("#pager-top");
  const bottom = $("#pager-bottom");
  const html = pagerHtml(data.id, safePage, totalPages);
  top.innerHTML = html;
  bottom.innerHTML = html;
  bindPager(top, data.id, safePage, totalPages, (p) => renderStore(data, p));
  bindPager(bottom, data.id, safePage, totalPages, (p) => renderStore(data, p));

  const range = $("#page-range");
  if (range && deals.length) {
    const from = (safePage - 1) * PAGE_SIZE + 1;
    const to = Math.min(safePage * PAGE_SIZE, deals.length);
    range.textContent = `${from}–${to} de ${deals.length}`;
  } else if (range) {
    range.textContent = "";
  }
}

async function main() {
  startHudClock();
  const { id, page } = params();
  bootSequence([
    `handshake://docs/data/stores/${id || "—"}.json`,
    "one store payload // no full catalog",
    "visor calibration // America/Bogota",
  ]);

  if (!ID_RE.test(id)) {
    $("#updated-at").textContent = "sin datos";
    $("#store-title").textContent = "Tienda no válida";
    $("#store-lede").textContent = "Falta el id de tienda en la URL (#steam) o no es seguro.";
    $("#store-grid").innerHTML = `<div class="empty">Vuelve al mapa de tiendas</div>`;
    return;
  }

  try {
    const res = await fetch(`./data/stores/${id}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error("store json missing");
    const data = await res.json();
    $("#updated-at").textContent = data.updatedAtBogota || "—";
    renderStore(data, page);
  } catch (err) {
    $("#updated-at").textContent = "sin datos";
    $("#store-grid").innerHTML = `<div class="empty">No se pudo leer data/stores/${escapeHtml(id)}.json</div>`;
    console.error(err);
  }
}

main();
