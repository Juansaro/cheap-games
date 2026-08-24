import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const CONFIG_DIR = join(ROOT, "config");
export const DOCS_JSON = join(ROOT, "docs/data/deals.json");
export const ROOT_JSON = join(ROOT, "data/deals.json");
export const INDEX_JSON = join(ROOT, "docs/data/index.json");
export const STORES_DIR = join(ROOT, "docs/data/stores");
export const DEALS_MD = join(ROOT, "DEALS.md");
export const NEW_JSON = join(ROOT, "data/new-deals.json");
export const CATALOG_DB = join(ROOT, "data/catalog.sqlite");
export const SCHEMA_SQL = join(ROOT, "server/schema.sql");
