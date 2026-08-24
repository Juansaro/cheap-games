#!/usr/bin/env node
import { createServer } from "node:http";
import { loadStores, storesForSource, buildIndex } from "./index-builder.mjs";
import { getMeta, getSpotlight, openDb, queryListings } from "./db.mjs";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ORIGINS = (process.env.CORS_ORIGINS ||
  "https://juansaro.github.io,http://localhost:4173,http://127.0.0.1:4173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

openDb();

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", ORIGINS[0] || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function notFound(res) {
  json(res, 404, { error: "not_found" });
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function sourceOf(url) {
  const raw = url.searchParams.get("source") || "official";
  return raw === "unofficial" ? "unofficial" : "official";
}

function handle(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  const url = parseUrl(req);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health") {
    json(res, 200, {
      ok: true,
      updatedAtBogota: getMeta("updatedAtBogota"),
    });
    return;
  }

  if (path === "/v1/index") {
    const source = sourceOf(url);
    json(res, 200, buildIndex(source));
    return;
  }

  const listingMatch = path.match(/^\/v1\/stores\/([a-z][a-z0-9-]{0,40})\/listings$/);
  if (listingMatch) {
    const id = listingMatch[1];
    const source = sourceOf(url);
    const store = storesForSource(source).find((s) => s.id === id) || loadStores().find((s) => s.id === id);
    if (!store || !(store.sources || ["official"]).includes(source)) {
      notFound(res);
      return;
    }
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 12);
    const q = url.searchParams.get("q") || "";
    const result = queryListings({ shop: id, source, q, page, pageSize });
    const spotlight = getSpotlight(id, source);
    json(res, 200, {
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
      source,
      emptyMessage:
        store.status === "deferred"
          ? store.reason
          : source === "unofficial"
            ? "Sin keys verificadas hoy"
            : "Sin ofertas hoy",
      updatedAt: getMeta("updatedAt"),
      updatedAtBogota: getMeta("updatedAtBogota"),
      timezone: getMeta("timezone") || "America/Bogota",
      spotlight,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      deals: result.deals,
    });
    return;
  }

  notFound(res);
}

createServer(handle).listen(PORT, HOST, () => {
  console.log(`cheap-games API on http://${HOST}:${PORT}`);
});
