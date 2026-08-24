#!/usr/bin/env node
/**
 * Fetches verified store prices. Never invents amounts.
 * If a source cannot be confirmed, the game is omitted or marked unconfirmed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = JSON.parse(readFileSync(join(ROOT, "scripts/catalog.json"), "utf8"));
const DOCS_JSON = join(ROOT, "docs/data/deals.json");
const ROOT_JSON = join(ROOT, "data/deals.json");
const DEALS_MD = join(ROOT, "DEALS.md");
const NEW_JSON = join(ROOT, "data/new-deals.json");

const UA = {
  "User-Agent":
    "cheap-games-deals/1.0 (+https://github.com; public price check; not a scraper farm)",
  Accept: "application/json,text/html;q=0.9",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
};

const STEAM_CC = "co";
const MS_MARKET = "CO";
const DELAY_MS = 700;
const BOGOTA = "America/Bogota";

const XBOX_PUBLISHER_RE = new RegExp(CATALOG.xboxPublisherPattern, "i");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowBogotaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    stamp: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
  };
}

function formatBogota(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return nowBogotaParts(d).stamp;
}

function isRealSaleEnd(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  if (year >= 2090) return false;
  const soon = Date.now() + 1000 * 60 * 60 * 24 * 400;
  return d.getTime() < soon;
}

function formatMoney(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

function steamMajor(minorUnits) {
  if (minorUnits == null) return null;
  return Number(minorUnits) / 100;
}

function fingerprint(deal) {
  return [deal.platform, deal.id, deal.priceCurrent, deal.currency].join("::");
}

async function fetchText(url, { json = false, retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: UA, redirect: "follow" });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1200 * (i + 1));
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, text, url: res.url };
      return {
        ok: true,
        status: res.status,
        url: res.url,
        text,
        json: json ? JSON.parse(text) : undefined,
      };
    } catch (err) {
      lastErr = err;
      await sleep(800 * (i + 1));
    }
  }
  return { ok: false, status: 0, error: String(lastErr?.message || lastErr) };
}

async function fetchJson(url) {
  const r = await fetchText(url, { json: true });
  if (!r.ok) return r;
  return { ...r, data: r.json };
}

function previousDeals() {
  const path = existsSync(DOCS_JSON) ? DOCS_JSON : existsSync(ROOT_JSON) ? ROOT_JSON : null;
  if (!path) return { fingerprints: new Set(), payload: null };
  try {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    const all = [
      ...(payload.sections?.halo?.deals || []),
      ...(payload.sections?.halo?.currentPrice ? [payload.sections.halo.currentPrice] : []),
      ...(payload.sections?.xboxPc?.deals || []),
      ...(payload.sections?.steamPc?.deals || []),
      ...(payload.sections?.metaVr?.deals || []),
    ];
    return { fingerprints: new Set(all.filter((d) => d?.id).map(fingerprint)), payload };
  } catch {
    return { fingerprints: new Set(), payload: null };
  }
}

function isSteamVrTitle(data) {
  const cats = data.categories || [];
  return cats.some(
    (c) =>
      c.id === 54 ||
      c.id === 31 ||
      /vr|\brv\b|realidad virtual|steamvr/i.test(c.description || ""),
  );
}

function kindFromSteamType(type, name = "") {
  const n = `${type} ${name}`.toLowerCase();
  if (n.includes("bundle") || n.includes("pack") && n.includes("collection")) return "bundle";
  if (type === "dlc" || n.includes("dlc") || n.includes("pack") || n.includes("season pass")) return "dlc";
  return "base";
}

function steamDealFromApp(appId, data, extra = {}) {
  const price = data.price_overview;
  if (!price) return null;
  const current = steamMajor(price.final);
  const previous = steamMajor(price.initial);
  const discount = Number(price.discount_percent) || 0;
  return {
    id: `steam-${appId}`,
    storeId: String(appId),
    name: data.name,
    platform: extra.platform || "Steam PC",
    kind: extra.kind || kindFromSteamType(data.type, data.name),
    priceCurrent: current,
    pricePrevious: previous,
    discountPercent: discount,
    currency: price.currency || "COP",
    priceCurrentLabel: price.final_formatted || formatMoney(current, price.currency),
    pricePreviousLabel: price.initial_formatted || formatMoney(previous, price.currency),
    dealEndsAt: extra.dealEndsAt || null,
    dealEndsAtBogota: extra.dealEndsAt ? formatBogota(extra.dealEndsAt) : null,
    url: `https://store.steampowered.com/app/${appId}/`,
    image: data.header_image || null,
    confirmed: true,
    sources: extra.sources || ["steam-appdetails"],
    publisher: data.publishers?.[0] || extra.publisher || null,
  };
}

async function steamAppDetails(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${STEAM_CC}&l=spanish`;
  const r = await fetchJson(url);
  await sleep(DELAY_MS);
  if (!r.ok) return { appId, ok: false, reason: r.status || r.error };
  const entry = r.data?.[String(appId)];
  if (!entry?.success || !entry.data) return { appId, ok: false, reason: "no-data" };
  return { appId, ok: true, data: entry.data };
}

async function steamSearchSpecials(params) {
  const ids = new Set();
  for (let start = 0; start < 100; start += 50) {
    const qs = new URLSearchParams({
      query: "",
      start: String(start),
      count: "50",
      specials: "1",
      infinite: "1",
      cc: STEAM_CC,
      l: "spanish",
      ...params,
    });
    const url = `https://store.steampowered.com/search/results/?${qs}`;
    const r = await fetchJson(url);
    await sleep(DELAY_MS);
    if (!r.ok || !r.data?.results_html) break;
    const pageIds = [...r.data.results_html.matchAll(/data-ds-appid="(\d+)"/g)].map((m) => m[1]);
    pageIds.forEach((id) => ids.add(id));
    if (pageIds.length < 50) break;
  }
  return [...ids];
}

async function collectHalo() {
  const deals = [];
  const tmcc = await steamAppDetails(CATALOG.halo.steamAppId);
  let currentPrice = null;
  if (tmcc.ok) {
    const deal = steamDealFromApp(tmcc.appId, tmcc.data, {
      kind: "base",
      sources: ["steam-appdetails", "steam-store"],
    });
    if (deal) {
      currentPrice = { ...deal, onSale: deal.discountPercent > 0 };
      if (deal.discountPercent > 0) deals.push(deal);
    }
    if (CATALOG.halo.includeDlc && Array.isArray(tmcc.data.dlc)) {
      for (const dlcId of tmcc.data.dlc) {
        const dlc = await steamAppDetails(dlcId);
        if (!dlc.ok) continue;
        const row = steamDealFromApp(dlc.appId, dlc.data, {
          kind: "dlc",
          sources: ["steam-appdetails", "steam-dlc-list"],
        });
        if (row && row.discountPercent > 0) deals.push(row);
      }
    }
  }
  return { currentPrice, deals };
}

async function collectSteamPc() {
  const found = new Set((CATALOG.steamWatchlist || []).map(String));
  for (const publisher of CATALOG.xboxSteamPublishers) {
    const ids = await steamSearchSpecials({ publisher });
    ids.forEach((id) => found.add(id));
  }
  const deals = [];
  for (const appId of found) {
    if (String(appId) === String(CATALOG.halo.steamAppId)) continue;
    const app = await steamAppDetails(appId);
    if (!app.ok) continue;
    const pubs = (app.data.publishers || []).join(" ");
    const devs = (app.data.developers || []).join(" ");
    if (!XBOX_PUBLISHER_RE.test(`${pubs} ${devs}`)) continue;
    const row = steamDealFromApp(app.appId, app.data, {
      sources: ["steam-appdetails", "steam-search-specials", "steam-watchlist"],
      publisher: pubs,
    });
    if (row && row.discountPercent > 0) deals.push(row);
  }
  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  const seen = new Set();
  return deals.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

function xboxImage(product) {
  const images = product.LocalizedProperties?.[0]?.Images || product.Images || [];
  const preferred =
    images.find((i) => /superhero|poster|boxart|tiled/i.test(i.ImagePurpose || "")) || images[0];
  return preferred?.Uri || preferred?.url || null;
}

function xboxPurchaseCandidates(product) {
  const rows = [];
  for (const sku of product.DisplaySkuAvailabilities || []) {
    const skuName = sku.Sku?.LocalizedProperties?.[0]?.SkuTitle || sku.Sku?.SkuId;
    for (const avail of sku.Availabilities || []) {
      const price = avail.OrderManagementData?.Price;
      const platforms = avail.Conditions?.ClientConditions?.AllowedPlatforms?.map((p) => p.PlatformName) || [];
      const actions = avail.Actions || [];
      if (!price || !actions.includes("Purchase")) continue;
      if (!platforms.includes("Windows.Desktop") && platforms.length) continue;
      if (!(price.ListPrice > 0)) continue;
      rows.push({
        list: price.ListPrice,
        msrp: price.MSRP,
        currency: price.CurrencyCode,
        end: avail.Conditions?.EndDate,
        platforms,
        skuName,
        rank: avail.DisplayRank ?? 99,
      });
    }
  }
  return rows;
}

function pickXboxDeal(product, productId) {
  const loc = product.LocalizedProperties?.[0] || {};
  const publisher = loc.PublisherName || "";
  if (publisher && !XBOX_PUBLISHER_RE.test(publisher) && !XBOX_PUBLISHER_RE.test(loc.DeveloperName || "")) {
    return null;
  }
  const paid = xboxPurchaseCandidates(product);
  if (!paid.length) return null;
  const discounted = paid.filter((p) => p.msrp > 0 && p.list < p.msrp);
  if (!discounted.length) return null;
  discounted.sort((a, b) => a.list - b.list || a.rank - b.rank);
  const best = discounted[0];
  const discount = Math.round((1 - best.list / best.msrp) * 100);
  if (discount <= 0) return null;
  const title = loc.ProductTitle || productId;
  const kind = /bundle|pack|edition|deluxe|premium|ultimate/i.test(title) ? "bundle" : "base";
  if (/dlc|complemento|expans|pass/i.test(title)) {
    /* keep as dlc when it is clearly not a base game */
  }
  const dealEndsAt = isRealSaleEnd(best.end) ? best.end : null;
  return {
    id: `xboxpc-${productId}`,
    storeId: productId,
    name: title,
    platform: "Xbox PC",
    kind: /dlc|complemento|expans/i.test(title) ? "dlc" : kind,
    priceCurrent: best.list,
    pricePrevious: best.msrp,
    discountPercent: discount,
    currency: best.currency || "COP",
    priceCurrentLabel: formatMoney(best.list, best.currency),
    pricePreviousLabel: formatMoney(best.msrp, best.currency),
    dealEndsAt,
    dealEndsAtBogota: dealEndsAt ? formatBogota(dealEndsAt) : null,
    url: `https://www.microsoft.com/store/productId/${productId}?rtc=1`,
    image: xboxImage(product),
    confirmed: true,
    sources: ["ms-display-catalog", "ms-store-search"],
    publisher,
    playAnywhere: (best.platforms || []).includes("Windows.Xbox"),
  };
}

