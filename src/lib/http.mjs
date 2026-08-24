export const DELAY_MS = 700;

const UA = {
  "User-Agent":
    "cheap-games-deals/1.0 (+https://github.com; public price check; not a scraper farm)",
  Accept: "application/json,text/html;q=0.9",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
};

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const FETCH_MS = 12000;

export async function fetchText(url, { json = false, retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const signal =
        typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(FETCH_MS)
          : undefined;
      const res = await fetch(url, { headers: UA, redirect: "follow", signal });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1200 * (i + 1));
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, text, url: res.url };
      return {
        ok: true,
        status: res.status,
        url: res.url,
        text,
        json: json ? JSON.parse(text) : undefined,
      };
    } catch (err) {
      lastErr = err;
      await sleep(800 * (i + 1));
    }
  }
  return { ok: false, status: 0, error: String(lastErr?.message || lastErr) };
}

export async function fetchJson(url) {
  const r = await fetchText(url, { json: true });
  if (!r.ok) return r;
  return { ...r, data: r.json };
}
