#!/usr/bin/env node
/**
 * Fetches verified store prices. Never invents amounts.
 * Each live store has its own collector under src/collectors.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectors } from "../src/collectors/index.mjs";
import { BOGOTA, nowBogotaParts } from "../src/lib/clock.mjs";
import { markNew, uniqueById } from "../src/lib/deal.mjs";
import { CONFIG_DIR, DEALS_MD, DOCS_JSON, ROOT_JSON } from "../src/lib/paths.mjs";
import { maybeOpenIssue } from "../src/write/github-issue.mjs";
import { toMd } from "../src/write/markdown.mjs";
import { loadPrevious, writeOutputs, writeStoreOutputs } from "../src/write/pages.mjs";

const STORES = JSON.parse(readFileSync(join(CONFIG_DIR, "stores.json"), "utf8"));
const CATALOG = JSON.parse(readFileSync(join(CONFIG_DIR, "catalog.json"), "utf8"));

function sectionsFromStores(storeResults) {
  const steam = storeResults.steam || { deals: [], spotlight: null, sections: {} };
  const xbox = storeResults.xbox || { deals: [] };
  const steamvr = storeResults.steamvr || { deals: [] };
  const quest = storeResults["meta-quest"] || { deals: [] };
  return {
    halo: {
      title: "Halo: The Master Chief Collection",
      emptyMessage: "Sin DLC/packs en oferta hoy",
      currentPrice: steam.spotlight || null,
      deals: steam.sections?.haloDeals || [],
    },
    xboxPc: {
      title: "Xbox en PC",
      emptyMessage: "Sin ofertas hoy",
      deals: xbox.deals || [],
    },
    steamPc: {
      title: "Steam PC",
      emptyMessage: "Sin ofertas hoy",
      deals: steam.sections?.steamPcDeals || steam.deals || [],
    },
    metaVr: {
      title: "Meta VR",
      emptyMessage: "Sin ofertas hoy",
      deals: [...(steamvr.deals || []), ...(quest.deals || [])],
    },
  };
}

async function collectLiveStores(ctx, previous) {
  const results = {};
  for (const store of STORES) {
    if (store.status !== "live") {
      results[store.id] = { deals: [], spotlight: null };
      continue;
    }
    const collect = collectors[store.id];
    if (!collect) {
      results[store.id] = { deals: [], spotlight: null };
      continue;
    }
    const raw = await collect(ctx);
    const deals = markNew(uniqueById(raw.deals || []), previous);
    const spotlight = raw.spotlight ? markNew([raw.spotlight], previous)[0] : null;
    results[store.id] = {
      deals,
      spotlight,
      sections: raw.sections || {},
    };
    if (raw.sections?.haloDeals) {
      results[store.id].sections.haloDeals = markNew(raw.sections.haloDeals, previous);
    }
    if (raw.sections?.steamPcDeals) {
      results[store.id].sections.steamPcDeals = markNew(raw.sections.steamPcDeals, previous);
    }
  }
  return results;
}

function storesSlice(results) {
  const out = {};
  for (const store of STORES) {
    const slice = results[store.id] || { deals: [], spotlight: null };
    out[store.id] = { deals: slice.deals || [], spotlight: slice.spotlight || null };
  }
  return out;
}

async function main() {
  if (process.argv.includes("--from-existing")) {
    const path = existsSync(DOCS_JSON) ? DOCS_JSON : existsSync(ROOT_JSON) ? ROOT_JSON : null;
    if (!path) {
      throw new Error("No hay deals.json para partir por tienda. Corre npm run deals primero.");
    }
    const payload = JSON.parse(readFileSync(path, "utf8"));
    const index = writeStoreOutputs(payload, STORES);
    writeFileSync(DEALS_MD, toMd(payload, STORES));
    console.log(
      JSON.stringify(
        {
          mode: "from-existing",
          liveDealCount: index.liveDealCount,
          stores: index.stores.map((s) => ({ id: s.id, status: s.status, dealCount: s.dealCount })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("Fetching verified deals (COP / Bogotá)...");
  const prev = loadPrevious();
  const ctx = { catalog: CATALOG, stores: STORES };
  const collected = await collectLiveStores(ctx, prev.fingerprints);
  const clock = nowBogotaParts();

  const payload = {
    updatedAt: new Date().toISOString(),
    updatedAtBogota: clock.stamp,
    updatedAtDate: clock.date,
    timezone: BOGOTA,
    currencyPreference: "COP",
    notes: [
      "Precios tomados de APIs/páginas públicas. Nada inventado.",
      "Meta Quest Store a menudo bloquea lecturas automáticas; si no hay ficha verificada, la sección queda vacía.",
    ],
    stores: storesSlice(collected),
    sections: sectionsFromStores(collected),
  };

  const saleDeals = Object.values(payload.stores)
    .flatMap((slice) => slice.deals || [])
    .filter((d) => d.discountPercent > 0 && d.isNew);

  const index = writeOutputs(payload, saleDeals, STORES);
  const issue = await maybeOpenIssue(payload, saleDeals);
  console.log(
    JSON.stringify(
      {
        haloCurrent: payload.stores.steam?.spotlight?.priceCurrentLabel || null,
        liveDealCount: index.liveDealCount,
        stores: index.stores.map((s) => ({ id: s.id, dealCount: s.dealCount })),
        newDeals: saleDeals.length,
        issue,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
