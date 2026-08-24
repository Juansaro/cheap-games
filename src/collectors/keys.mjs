import { formatMoney, uniqueById } from "../lib/deal.mjs";
import { DELAY_MS, fetchText, sleep } from "../lib/http.mjs";

function queries(catalog) {
  const names = [
    ...(catalog.steamSearchTerms || []),
    ...(catalog.xboxMsQueries || []).slice(0, 12),
    ...(catalog.metaCatalog || []).map((item) => item.name),
    "Halo Master Chief Collection",
  ];
  return [...new Set(names.map((n) => String(n).trim()).filter(Boolean))].slice(0, 20);
}

function offersFromLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  const found = [];
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const graph = node["@graph"] ? node["@graph"] : [node];
        for (const item of graph) {
          const type = item["@type"];
          const types = Array.isArray(type) ? type : [type];
          if (!types.includes("Product") && !types.includes("Offer")) continue;
          const offer = item.offers || item;
          const list = Array.isArray(offer) ? offer : [offer];
          for (const o of list) {
            const price = o.price != null ? Number(o.price) : null;
            if (!Number.isFinite(price) || price <= 0) continue;
            const url = o.url || item.url;
            const name = item.name || o.name;
            if (!name || !url) continue;
            const previous =
              o.highPrice != null
                ? Number(o.highPrice)
                : o.priceValidUntil && o.priceSpecification?.price
                  ? Number(o.priceSpecification.price)
                  : null;
            found.push({
              name,
              url,
              price,
              previous: Number.isFinite(previous) && previous > price ? previous : null,
              currency: o.priceCurrency || "EUR",
            });
          }
        }
      }
    } catch {
      /* ignore malformed json-ld */
    }
  }
  return found;
}

function toDeal(row, shop, hostRe) {
  if (!hostRe.test(row.url)) return null;
  const previous = row.previous;
  const discount =
    previous && previous > row.price ? Math.round((1 - row.price / previous) * 100) : 0;
  const slug = `${shop}-${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
  return {
    id: slug,
    storeId: row.url,
    name: row.name,
    platform: shop === "eneba" ? "Eneba" : "G2A",
    kind: "base",
    priceCurrent: row.price,
    pricePrevious: previous,
    discountPercent: discount,
    currency: row.currency,
    priceCurrentLabel: formatMoney(row.price, row.currency),
    pricePreviousLabel: previous ? formatMoney(previous, row.currency) : "",
    dealEndsAt: null,
    dealEndsAtBogota: null,
    url: row.url,
    image: null,
    confirmed: true,
    sources: [`${shop}-public-page`],
  };
}

async function collectFromSearch({ catalog, shop, searchUrl, hostRe }) {
  const deals = [];
  for (const q of queries(catalog)) {
    const url = searchUrl(q);
    const page = await fetchText(url, { retries: 1 });
    await sleep(DELAY_MS + 200);
    if (!page.ok || page.status >= 400) continue;
    for (const row of offersFromLd(page.text)) {
      const deal = toDeal(row, shop, hostRe);
      if (deal) deals.push(deal);
    }
  }
  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  return { deals: uniqueById(deals), spotlight: null };
}

export async function collectEneba({ catalog }) {
  return collectFromSearch({
    catalog,
    shop: "eneba",
    hostRe: /^https:\/\/(www\.)?eneba\.com\//i,
    searchUrl: (q) =>
      `https://www.eneba.com/store/all?text=${encodeURIComponent(q)}`,
  });
}

export async function collectG2a({ catalog }) {
  return collectFromSearch({
    catalog,
    shop: "g2a",
    hostRe: /^https:\/\/(www\.)?g2a\.com\//i,
    searchUrl: (q) =>
      `https://www.g2a.com/search?query=${encodeURIComponent(q)}`,
  });
}
