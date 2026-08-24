import { uniqueById } from "../lib/deal.mjs";
import { steamAppDetails, steamDealFromApp, steamSearchSpecials } from "../lib/steam-api.mjs";

async function collectHalo(catalog) {
  const deals = [];
  const tmcc = await steamAppDetails(catalog.halo.steamAppId);
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
    if (catalog.halo.includeDlc && Array.isArray(tmcc.data.dlc)) {
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

async function collectSteamPc(catalog) {
  const publisherRe = new RegExp(catalog.xboxPublisherPattern, "i");
  const found = new Set((catalog.steamWatchlist || []).map(String));
  for (const publisher of catalog.xboxSteamPublishers) {
    const ids = await steamSearchSpecials({ publisher });
    ids.forEach((id) => found.add(id));
  }
  const deals = [];
  for (const appId of found) {
    if (String(appId) === String(catalog.halo.steamAppId)) continue;
    const app = await steamAppDetails(appId);
    if (!app.ok) continue;
    const pubs = (app.data.publishers || []).join(" ");
    const devs = (app.data.developers || []).join(" ");
    if (!publisherRe.test(`${pubs} ${devs}`)) continue;
    const row = steamDealFromApp(app.appId, app.data, {
      sources: ["steam-appdetails", "steam-search-specials", "steam-watchlist"],
      publisher: pubs,
    });
    if (row && row.discountPercent > 0) deals.push(row);
  }
  deals.sort((a, b) => b.discountPercent - a.discountPercent);
  return uniqueById(deals);
}

export async function collect({ catalog }) {
  const halo = await collectHalo(catalog);
  const steamPc = await collectSteamPc(catalog);
  const haloId = halo.currentPrice?.id;
  return {
    deals: uniqueById([
      ...steamPc,
      ...(halo.deals || []).filter((d) => d.discountPercent > 0 && d.id !== haloId),
    ]),
    spotlight: halo.currentPrice || null,
    sections: {
      haloDeals: halo.deals || [],
      steamPcDeals: steamPc,
    },
  };
}
