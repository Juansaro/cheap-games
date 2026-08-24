const PAGE_SIZE = 12;
const ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

function params() {
  const q = new URLSearchParams(location.search);
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [hashId, hashPage] = hash.split("/");
  const id = q.get("id") || hashId || "";
  const page = Math.max(1, Number(q.get("p") || hashPage) || 1);
  const search = q.get("q") || "";
  return { id, page, search };
}

function setPage(id, page, search) {
  const url = new URL(location.href);
  if (search) url.searchParams.set("q", search);
  else url.searchParams.delete("q");
  url.hash = page <= 1 ? `#${id}` : `#${id}/${page}`;
  history.replaceState(null, "", url);
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

function bindPager(root, id, page, totalPages, search, onPage) {
  root.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.getAttribute("data-page"));
      if (!next || next < 1 || next > totalPages || next === page) return;
      setPage(id, next, search);
      onPage(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function paintStore(data, page, { clientPaginate = true, search = "", onPage } = {}) {
  const all = data.deals || [];
  const total = Number(data.total != null ? data.total : all.length);
  const pageSize = Number(data.pageSize || PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = clientPaginate
    ? all.slice((safePage - 1) * pageSize, safePage * pageSize)
    : all;
  const faction = data.accent || data.id;
  const empty = data.emptyMessage || "Sin ofertas hoy";

  document.body.dataset.accent = data.accent || "";
  document.title = `${data.name} // Ofertas verificadas`;
  $("#store-kicker").textContent = data.kicker || "";
  $("#store-title").textContent = data.name;
  $("#store-lede").textContent = data.blurb || "";
  $("#official-link").href = data.officialUrl || "#";
  $("#official-link").textContent =
    currentSource() === "unofficial" ? "Ficha en el marketplace ↗" : "Tienda oficial ↗";
  $("#deal-count").textContent =
    data.status === "deferred"
      ? "Sin precios verificados"
      : total
        ? `${total} ofertas`
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
  if (!slice.length) {
    grid.innerHTML = `<div class="empty">${escapeHtml(empty)}</div>`;
  } else {
    grid.innerHTML = slice.map((d, i) => cardHtml(d, { faction, delay: 60 * i })).join("");
  }

  const top = $("#pager-top");
  const bottom = $("#pager-bottom");
  const html = pagerHtml(data.id, safePage, totalPages);
  top.innerHTML = html;
  bottom.innerHTML = html;
  const turn = (p) => {
    if (onPage) onPage(p);
    else paintStore(data, p, { clientPaginate, search });
  };
  bindPager(top, data.id, safePage, totalPages, search, turn);
  bindPager(bottom, data.id, safePage, totalPages, search, turn);

  const range = $("#page-range");
  if (range && total) {
    const from = (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    range.textContent = `${from}–${to} de ${total}`;
  } else if (range) {
    range.textContent = "";
  }
}

async function loadStore(id, page, search) {
  const source = currentSource();
  try {
    const qs = new URLSearchParams({
      source,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search) qs.set("q", search);
    const data = await fetchApi(`/v1/stores/${id}/listings?${qs}&t=${Date.now()}`);
    if (data) return { data, from: "api" };
  } catch (err) {
    console.warn("API store fallback", err);
  }
  if (source === "unofficial") return { data: null, from: "none" };
  const res = await fetch(`./data/stores/${id}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error("store json missing");
  return { data: await res.json(), from: "static" };
}

async function main() {
  startHudClock();
  mountSourceToggle();
  const { id, page, search } = params();
  const searchInput = $("#store-search");
  if (searchInput) searchInput.value = search;
  bootSequence([
    `handshake://store/${id || "—"}`,
    `source // ${currentSource()}`,
    "visor calibration // America/Bogota",
  ]);

  if (!ID_RE.test(id)) {
    $("#updated-at").textContent = "sin datos";
    $("#store-title").textContent = "Tienda no válida";
    $("#store-lede").textContent = "Falta el id de tienda en la URL (#steam) o no es seguro.";
    $("#store-grid").innerHTML = `<div class="empty">Vuelve al mapa de tiendas</div>`;
    return;
  }

  const render = async (nextPage) => {
    const q = searchInput?.value?.trim() || "";
    setPage(id, nextPage, q);
    const loaded = await loadStore(id, nextPage, q);
    if (!loaded.data) {
      $("#updated-at").textContent = "sin backend";
      $("#store-grid").innerHTML =
        `<div class="empty">El carril Keys necesita la API de la VM.</div>`;
      return;
    }
    $("#updated-at").textContent = loaded.data.updatedAtBogota || "—";
    paintStore(loaded.data, loaded.from === "api" ? loaded.data.page || nextPage : nextPage, {
      clientPaginate: loaded.from !== "api",
      search: q,
      onPage: loaded.from === "api" ? (p) => render(p) : null,
    });
  };

  if (searchInput) {
    searchInput.addEventListener("change", () => render(1));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        render(1);
      }
    });
  }

  try {
    await render(page);
  } catch (err) {
    $("#updated-at").textContent = "sin datos";
    $("#store-grid").innerHTML = `<div class="empty">No se pudo leer la tienda ${escapeHtml(id)}</div>`;
    console.error(err);
  }
}

main();
