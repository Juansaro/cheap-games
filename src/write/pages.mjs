import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fingerprint } from "../lib/deal.mjs";
import {
  DEALS_MD,
  DOCS_JSON,
  INDEX_JSON,
  NEW_JSON,
  ROOT,
  ROOT_JSON,
  STORES_DIR,
} from "../lib/paths.mjs";
import { toMd } from "./markdown.mjs";
import { storeDealsFromPayload } from "./split.mjs";

export function loadPrevious() {
  const path = existsSync(DOCS_JSON) ? DOCS_JSON : existsSync(ROOT_JSON) ? ROOT_JSON : null;
  const all = [];
  let payload = null;
  if (path) {
    try {
      payload = JSON.parse(readFileSync(path, "utf8"));
      all.push(
        ...(payload.sections?.halo?.deals || []),
        ...(payload.sections?.halo?.currentPrice ? [payload.sections.halo.currentPrice] : []),
        ...(payload.sections?.xboxPc?.deals || []),
        ...(payload.sections?.steamPc?.deals || []),
        ...(payload.sections?.metaVr?.deals || []),
      );
      for (const slice of Object.values(payload.stores || {})) {
        all.push(...(slice.deals || []));
        if (slice.spotlight) all.push(slice.spotlight);
      }
    } catch {
      payload = null;
    }
  }
  if (existsSync(STORES_DIR)) {
    for (const name of readdirSync(STORES_DIR)) {
      if (!name.endsWith(".json")) continue;
      try {
        const file = JSON.parse(readFileSync(join(STORES_DIR, name), "utf8"));
        all.push(...(file.deals || []));
        if (file.spotlight) all.push(file.spotlight);
      } catch {
        /* ignore a corrupt store slice */
      }
    }
  }
  return { fingerprints: new Set(all.filter((d) => d?.id).map(fingerprint)), payload };
}

export function writeStoreOutputs(payload, stores) {
  const byStore = storeDealsFromPayload(payload);
  mkdirSync(STORES_DIR, { recursive: true });
  mkdirSync(join(ROOT, "docs/data"), { recursive: true });

  const indexStores = [];
  for (const store of stores) {
    const deals = store.status === "live" ? byStore[store.id] || [] : [];
    const spotlight =
      payload.stores?.[store.id]?.spotlight ||
      (store.id === "steam" ? payload.sections?.halo?.currentPrice || null : null);
    const file = {
      id: store.id,
      name: store.name,
      accent: store.accent,
      status: store.status,
      officialUrl: store.officialUrl,
      platforms: store.platforms,
      kicker: store.kicker,
      blurb: store.blurb,
      reason: store.reason || null,
      updatedAt: payload.updatedAt,
      updatedAtBogota: payload.updatedAtBogota,
      timezone: payload.timezone,
      emptyMessage: store.status === "deferred" ? store.reason : "Sin ofertas hoy",
      spotlight,
      deals,
    };
    writeFileSync(join(STORES_DIR, `${store.id}.json`), JSON.stringify(file, null, 2) + "\n");
    indexStores.push({
      id: store.id,
      name: store.name,
      accent: store.accent,
      status: store.status,
      officialUrl: store.officialUrl,
      platforms: store.platforms,
      kicker: store.kicker,
      blurb: store.blurb,
      reason: store.reason || null,
      href: `./store.html#${store.id}`,
      dealCount: deals.length,
      spotlightLabel: spotlight?.priceCurrentLabel || null,
    });
  }

  const index = {
    updatedAt: payload.updatedAt,
    updatedAtBogota: payload.updatedAtBogota,
    updatedAtDate: payload.updatedAtDate,
    timezone: payload.timezone,
    liveDealCount: indexStores
      .filter((s) => s.status === "live")
      .reduce((n, s) => n + s.dealCount, 0),
    stores: indexStores,
  };
  writeFileSync(INDEX_JSON, JSON.stringify(index, null, 2) + "\n");
  return index;
}

export function writeOutputs(payload, saleDeals, stores) {
  mkdirSync(join(ROOT, "docs/data"), { recursive: true });
  mkdirSync(join(ROOT, "data"), { recursive: true });
  const json = JSON.stringify(payload, null, 2) + "\n";
  writeFileSync(DOCS_JSON, json);
  writeFileSync(ROOT_JSON, json);
  const index = writeStoreOutputs(payload, stores);
  writeFileSync(DEALS_MD, toMd(payload, stores));
  writeFileSync(
    NEW_JSON,
    JSON.stringify({ generatedAt: payload.updatedAtBogota, deals: saleDeals }, null, 2) + "\n",
  );
  return index;
}
