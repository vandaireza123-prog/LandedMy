// Brazil: MDIC "Tarifas Vigentes" workbook (Resolução Gecex 272/2021 Anexos I–X) → raw/br_tec.json
import { RAW, get, save, today } from "./_util.mjs";
import * as XLSX from "xlsx";
const page = await (await get("https://www.gov.br/mdic/pt-br/assuntos/camex/se-camex/strat/tarifas/vigentes")).text();
const m = page.match(/href="(https:\/\/www\.gov\.br\/mdic[^"]*anexos-i-a-x[^"]*\.xlsx)"/i);
if (!m) throw new Error("TEC workbook link not found on the Tarifas Vigentes page");
const url = m[1];
const buf = new Uint8Array(await (await get(url)).arrayBuffer());
const wb = XLSX.read(buf, { type: "array" });
const S = (re) => { const n = wb.SheetNames.find((x) => re.test(x)); if (!n) throw new Error("sheet missing: " + re); return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true }); };
const isN = (v) => typeof v === "string" && /^\d{4}\.\d{2}\.\d{2}$/.test(v.trim());
const meta = {};
for (const n of wb.SheetNames) meta[n] = (XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true }).find((x) => typeof x[0] === "string" && /Atualizad/i.test(x[0])) || [""])[0];
const s = (v, n = 160) => String(v ?? "").slice(0, n);
const out = {
  meta, url, pulled: today(),
  I: Object.fromEntries(S(/Anexo I\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), [s(r[1]).trim(), r[2] ?? null]])),
  II: S(/Anexo II\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[2] ?? null, r[3] || "", r[4] ?? null, r[5] ?? null, s(r[6]).trim()]),
  IV: S(/Anexo IV\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[1], s(r[2]), r[3], r[4], r[5], s(r[6])]),
  V: S(/Anexo V\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[1], r[2], s(r[3]), r[4], r[5], r[6], r[7]]),
  VI: S(/Anexo VI\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[1], s(r[2]), r[3], r[4], r[5], s(r[6]), r[7]]),
  VIII: S(/Anexo VIII\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[1], r[2], s(r[3]), r[4], r[5], s(r[6], 120)]),
  IX: S(/Anexo IX\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[1], r[2], s(r[3]), r[4], r[5], r[6], r[7]]),
  X: S(/Anexo X\b/i).filter((r) => isN(r[0])).map((r) => [r[0].trim(), r[1], r[2], s(r[3]), r[4], r[5], r[6], r[7]]),
};
if (Object.keys(out.I).length < 9000) throw new Error(`Brazil TEC looks incomplete: ${Object.keys(out.I).length} lines`);
save(RAW + "br_tec.json", out);
console.log("BR", Object.keys(out.I).length, "NCM lines from", url);
