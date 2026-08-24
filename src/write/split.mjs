import { uniqueById } from "../lib/deal.mjs";

export function storeDealsFromPayload(payload) {
  if (payload.stores) {
    const out = {};
    for (const [id, slice] of Object.entries(payload.stores)) {
      out[id] = uniqueById(slice.deals || []);
    }
    return out;
  }
  const meta = payload.sections?.metaVr?.deals || [];
  const haloId = payload.sections?.halo?.currentPrice?.id;
  return {
    steam: uniqueById([
      ...(payload.sections?.steamPc?.deals || []),
      ...(payload.sections?.halo?.deals || []).filter(
        (d) => d.discountPercent > 0 && d.id !== haloId,
      ),
    ]),
    xbox: uniqueById(payload.sections?.xboxPc?.deals || []),
    steamvr: uniqueById(meta.filter((d) => d.platform === "SteamVR")),
    "meta-quest": uniqueById(meta.filter((d) => d.platform === "Meta Quest")),
  };
}
