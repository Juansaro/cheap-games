import { storeDealsFromPayload } from "./split.mjs";

export function toMd(payload, stores) {
  const lines = [
    `# Ofertas — ${payload.updatedAtBogota} (Bogotá)`,
    "",
    `Última actualización: **${payload.updatedAtBogota}** (${payload.timezone}).`,
    "Solo precios verificados. Si una ficha no se pudo confirmar, no aparece.",
    "",
  ];

  const haloPrice =
    payload.stores?.steam?.spotlight || payload.sections?.halo?.currentPrice || null;
  if (haloPrice) {
    const tag = haloPrice.onSale ? `-${haloPrice.discountPercent}%` : "sin oferta";
    lines.push("## Halo: The Master Chief Collection");
    lines.push(
      `- Precio actual (${tag}): **${haloPrice.priceCurrentLabel}** · [Steam](${haloPrice.url})`,
    );
    lines.push("");
  }

  for (const store of stores) {
    const deals =
      payload.stores?.[store.id]?.deals ||
      storeDealsFromPayload(payload)[store.id] ||
      [];
    lines.push(`## ${store.name}`);
    if (store.status === "deferred") {
      lines.push(`- ${store.reason}`);
    } else if (!deals.length) {
      lines.push("- Sin ofertas hoy");
    }
    for (const d of deals) {
      lines.push(
        `- ${d.isNew ? "🆕 " : ""}**${d.name}** (${d.platform}, ${d.kind}) — ${d.priceCurrentLabel} ~~${d.pricePreviousLabel}~~ (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
