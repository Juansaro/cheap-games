import { uniqueById } from "../lib/deal.mjs";
import { isSteamVrTitle, steamAppDetails, steamDealFromApp } from "../lib/steam-api.mjs";

export async function collect({ catalog }) {
  const steamIds = new Set(
    (catalog.metaCatalog || []).filter((item) => item.steamAppId).map((item) => String(item.steamAppId)),
  );
  const deals = [];
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
  return { deals: uniqueById(deals), spotlight: null };
}
