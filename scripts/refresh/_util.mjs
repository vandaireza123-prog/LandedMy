// Shared helpers for the source refreshers (run from GitHub Actions, where the customs sites are reachable).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const RAW = new URL("../../packages/engine/data/raw/", import.meta.url).pathname;
export const today = () => new Date().toISOString().slice(0, 10);

export function save(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj));
  console.log("wrote", path);
}

/** fetch with retries and 429 back-off. */
export async function get(url, { tries = 6, headers = {}, backoff = 8000 } = {}) {
  let last;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Costavora-refresh/1.0 (+https://costavora.com)", ...headers } });
      if (r.status === 429 || r.status >= 500) { last = new Error(`${r.status} ${url}`); await sleep(backoff * (a + 1)); continue; }
      return r;
    } catch (e) { last = e; await sleep(3000 * (a + 1)); }
  }
  throw last;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run `fn(item)` over `items` with at most `n` in flight. */
export async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } });
  await Promise.all(workers);
}

/** Streaming CSV reader: calls onRow(obj) per record using the header row. Handles quotes, CRLF, embedded newlines. */
export async function streamCsv(response, onRow) {
  const rd = response.body.getReader();
  const dec = new TextDecoder();
  let hdr = null, field = "", row = [], inQ = false, n = 0;
  const flush = () => { row.push(field); field = ""; if (!hdr) hdr = row; else if (row.length > 1) { const o = {}; hdr.forEach((h, i) => (o[h] = row[i])); onRow(o); n++; } row = []; };
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    const s = dec.decode(value, { stream: true });
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
      else if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { if (field.endsWith("\r")) field = field.slice(0, -1); flush(); }
      else field += c;
    }
  }
  if (field || row.length) flush();
  return n;
}
