export function formatMoney(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currency || "COP",
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

export function fingerprint(deal) {
  return [deal.platform, deal.id, deal.priceCurrent, deal.currency].join("::");
}

export function uniqueById(deals) {
  const seen = new Set();
  return (deals || []).filter((d) => (d?.id && !seen.has(d.id) ? (seen.add(d.id), true) : false));
}

export function markNew(list, previous) {
  return (list || []).map((d) => ({
    ...d,
    isNew: d.confirmed !== false && !previous.has(fingerprint(d)),
  }));
}
