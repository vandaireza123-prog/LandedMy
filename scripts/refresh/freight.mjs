// Weekly freight index: Drewry World Container Index, 8 east–west lanes + composite (USD per 40').
// Source 1: Drewry's public WCI page. Source 2: Shipping Telegraph's weekly WCI write-up (WordPress REST API).
// Writes apps/web/src/lib/freight-index.json. Refuses implausible values; on any failure the old file stays.
import { readFileSync, writeFileSync } from "node:fs";
import { get } from "./_util.mjs";

const OUT = new URL("../../apps/web/src/lib/freight-index.json", import.meta.url).pathname;
const ROUTES = {
  "SHA-RTM": ["Shanghai", "Rotterdam"],
  "RTM-SHA": ["Rotterdam", "Shanghai"],
  "SHA-GOA": ["Shanghai", "Genoa"],
  "SHA-LAX": ["Shanghai", "Los Angeles"],
  "LAX-SHA": ["Los Angeles", "Shanghai"],
  "SHA-NYC": ["Shanghai", "New York"],
  "NYC-RTM": ["New York", "Rotterdam"],
  "RTM-NYC": ["Rotterdam", "New York"],
};
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "–")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const num = (s) => Number(String(s).replace(/,/g, ""));

/** Pull composite, routes and the assessment date out of a WCI write-up. */
export function parse(t) {
  const routes = {};
  for (const [k, [a, b]] of Object.entries(ROUTES)) {
    const re = new RegExp(`${a}\\s*(?:to|–|-|—)\\s*${b}`, "gi");
    let m;
    while ((m = re.exec(t))) {
      const win = t.slice(m.index + m[0].length, m.index + m[0].length + 160);
      const v = win.match(/(?:\bto|\bat)\s+(?:US)?\$\s?([\d,]{3,6})/i);
      if (v) { routes[k] = num(v[1]); break; }
    }
  }
  const c = t.match(/composite[^$]{0,200}?(?:\bto|\bat)\s+(?:US)?\$\s?([\d,]{3,6})/i);
  const d = t.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})\\s+(20\\d\\d)`, "i"));
  const as_of = d ? `${d[3]}-${String(MONTHS.indexOf(d[2].toLowerCase()) + 1).padStart(2, "0")}-${d[1].padStart(2, "0")}` : null;
  return { composite: c ? num(c[1]) : null, routes, as_of };
}

async function fromDrewry() {
  for (const url of [
    "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry",
    "https://www.drewry.co.uk/trackers-and-indices/latest-trackers-and-indices/world-container-index-assessed-by-drewry",
  ]) {
    try {
      const r = await get(url, { tries: 2, headers: { accept: "text/html" } });
      if (!r.ok) { console.log("drewry", r.status, url); continue; }
      const p = parse(text(await r.text()));
      console.log("drewry parsed", JSON.stringify(p));
      if (p.composite && Object.keys(p.routes).length >= 6) return { ...p, source: "Drewry World Container Index", url };
    } catch (e) { console.log("drewry failed", e.message); }
  }
  return null;
}

async function fromShippingTelegraph() {
  try {
    const r = await get("https://shippingtelegraph.com/wp-json/wp/v2/posts?search=world%20container%20index%20drewry&per_page=5&_fields=date,link,title,content", { tries: 3 });
    if (!r.ok) { console.log("st", r.status); return null; }
    const posts = await r.json();
    for (const post of posts) {
      if (!/world container index/i.test(post.title?.rendered ?? "")) continue;
      const p = parse(text(post.content?.rendered ?? ""));
      // the write-up appears the day after Drewry's Thursday assessment
      if (!p.as_of) p.as_of = new Date(Date.parse(post.date) - 86400000).toISOString().slice(0, 10);
      console.log("shippingtelegraph parsed", post.link, JSON.stringify(p));
      if (p.composite && Object.keys(p.routes).length >= 6) return { ...p, source: "Drewry World Container Index (via Shipping Telegraph)", url: post.link };
    }
  } catch (e) { console.log("st failed", e.message); }
  return null;
}

const prev = JSON.parse(readFileSync(OUT, "utf8"));
const got = (await fromDrewry()) ?? (await fromShippingTelegraph());
if (!got) { console.log("No WCI source parsed; keeping", prev.as_of); process.exit(0); }

// Sanity: plausible values, not older than what we have, no wild jump on any lane.
const bad = Object.entries(got.routes).filter(([k, v]) => v < 100 || v > 40000 || (prev.routes[k] && (v / prev.routes[k] > 3 || v / prev.routes[k] < 0.33)));
if (got.composite < 300 || got.composite > 30000 || bad.length) { console.log("Rejected implausible values", got.composite, bad); process.exit(0); }
if (got.as_of && got.as_of <= prev.as_of) { console.log("Not newer than", prev.as_of, "— nothing to do"); process.exit(0); }

const out = {
  ...prev,
  as_of: got.as_of ?? new Date().toISOString().slice(0, 10),
  source: got.source,
  url: got.url,
  composite: got.composite,
  routes: { ...prev.routes, ...got.routes },
  history: [...(prev.history ?? []), { as_of: got.as_of, composite: got.composite }].slice(-26),
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log("wrote", OUT, out.as_of, out.composite);
