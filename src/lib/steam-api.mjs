import { formatBogota } from "./clock.mjs";
import { formatMoney } from "./deal.mjs";
import { DELAY_MS, fetchJson, sleep } from "./http.mjs";

export const STEAM_CC = "co";

export function steamMajor(minorUnits) {
  if (minorUnits == null) return null;
  return Number(minorUnits) / 100;
}

export function isSteamVrTitle(data) {
  const cats = data.categories || [];
  return cats.some(
    (c) =>
      c.id === 54 ||
      c.id === 31 ||
      /vr|\brv\b|realidad virtual|steamvr/i.test(c.description || ""),
  );
}

export function kindFromSteamType(type, name = "") {
  const n = `${type} ${name}`.toLowerCase();
  if (n.includes("bundle") || (n.includes("pack") && n.includes("collection"))) return "bundle";
  if (type === "dlc" || n.includes("dlc") || n.includes("pack") || n.includes("season pass")) return "dlc";
  return "base";
}

export function steamDealFromApp(appId, data, extra = {}) {
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

export async function steamAppDetails(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${STEAM_CC}&l=spanish`;
  const r = await fetchJson(url);
  await sleep(DELAY_MS);
  if (!r.ok) return { appId, ok: false, reason: r.status || r.error };
  const entry = r.data?.[String(appId)];
  if (!entry?.success || !entry.data) return { appId, ok: false, reason: "no-data" };
  return { appId, ok: true, data: entry.data };
}

export async function steamSearchSpecials(params) {
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