async function msSearch(query) {
  const url =
    "https://storeedgefd.dsx.mp.microsoft.com/v9.0/search?query=" +
    encodeURIComponent(query) +
    `&market=${MS_MARKET}&locale=es-CO&deviceFamily=Windows.Desktop`;
  const r = await fetchJson(url);
  await sleep(400);
  if (!r.ok) return [];
  return r.data?.Payload?.SearchResults || [];
}

async function msCatalog(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = [];
  for (let i = 0; i < unique.length; i += 12) {
    const chunk = unique.slice(i, i + 12);
    const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${chunk.join(",")}&market=${MS_MARKET}&languages=es-CO`;
    const r = await fetchJson(url);
    await sleep(DELAY_MS);
    if (r.ok && Array.isArray(r.data?.Products)) out.push(...r.data.Products);
  }
  return out;
}

async function collectXboxMicrosoft() {
  const ids = new Set();
  if (CATALOG.halo.msId) ids.add(CATALOG.halo.msId);
  for (const q of CATALOG.xboxMsQueries) {
    const cards = await msSearch(q);
    for (const card of cards.slice(0, 8)) {
      const publisher = card.PublisherName || "";
      if (publisher && !XBOX_PUBLISHER_RE.test(publisher)) continue;
      if (card.ProductId) ids.add(card.ProductId);
    }
  }
  const products = await msCatalog([...ids]);
  const deals = [];
  for (const product of products) {
    const id = product.ProductId || product.AlternateIds?.find((a) => a.IdType === "LegacyXboxProductId")?.Value;
    const pid = product.ProductId || id;
    if (!pid) continue;
    const row = pickXboxDeal(product, pid);
    if (row) deals.push(row);
  }
  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  const seen = new Set();
  return deals.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

function parseMetaPriceFromHtml(html) {
  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  for (const block of ldBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const offers = data.offers || data["@graph"]?.find((n) => n.offers)?.offers;
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (offer?.price != null) {
        const current = Number(offer.price);
        const currency = offer.priceCurrency || "USD";
        const previous = offer.highPrice != null ? Number(offer.highPrice) : null;
        if (!Number.isFinite(current)) continue;
        return { current, previous, currency, confirmed: true };
      }
    } catch {
      /* ignore malformed json-ld */
    }
  }
  return null;
}

async function collectMeta() {
  const deals = [];
  const steamIds = new Set();

  for (const item of CATALOG.metaCatalog) {
    if (item.steamAppId) steamIds.add(String(item.steamAppId));
    if (!item.questUrl) continue;
    const page = await fetchText(item.questUrl);
    await sleep(DELAY_MS);
    if (!page.ok || page.status >= 400) continue;
    const parsed = parseMetaPriceFromHtml(page.text);
    if (!parsed || parsed.previous == null || parsed.current >= parsed.previous) continue;
    const discount = Math.round((1 - parsed.current / parsed.previous) * 100);
    if (discount <= 0) continue;
    deals.push({
      id: `quest-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      storeId: item.questUrl,
      name: item.name,
      platform: "Meta Quest",
      kind: "base",
      priceCurrent: parsed.current,
      pricePrevious: parsed.previous,
      discountPercent: discount,
      currency: parsed.currency,
      priceCurrentLabel: formatMoney(parsed.current, parsed.currency),
      pricePreviousLabel: formatMoney(parsed.previous, parsed.currency),
      dealEndsAt: null,
      dealEndsAtBogota: null,
      url: item.questUrl,
      image: null,
      confirmed: true,
      sources: ["meta-store-page", "json-ld"],
    });
  }

  for (const appId of steamIds) {
    const app = await steamAppDetails(appId);
    if (!app.ok) continue;
    if (!isSteamVrTitle(app.data)) continue;
    const row = steamDealFromApp(app.appId, app.data, {
      platform: "SteamVR",
      sources: ["meta-catalog", "steam-appdetails"],
    });
    if (row && row.discountPercent > 0) deals.push(row);
  }

  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  const seen = new Set();
  return deals.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

