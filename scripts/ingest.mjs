#!/usr/bin/env node
/**
 * VM ingest: official + unofficial collectors into SQLite.
 * Does not write GitHub Pages JSON (that remains scripts/fetch-deals.mjs).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectors } from "../src/collectors/index.mjs";
import { nowBogotaParts } from "../src/lib/clock.mjs";
import { uniqueById } from "../src/lib/deal.mjs";
import { CONFIG_DIR } from "../src/lib/paths.mjs";
import { openDb, replaceShopListings, setMeta } from "../server/db.mjs";

const STORES = JSON.parse(readFileSync(join(CONFIG_DIR, "stores.json"), "utf8"));
const CATALOG = JSON.parse(readFileSync(join(CONFIG_DIR, "catalog.json"), "utf8"));

openDb();

async function main() {
  const clock = nowBogotaParts();
  const updatedAt = new Date().toISOString();
  const ctx = { catalog: CATALOG, stores: STORES };
  const summary = [];

  for (const store of STORES) {
    const source = (store.sources || ["official"])[0];
    if (store.status !== "live") {
      replaceShopListings(store.id, source, [], { updatedAt });
      summary.push({ id: store.id, source, dealCount: 0, status: store.status });
      continue;
    }
    const collect = collectors[store.id];
    if (!collect) {
      summary.push({ id: store.id, source, dealCount: 0, status: "no-collector" });
      continue;
    }
    console.log(`collect ${store.id} (${source})...`);
    const raw = await collect(ctx);
    const deals = uniqueById(raw.deals || []);
    replaceShopListings(store.id, source, deals, {
      spotlight: raw.spotlight || null,
      updatedAt,
    });
    summary.push({ id: store.id, source, dealCount: deals.length, status: "live" });
  }

  setMeta("updatedAt", updatedAt);
  setMeta("updatedAtBogota", clock.stamp);
  setMeta("updatedAtDate", clock.date);
  setMeta("timezone", "America/Bogota");

  console.log(JSON.stringify({ mode: "ingest", updatedAtBogota: clock.stamp, stores: summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
