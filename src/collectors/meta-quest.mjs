import { formatMoney, uniqueById } from "../lib/deal.mjs";
import { DELAY_MS, fetchText, sleep } from "../lib/http.mjs";

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

export async function collect({ catalog }) {
  const deals = [];
  for (const item of catalog.metaCatalog || []) {
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
  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  return { deals: uniqueById(deals), spotlight: null };
}
