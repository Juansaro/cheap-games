#!/usr/bin/env node
/**
 * Seed SQLite from the current official store JSON slices in docs/data/stores.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nowBogotaParts } from "../src/lib/clock.mjs";
import { STORES_DIR } from "../src/lib/paths.mjs";
import { openDb, replaceShopListings, setMeta } from "./db.mjs";

openDb();

const clock = nowBogotaParts();
const updatedAt = new Date().toISOString();

if (!existsSync(STORES_DIR)) {
  throw new Error(`No existe ${STORES_DIR}. Corre npm run deals:split primero.`);
}

let shops = 0;
let rows = 0;
for (const name of readdirSync(STORES_DIR)) {
  if (!name.endsWith(".json")) continue;
  const file = JSON.parse(readFileSync(join(STORES_DIR, name), "utf8"));
  const source = (file.sources && file.sources[0]) || "official";
  replaceShopListings(file.id, source, file.deals || [], {
    spotlight: file.spotlight || null,
    updatedAt: file.updatedAt || updatedAt,
  });
  shops += 1;
  rows += (file.deals || []).length + (file.spotlight ? 1 : 0);
}

setMeta("updatedAt", updatedAt);
setMeta("updatedAtBogota", clock.stamp);
setMeta("updatedAtDate", clock.date);
setMeta("timezone", "America/Bogota");

console.log(
  JSON.stringify(
    {
      mode: "seed",
      shops,
      rows,
      updatedAtBogota: clock.stamp,
    },
    null,
    2,
  ),
);
