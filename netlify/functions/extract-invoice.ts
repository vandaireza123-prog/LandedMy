/**
 * POST /.netlify/functions/extract-invoice
 *
 * Body (JSON):
 *   { "kind": "image",  "media_type": "image/jpeg", "data": "<base64>" }
 *   { "kind": "pdf",    "data": "<base64>" }
 *   { "kind": "text",   "text": "<pasted price list>" }
 *   { "kind": "classify", "name": "Duvel 330ml 8.5%" }
 *
 * Returns { lines: ExtractedLine[], currency?: string, notes: string[] }
 * The model only extracts and suggests; every HS code is a suggestion the user confirms,
 * and the engine prices from our own rate tables.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Context } from "@netlify/functions";

const MODEL = process.env.LANDEDMY_MODEL ?? "claude-sonnet-5-5";

const HS_LINES = `
2203.00.91 Beer/ale ≤5.8% | 2203.00.99 Beer/ale >5.8% | 2203.00.11 Stout/porter ≤5.8% | 2203.00.19 Stout/porter >5.8%
2204.10.00 Sparkling wine | 2204.21.11 Still wine ≤15% bottle ≤2L | 2204.21.13 Still wine 15–23% | 2204.22.11 Still wine ≤15% 2–10L
2205.10.10 Vermouth ≤15% | 2206.00.10 Cider and perry | 2206.00.50 Mead | 2206.00.60 Fruit wine (non-grape)
2208.30.90 Whisky | 2208.20.50 Brandy/cognac | 2208.50.00 Gin | 2208.60.00 Vodka | 2208.40.00 Rum | 2208.70.10 Liqueur ≤57% | 2208.90.99 Other spirits
`.trim();

const SYSTEM = `You read supplier invoices, price lists and product photos for an import landed-cost calculator (Malaysia and Singapore today, more countries later).
Extract every product line you can see — any goods, not only drinks. For each line give: name (brand + product), category (beer | still_wine | sparkling | cider | spirits | other for alcoholic drinks; general for everything else), volume_ml per retail unit and abv percent for drinks (0 for other goods), units_per_case, cases (if a quantity is shown; else null), unit_cost (price per retail unit in the document's currency, computed from case price if needed), and classification:
- hs6: the universal 6-digit HS 2022 subheading for the product (e.g. 847130 laptops, 610910 cotton T-shirts, 940161 upholstered seats, 220421 still wine). Always give one.
- hs_code: for alcoholic drinks, the best Malaysian tariff line from this list; for other goods, repeat hs6 with a dot ("8471.30"):
${HS_LINES}
Give hs_confidence 0–1 and up to two alternatives. Rules: never invent a value you cannot see or safely infer (a 750 ml wine bottle, a 330 ml beer can are safe inferences; prices are not). Put anything uncertain in notes. If the document currency is visible, report it as an ISO code.`;

const TOOL = {
  name: "report_lines",
  description: "Report the extracted product lines.",
  input_schema: {
    type: "object",
    properties: {
      currency: { type: ["string", "null"], description: "ISO 4217 code if visible" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: ["beer", "still_wine", "sparkling", "cider", "spirits", "other", "general"] },
            hs6: { type: "string", description: "Universal 6-digit HS 2022 code, digits only" },
            volume_ml: { type: ["number", "null"] },
            abv: { type: ["number", "null"] },
            units_per_case: { type: ["number", "null"] },
            cases: { type: ["number", "null"] },
            unit_cost: { type: ["number", "null"] },
            hs_code: { type: "string" },
            hs_confidence: { type: "number" },
            hs_alternatives: { type: "array", items: { type: "string" } },
          },
          required: ["name", "category", "hs6", "hs_code", "hs_confidence"],
        },
      },
      notes: { type: "array", items: { type: "string" } },
    },
    required: ["lines", "notes"],
  },
} as const;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

export default async (req: Request, _ctx: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST" } });
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "ANTHROPIC_API_KEY is not set on this site" });

  let body: { kind: string; media_type?: string; data?: string; text?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const content: Anthropic.ContentBlockParam[] = [];
  if (body.kind === "image" && body.data && body.media_type) {
    if (body.data.length > 7_000_000) return json(413, { error: "Image too large; keep it under 5 MB" });
    content.push({ type: "image", source: { type: "base64", media_type: body.media_type as "image/jpeg", data: body.data } });
    content.push({ type: "text", text: "Extract every beverage line from this image." });
  } else if (body.kind === "pdf" && body.data) {
    if (body.data.length > 14_000_000) return json(413, { error: "PDF too large; keep it under 10 MB" });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: body.data } });
    content.push({ type: "text", text: "Extract every beverage line from this document." });
  } else if (body.kind === "text" && body.text) {
    content.push({ type: "text", text: `Extract every beverage line from this price list:\n\n${body.text.slice(0, 20_000)}` });
  } else if (body.kind === "classify" && body.name) {
    content.push({ type: "text", text: `Classify this single product and fill what you can from its name alone: "${body.name.slice(0, 200)}"` });
  } else {
    return json(400, { error: "Unsupported request" });
  }

  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: "report_lines" },
      messages: [{ role: "user", content }],
    });
    const tool = msg.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return json(502, { error: "No structured result from model" });
    return json(200, tool.input);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json(err.status && err.status >= 400 && err.status < 600 ? err.status : 502, { error: err.message ?? "Model call failed" });
  }
};
