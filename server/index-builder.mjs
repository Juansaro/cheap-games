import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOGOTA } from "../src/lib/clock.mjs";
import { CONFIG_DIR } from "../src/lib/paths.mjs";
import { countListings, getMeta, getSpotlight } from "./db.mjs";

export function loadStores() {
  return JSON.parse(readFileSync(join(CONFIG_DIR, "stores.json"), "utf8"));
}

export function storesForSource(source) {
  return loadStores().filter((s) => (s.sources || ["official"]).includes(source));
}

export function buildIndex(source) {
  const stores = storesForSource(source);
  const updatedAt = getMeta("updatedAt", new Date().toISOString());
  const updatedAtBogota = getMeta("updatedAtBogota", "");
  const updatedAtDate = getMeta("updatedAtDate", "");
  const indexStores = stores.map((store) => {
    const dealCount = store.status === "live" ? countListings(store.id, source) : 0;
    const spotlight = store.status === "live" ? getSpotlight(store.id, source) : null;
    return {
      id: store.id,
      name: store.name,
      accent: store.accent,
      status: store.status,
      officialUrl: store.officialUrl,
      platforms: store.platforms,
      kicker: store.kicker,
      blurb: store.blurb,
      reason: store.reason || null,
      sources: store.sources || ["official"],
      href: `./store.html#${store.id}`,
      dealCount,
      spotlightLabel: spotlight?.priceCurrentLabel || null,
    };
  });
  return {
    updatedAt,
    updatedAtBogota,
    updatedAtDate,
    timezone: BOGOTA,
    source,
    liveDealCount: indexStores
      .filter((s) => s.status === "live")
      .reduce((n, s) => n + s.dealCount, 0),
    stores: indexStores,
  };
}
