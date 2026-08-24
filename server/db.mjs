import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CATALOG_DB, SCHEMA_SQL } from "../src/lib/paths.mjs";

let db;

export function openDb() {
  if (db) return db;
  mkdirSync(dirname(CATALOG_DB), { recursive: true });
  db = new DatabaseSync(CATALOG_DB);
  db.exec(readFileSync(SCHEMA_SQL, "utf8"));
  return db;
}

export function setMeta(key, value) {
  openDb()
    .prepare("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, String(value ?? ""));
}

export function getMeta(key, fallback = null) {
  const row = openDb().prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

export function listingFromDeal(deal, { source, shop, spotlight = false, updatedAt }) {
  return {
    id: deal.id,
    source,
    shop,
    platform: deal.platform || null,
    name: deal.name,
    kind: deal.kind || "base",
    price_current: deal.priceCurrent ?? null,
    price_previous: deal.pricePrevious ?? null,
    discount_percent: deal.discountPercent ?? 0,
    currency: deal.currency || null,
    price_current_label: deal.priceCurrentLabel || null,
    price_previous_label: deal.pricePreviousLabel || null,
    deal_ends_at: deal.dealEndsAt || null,
    deal_ends_at_bogota: deal.dealEndsAtBogota || null,
    url: deal.url || null,
    image: deal.image || null,
    confirmed: deal.confirmed === false ? 0 : 1,
    publisher: deal.publisher || null,
    play_anywhere: deal.playAnywhere ? 1 : 0,
    game_key: deal.gameKey || null,
    is_new: deal.isNew ? 1 : 0,
    spotlight: spotlight ? 1 : 0,
    payload_json: JSON.stringify(deal),
    updated_at: updatedAt || new Date().toISOString(),
  };
}

export function dealFromRow(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      kind: row.kind,
      priceCurrent: row.price_current,
      pricePrevious: row.price_previous,
      discountPercent: row.discount_percent,
      currency: row.currency,
      priceCurrentLabel: row.price_current_label,
      pricePreviousLabel: row.price_previous_label,
      dealEndsAt: row.deal_ends_at,
      dealEndsAtBogota: row.deal_ends_at_bogota,
      url: row.url,
      image: row.image,
      confirmed: row.confirmed === 1,
      publisher: row.publisher,
      playAnywhere: row.play_anywhere === 1,
      isNew: row.is_new === 1,
    };
  }
}

const UPSERT = `
INSERT INTO listings(
  id, source, shop, platform, name, kind, price_current, price_previous, discount_percent,
  currency, price_current_label, price_previous_label, deal_ends_at, deal_ends_at_bogota,
  url, image, confirmed, publisher, play_anywhere, game_key, is_new, spotlight, payload_json, updated_at
) VALUES(
  ?, ?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON CONFLICT(id) DO UPDATE SET
  source = excluded.source,
  shop = excluded.shop,
  platform = excluded.platform,
  name = excluded.name,
  kind = excluded.kind,
  price_current = excluded.price_current,
  price_previous = excluded.price_previous,
  discount_percent = excluded.discount_percent,
  currency = excluded.currency,
  price_current_label = excluded.price_current_label,
  price_previous_label = excluded.price_previous_label,
  deal_ends_at = excluded.deal_ends_at,
  deal_ends_at_bogota = excluded.deal_ends_at_bogota,
  url = excluded.url,
  image = excluded.image,
  confirmed = excluded.confirmed,
  publisher = excluded.publisher,
  play_anywhere = excluded.play_anywhere,
  game_key = excluded.game_key,
  is_new = excluded.is_new,
  spotlight = excluded.spotlight,
  payload_json = excluded.payload_json,
  updated_at = excluded.updated_at
`;

function listingValues(row) {
  return [
    row.id,
    row.source,
    row.shop,
    row.platform,
    row.name,
    row.kind,
    row.price_current,
    row.price_previous,
    row.discount_percent,
    row.currency,
    row.price_current_label,
    row.price_previous_label,
    row.deal_ends_at,
    row.deal_ends_at_bogota,
    row.url,
    row.image,
    row.confirmed,
    row.publisher,
    row.play_anywhere,
    row.game_key,
    row.is_new,
    row.spotlight,
    row.payload_json,
    row.updated_at,
  ];
}

export function upsertListing(deal, opts) {
  const row = listingFromDeal(deal, opts);
  openDb().prepare(UPSERT).run(...listingValues(row));
}

export function replaceShopListings(shop, source, deals, { spotlight = null, updatedAt } = {}) {
  const database = openDb();
  const del = database.prepare("DELETE FROM listings WHERE shop = ? AND source = ?");
  const insert = database.prepare(UPSERT);
  database.exec("BEGIN");
  try {
    del.run(shop, source);
    for (const deal of deals || []) {
      insert.run(...listingValues(listingFromDeal(deal, { source, shop, spotlight: false, updatedAt })));
    }
    if (spotlight) {
      insert.run(
        ...listingValues(listingFromDeal(spotlight, { source, shop, spotlight: true, updatedAt })),
      );
    }
    database.exec("COMMIT");
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  }
}

export function countListings(shop, source) {
  const row = openDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM listings WHERE shop = ? AND source = ? AND spotlight = 0",
    )
    .get(shop, source);
  return Number(row?.n || 0);
}

export function getSpotlight(shop, source) {
  const row = openDb()
    .prepare("SELECT * FROM listings WHERE shop = ? AND source = ? AND spotlight = 1 LIMIT 1")
    .get(shop, source);
  return dealFromRow(row);
}

export function queryListings({ shop, source, q = "", page = 1, pageSize = 12 }) {
  const size = Math.min(48, Math.max(1, Number(pageSize) || 12));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * size;
  const needle = `%${String(q || "").trim()}%`;
  const database = openDb();
  const where = q
    ? "shop = ? AND source = ? AND (name LIKE ? OR platform LIKE ?)"
    : "shop = ? AND source = ? AND spotlight = 0";
  const params = q ? [shop, source, needle, needle] : [shop, source];
  const total = Number(
    database.prepare(`SELECT COUNT(*) AS n FROM listings WHERE ${where}`).get(...params)?.n || 0,
  );
  const rows = database
    .prepare(
      `SELECT * FROM listings WHERE ${where} ORDER BY discount_percent DESC, name ASC LIMIT ? OFFSET ?`,
    )
    .all(...params, size, offset);
  return {
    total,
    page: safePage,
    pageSize: size,
    deals: rows.map(dealFromRow),
  };
}
