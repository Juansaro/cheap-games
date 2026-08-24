export async function maybeOpenIssue(payload, newDeals) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo || !newDeals.length) return { opened: false, reason: "skip" };
  const title = `Ofertas — ${payload.updatedAtDate}`;
  const listRes = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=20&labels=ofertas`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
  );
  if (listRes.ok) {
    const open = await listRes.json();
    if (Array.isArray(open) && open.some((i) => i.title === title)) {
      return { opened: false, reason: "exists" };
    }
  }
  const body = [
    `Nuevas ofertas verificadas vs la corrida anterior (${payload.updatedAtBogota} Bogotá).`,
    "",
    ...newDeals.map(
      (d) =>
        `- **${d.name}** · ${d.platform} · ${d.priceCurrentLabel} (−${d.discountPercent}%) · [Ver oferta](${d.url})`,
    ),
    "",
    "Fuente pública: GitHub Pages de este repo.",
  ].join("\n");
  const created = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels: ["ofertas"] }),
  });
  if (created.status === 422) {
    const retry = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body }),
    });
    return { opened: retry.ok, status: retry.status };
  }
  return { opened: created.ok, status: created.status };
}