function markNew(list, previous) {
  return (list || []).map((d) => ({
    ...d,
    isNew: d.confirmed !== false && !previous.has(fingerprint(d)),
  }));
}

function toMd(payload) {
  const lines = [
    `# Ofertas — ${payload.updatedAtBogota} (Bogotá)`,
    "",
    `Última actualización: **${payload.updatedAtBogota}** (${payload.timezone}).`,
    "Solo precios verificados. Si una ficha no se pudo confirmar, no aparece.",
    "",
  ];

  const haloPrice = payload.sections.halo.currentPrice;
  lines.push("## Halo: The Master Chief Collection");
  if (haloPrice) {
    const tag = haloPrice.onSale ? `-${haloPrice.discountPercent}%` : "sin oferta";
    lines.push(
      `- Precio actual (${tag}): **${haloPrice.priceCurrentLabel}** · [Steam](${haloPrice.url})`,
    );
  } else {
    lines.push("- Precio actual: sin confirmar");
  }
  if (!payload.sections.halo.deals.length) lines.push("- Sin ofertas hoy (DLC/packs).");
  for (const d of payload.sections.halo.deals) {
    lines.push(
      `- ${d.isNew ? "🆕 " : ""}**${d.name}** (${d.platform}, ${d.kind}) — ${d.priceCurrentLabel} ~~${d.pricePreviousLabel}~~ (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
    );
  }

  lines.push("", "## Steam PC (Xbox / Bethesda / Game Studios)");
  if (!payload.sections.steamPc?.deals?.length) lines.push("- Sin ofertas hoy");
  for (const d of payload.sections.steamPc?.deals || []) {
    lines.push(
      `- ${d.isNew ? "🆕 " : ""}**${d.name}** (${d.platform}, ${d.kind}) — ${d.priceCurrentLabel} ~~${d.pricePreviousLabel}~~ (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
    );
  }

  lines.push("", "## Xbox en PC (Microsoft Store)");
  if (!payload.sections.xboxPc.deals.length) lines.push("- Sin ofertas hoy");
  for (const d of payload.sections.xboxPc.deals) {
    lines.push(
      `- ${d.isNew ? "🆕 " : ""}**${d.name}** (${d.platform}, ${d.kind}) — ${d.priceCurrentLabel} ~~${d.pricePreviousLabel}~~ (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
    );
  }

  lines.push("", "## Meta VR (Quest + SteamVR)");
  if (!payload.sections.metaVr.deals.length) lines.push("- Sin ofertas hoy");
  for (const d of payload.sections.metaVr.deals) {
    lines.push(
      `- ${d.isNew ? "🆕 " : ""}**${d.name}** (${d.platform}, ${d.kind}) — ${d.priceCurrentLabel} ~~${d.pricePreviousLabel}~~ (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function maybeOpenIssue(payload, newDeals) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo || !newDeals.length) return { opened: false, reason: "skip" };
  const title = `Ofertas — ${payload.updatedAtDate}`;
  const listRes = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=20&labels=ofertas`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
  );
  if (listRes.ok) {
    const open = await listRes.json();
    if (Array.isArray(open) && open.some((i) => i.title === title)) {
      return { opened: false, reason: "exists" };
    }
  }
  const body = [
    `Nuevas ofertas verificadas vs la corrida anterior (${payload.updatedAtBogota} Bogotá).`,
    "",
    ...newDeals.map(
      (d) =>
        `- **${d.name}** · ${d.platform} · ${d.priceCurrentLabel} (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
    ),
    "",
    "Fuente pública: GitHub Pages de este repo.",
  ].join("\n");
  const created = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels: ["ofertas"] }),
  });
  if (created.status === 422) {
    const retry = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body }),
    });
    return { opened: retry.ok, status: retry.status };
  }
  return { opened: created.ok, status: created.status };
}

