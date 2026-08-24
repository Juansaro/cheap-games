import { formatBogota, isRealSaleEnd } from "../lib/clock.mjs";
import { formatMoney, uniqueById } from "../lib/deal.mjs";
import { DELAY_MS, fetchJson, sleep } from "../lib/http.mjs";

const MS_MARKET = "CO";

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

function pickXboxDeal(product, productId, publisherRe) {
  const loc = product.LocalizedProperties?.[0] || {};
  const publisher = loc.PublisherName || "";
  if (publisher && !publisherRe.test(publisher) && !publisherRe.test(loc.DeveloperName || "")) {
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

export async function collect({ catalog }) {
  const publisherRe = new RegExp(catalog.xboxPublisherPattern, "i");
  const ids = new Set();
  if (catalog.halo.msId) ids.add(catalog.halo.msId);
  for (const q of catalog.xboxMsQueries) {
    const cards = await msSearch(q);
    for (const card of cards.slice(0, 8)) {
      const publisher = card.PublisherName || "";
      if (publisher && !publisherRe.test(publisher)) continue;
      if (card.ProductId) ids.add(card.ProductId);
    }
  }
  const products = await msCatalog([...ids]);
  const deals = [];
  for (const product of products) {
    const id = product.ProductId || product.AlternateIds?.find((a) => a.IdType === "LegacyXboxProductId")?.Value;
    const pid = product.ProductId || id;
    if (!pid) continue;
    const row = pickXboxDeal(product, pid, publisherRe);
    if (row) deals.push(row);
  }
  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  return { deals: uniqueById(deals), spotlight: null };
}
