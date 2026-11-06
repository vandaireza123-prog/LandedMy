/**
 * Search the universal HS 2022 nomenclature (5,613 six-digit subheadings) in plain language.
 * HS descriptions are legal text ("Automatic data processing machines; portable"), so a synonym
 * layer maps everyday words to headings before the text match runs. Data loads lazily (≈800 KB).
 */
export interface HsHit {
  /** 6-digit code, e.g. "847130" */
  code6: string;
  /** Dotted display form, e.g. "8471.30" */
  code: string;
  description: string;
  heading: string;
  chapter: string;
  chapter_desc: string;
  score: number;
}

type Data = { subheadings: [string, string][]; headings: Record<string, string>; chapters: Record<string, { d: string; s: string }> };
let dataP: Promise<Data> | null = null;
export function loadHs(): Promise<Data> {
  dataP ??= import("./hs6.json").then((m) => (m.default ?? m) as unknown as Data);
  return dataP;
}

/** Everyday words → HS heading(s) (4 or 6 digits). Order matters: first is the usual answer. */
export const SYNONYMS: Record<string, string[]> = {
  laptop: ["847130"], notebook: ["847130", "4820"], macbook: ["847130"], computer: ["8471"], pc: ["847141"], desktop: ["847141"], tablet: ["847130"], ipad: ["847130"],
  phone: ["851713"], smartphone: ["851713"], iphone: ["851713"], mobile: ["851713"], headphones: ["851830"], earbuds: ["851830"], earphones: ["851830"], speaker: ["851821", "851822"], bluetooth: ["851762"],
  tv: ["8528"], television: ["8528"], monitor: ["852852"], camera: ["852589"], drone: ["8806"], console: ["950450"], playstation: ["950450"], xbox: ["950450"], printer: ["844332"], router: ["851762"], charger: ["850440"], "power bank": ["850760"], battery: ["850760", "8507", "8506"], lithium: ["850760"], "lithium battery": ["850760"], "lithium-ion": ["850760"], cable: ["854442"], keyboard: ["847160"], mouse: ["847160"], ssd: ["852351"], "hard drive": ["847170"], watch: ["9102", "9101"], smartwatch: ["851762", "910212"],
  fridge: ["841810"], refrigerator: ["841810"], freezer: ["841830"], "washing machine": ["845011"], dishwasher: ["842211"], oven: ["851660"], microwave: ["851650"], kettle: ["851671"], toaster: ["851672"], "coffee machine": ["851671"], "espresso machine": ["841981", "851671"], blender: ["850940"], mixer: ["850940"], "air fryer": ["851660"], "rice cooker": ["851660"], "vacuum cleaner": ["850811"], fan: ["841451"], "air conditioner": ["841510"], aircon: ["841510"], "hair dryer": ["851631"], iron: ["851640"],
  sofa: ["940161"], couch: ["940161"], chair: ["940161", "940169", "940130"], "office chair": ["940130"], table: ["940360", "940320"], desk: ["940330"], bed: ["940350"], mattress: ["940421", "940429"], wardrobe: ["940350"], cabinet: ["940340", "940360"], shelf: ["940360"], furniture: ["9403"], lamp: ["940520", "940511"], lighting: ["9405"], "led bulb": ["853950"], bulb: ["853950"], curtain: ["630392"], carpet: ["5703"], rug: ["5703"], pillow: ["940490"], cushion: ["940490"], duvet: ["940440"], towel: ["630260"], "bed sheet": ["630231"], bedding: ["6302"],
  "t-shirt": ["610910"], tshirt: ["610910"], tee: ["610910"], shirt: ["620520", "610510"], blouse: ["620630"], jeans: ["620342"], trousers: ["620342", "620462"], pants: ["620342"], shorts: ["620342"], dress: ["620443"], skirt: ["620452"], jacket: ["620333", "610130"], coat: ["620193"], hoodie: ["611020"], sweater: ["611020", "611030"], jumper: ["611030"], suit: ["620311"], underwear: ["610711", "610821"], bra: ["621210"], socks: ["611595"], gloves: ["611610"], scarf: ["621420"], hat: ["650500"], cap: ["650500"], belt: ["420330"], tie: ["621520"], swimwear: ["611241"], sportswear: ["611490"], abaya: ["620449"], hijab: ["621410"], baju: ["620449"], sarong: ["621143"],
  shoes: ["640399", "640411"], "running shoes": ["640411"], "sports shoes": ["640411"], sneakers: ["640411"], trainers: ["640411"], boots: ["640391"], sandals: ["640299"], slippers: ["640520"], heels: ["640399"], footwear: ["6403", "6404"],
  bag: ["420222", "420292"], handbag: ["420221", "420222"], backpack: ["420292"], suitcase: ["420212"], luggage: ["420212"], wallet: ["420231"], purse: ["420231"], sunglasses: ["900410"], glasses: ["900490"], eyeglasses: ["900490"], umbrella: ["660191"], jewellery: ["711319", "711719"], jewelry: ["711319", "711719"], ring: ["711319"], necklace: ["711319"], gold: ["7108"], silver: ["7106"], diamond: ["7102"],
  perfume: ["330300"], fragrance: ["330300"], cologne: ["330300"], lipstick: ["330410"], makeup: ["330499"], foundation: ["330499"], mascara: ["330420"], "nail polish": ["330430"], skincare: ["330499"], moisturiser: ["330499"], moisturizer: ["330499"], serum: ["330499"], sunscreen: ["330499"], shampoo: ["330510"], conditioner: ["330590"], soap: ["340111"], "body wash": ["340130"], toothpaste: ["330610"], toothbrush: ["960321"], deodorant: ["330720"], razor: ["821210"], diapers: ["961910"], nappies: ["961910"], sanitary: ["961910"], "essential oil": ["3301"],
  coffee: ["090121", "090111"], "coffee beans": ["090111"], "roasted coffee": ["090121"], tea: ["090210", "090230"], "green tea": ["090210"], "matcha": ["090210"], cocoa: ["1805", "1801"], chocolate: ["180632", "180690"], candy: ["170490"], sweets: ["170490"], biscuits: ["190531"], cookies: ["190531"], crackers: ["190590"], bread: ["190590"], pasta: ["190219"], noodles: ["190230"], rice: ["100630"], flour: ["110100"], sugar: ["170199"], honey: ["040900"], jam: ["200799"], "peanut butter": ["200811"], nuts: ["080212", "200819"], almonds: ["080212"], dates: ["080410"], "dried fruit": ["0813"], spices: ["0910", "0904"], pepper: ["090411"], salt: ["250100"], sauce: ["210390"], ketchup: ["210320"], "soy sauce": ["210310"], mayonnaise: ["210390"], vinegar: ["220900"], "olive oil": ["150910"], oil: ["1509", "1512"], butter: ["040510"], cheese: ["040690", "040610"], milk: ["040120", "040221"], "milk powder": ["040221"], "infant formula": ["190110"], yogurt: ["040310"], yoghurt: ["040310"], eggs: ["040721"], beef: ["020130", "020230"], lamb: ["020442"], chicken: ["020714"], pork: ["020329"], fish: ["030389"], salmon: ["030214", "030441"], tuna: ["160414"], prawns: ["030617"], shrimp: ["030617"], seafood: ["0306", "0307"], vegetables: ["0709", "0710"], potatoes: ["070190"], onions: ["070310"], tomatoes: ["070200"], fruit: ["0808", "0810"], apples: ["080810"], oranges: ["080510"], grapes: ["080610"], bananas: ["080390"], avocado: ["080440"], durian: ["081060"], "frozen vegetables": ["0710"], "canned": ["2005", "1604"], cereal: ["190410"], granola: ["190410"], "protein powder": ["210690"], supplements: ["210690"], vitamins: ["300450", "210690"], "energy drink": ["220299"], "soft drink": ["220210"], soda: ["220210"], juice: ["200989", "200911"], water: ["220110"], "mineral water": ["220110"], "non-alcoholic beer": ["220291"], kombucha: ["220299"], "ice cream": ["210500"],
  beer: ["220300"], wine: ["220421"], "sparkling wine": ["220410"], champagne: ["220410"], prosecco: ["220410"], cider: ["220600"], sake: ["220600"], whisky: ["220830"], whiskey: ["220830"], brandy: ["220820"], cognac: ["220820"], gin: ["220850"], rum: ["220840"], vodka: ["220860"], liqueur: ["220870"], tequila: ["220890"], mezcal: ["220890"], soju: ["220890"], baijiu: ["220890"],
  cigarettes: ["240220"], cigars: ["240210"], tobacco: ["2403", "2401"], vape: ["854370", "240411"], "e-liquid": ["240412"], "e-cigarette": ["854370"],
  medicine: ["300490"], pharmaceuticals: ["3004"], paracetamol: ["300490"], antibiotics: ["300420"], insulin: ["300431"], mask: ["630790"], "face mask": ["630790"], "medical gloves": ["401511"], syringe: ["901831"], thermometer: ["902519"], wheelchair: ["871310"], "blood pressure monitor": ["901890"], "hearing aid": ["902140"],
  car: ["870323", "870322"], vehicle: ["8703"], ev: ["870380"], "electric car": ["870380"], motorcycle: ["871120"], scooter: ["871160", "871120"], "e-scooter": ["871160"], bicycle: ["871200"], "e-bike": ["871160"], tyres: ["401110"], tires: ["401110"], "car parts": ["8708"], brake: ["870830"], "spare parts": ["8708"], helmet: ["650610"],
  toys: ["950300"], toy: ["950300"], lego: ["950300"], doll: ["950300"], puzzle: ["950300"], "board game": ["950490"], "playing cards": ["950440"], "video game": ["950450"], football: ["950662"], ball: ["950662", "950669"], "gym equipment": ["950691"], dumbbells: ["950691"], treadmill: ["950691"], "yoga mat": ["950691"], golf: ["950631"], "golf clubs": ["950631"], racket: ["950651", "950659"], "fishing rod": ["950710"], tent: ["630622"], "sleeping bag": ["940430"],
  books: ["490199"], book: ["490199"], magazine: ["490210"], "printed matter": ["4911"], stationery: ["4820"], pen: ["960810"], pencil: ["960910"], paper: ["480256"], "a4 paper": ["480256"], packaging: ["4819", "3923"], "cardboard box": ["481910"], "plastic bag": ["392321"], "plastic bottle": ["392330"], "glass bottle": ["701090"], "glass jar": ["701090"], label: ["482110"], tape: ["391910"],
  cement: ["252329"], steel: ["7208", "7214"], "steel pipe": ["730630"], aluminium: ["7604", "7606"], aluminum: ["7604", "7606"], copper: ["7408"], tiles: ["690721"], marble: ["680221"], granite: ["680223"], timber: ["4407"], wood: ["4407"], plywood: ["441231"], glass: ["7005"], paint: ["320910"], "solar panel": ["854143"], inverter: ["850440"], generator: ["850211"], pump: ["841381"], valve: ["848180"], motor: ["850140"], compressor: ["841430"], "machine": ["8479"], cnc: ["845811"], "3d printer": ["848510"], drill: ["846721"], tools: ["8205", "8467"], screws: ["731815"], bolts: ["731815"], nails: ["731700"], wire: ["7217"], fertiliser: ["3105"], fertilizer: ["3105"], pesticide: ["380891"], seeds: ["1209"], "palm oil": ["151190"], rubber: ["4001"], "rubber gloves": ["401519"],
  "pet food": ["230910"], "dog food": ["230910"], "cat food": ["230910"], "cat litter": ["250810", "380700"], aquarium: ["701090"],
  cookware: ["732393"], pan: ["732393"], pot: ["732393"], knife: ["821192"], cutlery: ["821510"], plates: ["691110"], mug: ["691200"], glassware: ["701337"], "wine glass": ["701328"], bottle: ["701090"], "water bottle": ["392330", "961700"], thermos: ["961700"], "lunch box": ["392410"], tupperware: ["392410"], candle: ["340600"], candles: ["340600"], vase: ["691390"], mirror: ["700992"], clock: ["910511"], frame: ["441400"], "artificial flowers": ["670290"], "christmas decorations": ["950510"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%.\- ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["and", "or", "of", "the", "for", "in", "with", "not", "other", "than", "a", "an", "n.e.c.", "nec", "whether", "e.g.", "i.e.", "including", "excluding", "thereof"]);

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Simple English singularisation so "chairs" finds "chair" synonyms and "Seats" descriptions. */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export async function searchHs(query: string, limit = 8): Promise<HsHit[]> {
  const q = norm(query);
  if (q.length < 2) return [];
  const data = await loadHs();
  const scores = new Map<string, number>();

  // 1. Code prefix ("8471", "2204.21", "847130")
  const digits = q.replace(/\./g, "");
  if (/^\d{2,6}$/.test(digits)) {
    for (const [c] of data.subheadings) if (c.startsWith(digits)) scores.set(c, 100 - (c.length - digits.length));
  }

  // 2. Synonyms: longest phrase match first, then single words
  const qTokens = tokens(q).map(stem);
  const phrases = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);
  const matched = new Set<string>();
  for (const p of phrases) {
    const pn = norm(p);
    const hit = q.includes(pn) || qTokens.includes(stem(pn)) || (pn.includes(" ") && pn.split(" ").every((w) => qTokens.includes(stem(w))));
    if (!hit) continue;
    if ([...matched].some((m) => m.includes(pn))) continue; // "coffee machine" already matched, skip "coffee"
    matched.add(pn);
    SYNONYMS[p].forEach((code, i) => {
      const w = 60 - i * 10;
      for (const [c] of data.subheadings) if (c.startsWith(code)) scores.set(c, Math.max(scores.get(c) ?? 0, w - (c === code ? 0 : 5)));
    });
  }

  // 3. Text match on description + heading + chapter
  if (qTokens.length) {
    for (const [c, d] of data.subheadings) {
      const hay = `${d} ${data.headings[c.slice(0, 4)] ?? ""} ${data.chapters[c.slice(0, 2)]?.d ?? ""}`;
      const ht = new Set(tokens(hay).map(stem));
      let n = 0;
      for (const t of qTokens) if (ht.has(t) || [...ht].some((h) => h.startsWith(t) && t.length >= 4)) n++;
      if (n === 0) continue;
      const s = (n / qTokens.length) * 40 - Math.min(d.length, 200) / 50;
      if (n === qTokens.length) scores.set(c, Math.max(scores.get(c) ?? 0, s + 10));
      else if (n >= 1 && qTokens.length <= 2) scores.set(c, Math.max(scores.get(c) ?? 0, s));
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([c, score]) => hitOf(data, c, score));
}

function hitOf(data: Data, c: string, score: number): HsHit {
  const d = data.subheadings.find((x) => x[0] === c)?.[1] ?? "";
  return { code6: c, code: `${c.slice(0, 4)}.${c.slice(4)}`, description: d, heading: data.headings[c.slice(0, 4)] ?? "", chapter: c.slice(0, 2), chapter_desc: data.chapters[c.slice(0, 2)]?.d ?? "", score };
}

export async function describeHs(code: string): Promise<HsHit | null> {
  const c = code.replace(/\./g, "").slice(0, 6);
  const data = await loadHs();
  return data.subheadings.some((x) => x[0] === c) ? hitOf(data, c, 0) : null;
}

/** Chapters where duty is typically specific (per litre / per kg) or excise applies — the engine refuses to guess these. */
export const SENSITIVE_CHAPTERS: Record<string, string> = {
  "22": "Alcoholic beverages carry excise and specific duty per litre; use the drinks categories so the exact rates apply.",
  "24": "Tobacco and vapes carry excise and specific duty; rates are per kg/per stick and change yearly.",
  "27": "Fuels carry excise and specific duty per litre.",
  "87": "Vehicles carry excise (Malaysia 60–105%) and often import permits (AP).",
  "17": "Sugar can carry specific duty and, in Malaysia, sugar-sweetened drinks an excise per litre.",
};