async function main() {
  console.log("Fetching verified deals (COP / Bogotá)...");
  const prev = previousDeals();
  const halo = await collectHalo();
  const steamPc = await collectSteamPc();
  const xboxMs = await collectXboxMicrosoft();
  const metaVr = await collectMeta();

  const clock = nowBogotaParts();
  const haloDeals = markNew(halo.deals, prev.fingerprints);
  const steamDeals = markNew(steamPc, prev.fingerprints);
  const xboxDeals = markNew(xboxMs, prev.fingerprints);
  const metaDeals = markNew(metaVr, prev.fingerprints);
  if (halo.currentPrice) {
    halo.currentPrice = markNew([halo.currentPrice], prev.fingerprints)[0];
  }

  const seenSteam = new Set();
  const steamPcDeals = steamDeals.filter((d) => (seenSteam.has(d.id) ? false : seenSteam.add(d.id)));
  const seenXbox = new Set();
  const xboxPcDeals = xboxDeals.filter((d) => (seenXbox.has(d.id) ? false : seenXbox.add(d.id)));

  const payload = {
    updatedAt: new Date().toISOString(),
    updatedAtBogota: clock.stamp,
    updatedAtDate: clock.date,
    timezone: BOGOTA,
    currencyPreference: "COP",
    notes: [
      "Precios tomados de APIs/páginas públicas. Nada inventado.",
      "Meta Quest Store a menudo bloquea lecturas automáticas; si no hay ficha verificada, la sección queda vacía o solo SteamVR.",
    ],
    sections: {
      halo: {
        title: "Halo: The Master Chief Collection",
        emptyMessage: "Sin DLC/packs en oferta hoy",
        currentPrice: halo.currentPrice,
        deals: haloDeals,
      },
      xboxPc: {
        title: "Xbox en PC",
        emptyMessage: "Sin ofertas hoy",
        deals: xboxPcDeals,
      },
      steamPc: {
        title: "Steam PC",
        emptyMessage: "Sin ofertas hoy",
        deals: steamPcDeals,
      },
      metaVr: {
        title: "Meta VR",
        emptyMessage: "Sin ofertas hoy",
        deals: metaDeals,
      },
    },
  };

  const saleDeals = [
    ...haloDeals,
    ...steamPcDeals,
    ...xboxPcDeals,
    ...metaDeals,
  ].filter((d) => d.discountPercent > 0 && d.isNew);

  mkdirSync(join(ROOT, "docs/data"), { recursive: true });
  mkdirSync(join(ROOT, "data"), { recursive: true });
  const json = JSON.stringify(payload, null, 2) + "\n";
  writeFileSync(DOCS_JSON, json);
  writeFileSync(ROOT_JSON, json);
  writeFileSync(DEALS_MD, toMd(payload));
  writeFileSync(NEW_JSON, JSON.stringify({ generatedAt: payload.updatedAtBogota, deals: saleDeals }, null, 2) + "\n");

  const issue = await maybeOpenIssue(payload, saleDeals);
  console.log(
    JSON.stringify(
      {
        haloCurrent: halo.currentPrice?.priceCurrentLabel || null,
        haloDeals: haloDeals.length,
        steamPc: steamPcDeals.length,
        xboxPc: xboxPcDeals.length,
        metaVr: metaDeals.length,
        newDeals: saleDeals.length,
        issue,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
