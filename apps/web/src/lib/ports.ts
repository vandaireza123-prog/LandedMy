/** World origin ports (UN/LOCODE). Benchmarks in lanes.ts attach to these by code where known. */
export interface Port {
  code: string;
  name: string;
  country: string;
  iso: string;
  currency: string;
}

export const PORTS: Port[] = [
  // Europe
  { code: "BEANR", name: "Antwerp", country: "Belgium", iso: "BE", currency: "EUR" },
  { code: "BEZEE", name: "Zeebrugge", country: "Belgium", iso: "BE", currency: "EUR" },
  { code: "NLRTM", name: "Rotterdam", country: "Netherlands", iso: "NL", currency: "EUR" },
  { code: "DEHAM", name: "Hamburg", country: "Germany", iso: "DE", currency: "EUR" },
  { code: "DEBRV", name: "Bremerhaven", country: "Germany", iso: "DE", currency: "EUR" },
  { code: "FRLEH", name: "Le Havre", country: "France", iso: "FR", currency: "EUR" },
  { code: "FRMRS", name: "Marseille-Fos", country: "France", iso: "FR", currency: "EUR" },
  { code: "FRBOD", name: "Bordeaux", country: "France", iso: "FR", currency: "EUR" },
  { code: "ESBCN", name: "Barcelona", country: "Spain", iso: "ES", currency: "EUR" },
  { code: "ESVLC", name: "Valencia", country: "Spain", iso: "ES", currency: "EUR" },
  { code: "ESALG", name: "Algeciras", country: "Spain", iso: "ES", currency: "EUR" },
  { code: "PTLIS", name: "Lisbon", country: "Portugal", iso: "PT", currency: "EUR" },
  { code: "PTLEI", name: "Leixões (Porto)", country: "Portugal", iso: "PT", currency: "EUR" },
  { code: "ITGOA", name: "Genoa", country: "Italy", iso: "IT", currency: "EUR" },
  { code: "ITLIV", name: "Livorno", country: "Italy", iso: "IT", currency: "EUR" },
  { code: "ITSPE", name: "La Spezia", country: "Italy", iso: "IT", currency: "EUR" },
  { code: "ITVCE", name: "Venice", country: "Italy", iso: "IT", currency: "EUR" },
  { code: "ITNAP", name: "Naples", country: "Italy", iso: "IT", currency: "EUR" },
  { code: "GRPIR", name: "Piraeus", country: "Greece", iso: "GR", currency: "EUR" },
  { code: "GBFXT", name: "Felixstowe", country: "United Kingdom", iso: "GB", currency: "GBP" },
  { code: "GBSOU", name: "Southampton", country: "United Kingdom", iso: "GB", currency: "GBP" },
  { code: "GBLGP", name: "London Gateway", country: "United Kingdom", iso: "GB", currency: "GBP" },
  { code: "IEDUB", name: "Dublin", country: "Ireland", iso: "IE", currency: "EUR" },
  { code: "DKAAR", name: "Aarhus", country: "Denmark", iso: "DK", currency: "EUR" },
  { code: "SEGOT", name: "Gothenburg", country: "Sweden", iso: "SE", currency: "EUR" },
  { code: "PLGDN", name: "Gdańsk", country: "Poland", iso: "PL", currency: "EUR" },
  { code: "CZPRG", name: "Prague (inland)", country: "Czech Republic", iso: "CZ", currency: "EUR" },
  { code: "ATVIE", name: "Vienna (inland)", country: "Austria", iso: "AT", currency: "EUR" },
  { code: "TRIST", name: "Istanbul (Ambarli)", country: "Türkiye", iso: "TR", currency: "USD" },
  // Americas
  { code: "USLAX", name: "Los Angeles", country: "United States", iso: "US", currency: "USD" },
  { code: "USLGB", name: "Long Beach", country: "United States", iso: "US", currency: "USD" },
  { code: "USOAK", name: "Oakland", country: "United States", iso: "US", currency: "USD" },
  { code: "USSEA", name: "Seattle", country: "United States", iso: "US", currency: "USD" },
  { code: "USNYC", name: "New York / New Jersey", country: "United States", iso: "US", currency: "USD" },
  { code: "USSAV", name: "Savannah", country: "United States", iso: "US", currency: "USD" },
  { code: "USHOU", name: "Houston", country: "United States", iso: "US", currency: "USD" },
  { code: "CAVAN", name: "Vancouver", country: "Canada", iso: "CA", currency: "USD" },
  { code: "CAMTR", name: "Montreal", country: "Canada", iso: "CA", currency: "USD" },
  { code: "MXVER", name: "Veracruz", country: "Mexico", iso: "MX", currency: "USD" },
  { code: "BRSSZ", name: "Santos", country: "Brazil", iso: "BR", currency: "USD" },
  { code: "ARBUE", name: "Buenos Aires", country: "Argentina", iso: "AR", currency: "USD" },
  { code: "CLVAP", name: "Valparaíso", country: "Chile", iso: "CL", currency: "USD" },
  { code: "CLSAI", name: "San Antonio", country: "Chile", iso: "CL", currency: "USD" },
  // Oceania
  { code: "AUMEL", name: "Melbourne", country: "Australia", iso: "AU", currency: "AUD" },
  { code: "AUSYD", name: "Sydney", country: "Australia", iso: "AU", currency: "AUD" },
  { code: "AUADL", name: "Adelaide", country: "Australia", iso: "AU", currency: "AUD" },
  { code: "AUBNE", name: "Brisbane", country: "Australia", iso: "AU", currency: "AUD" },
  { code: "AUFRE", name: "Fremantle", country: "Australia", iso: "AU", currency: "AUD" },
  { code: "NZAKL", name: "Auckland", country: "New Zealand", iso: "NZ", currency: "NZD" },
  { code: "NZTRG", name: "Tauranga", country: "New Zealand", iso: "NZ", currency: "NZD" },
  { code: "NZLYT", name: "Lyttelton (Christchurch)", country: "New Zealand", iso: "NZ", currency: "NZD" },
  // Asia
  { code: "CNSHA", name: "Shanghai", country: "China", iso: "CN", currency: "USD" },
  { code: "CNNGB", name: "Ningbo", country: "China", iso: "CN", currency: "USD" },
  { code: "CNSZX", name: "Shenzhen (Yantian)", country: "China", iso: "CN", currency: "USD" },
  { code: "CNCAN", name: "Guangzhou (Nansha)", country: "China", iso: "CN", currency: "USD" },
  { code: "CNTAO", name: "Qingdao", country: "China", iso: "CN", currency: "USD" },
  { code: "CNXMN", name: "Xiamen", country: "China", iso: "CN", currency: "USD" },
  { code: "HKHKG", name: "Hong Kong", country: "Hong Kong", iso: "HK", currency: "USD" },
  { code: "TWKHH", name: "Kaohsiung", country: "Taiwan", iso: "TW", currency: "USD" },
  { code: "JPTYO", name: "Tokyo", country: "Japan", iso: "JP", currency: "USD" },
  { code: "JPYOK", name: "Yokohama", country: "Japan", iso: "JP", currency: "USD" },
  { code: "JPOSA", name: "Osaka", country: "Japan", iso: "JP", currency: "USD" },
  { code: "JPUKB", name: "Kobe", country: "Japan", iso: "JP", currency: "USD" },
  { code: "KRPUS", name: "Busan", country: "South Korea", iso: "KR", currency: "USD" },
  { code: "SGSIN", name: "Singapore", country: "Singapore", iso: "SG", currency: "SGD" },
  { code: "THLCH", name: "Laem Chabang", country: "Thailand", iso: "TH", currency: "USD" },
  { code: "THBKK", name: "Bangkok", country: "Thailand", iso: "TH", currency: "USD" },
  { code: "VNSGN", name: "Ho Chi Minh City (Cat Lai)", country: "Vietnam", iso: "VN", currency: "USD" },
  { code: "VNHPH", name: "Haiphong", country: "Vietnam", iso: "VN", currency: "USD" },
  { code: "IDJKT", name: "Jakarta (Tanjung Priok)", country: "Indonesia", iso: "ID", currency: "USD" },
  { code: "IDSUB", name: "Surabaya", country: "Indonesia", iso: "ID", currency: "USD" },
  { code: "PHMNL", name: "Manila", country: "Philippines", iso: "PH", currency: "USD" },
  { code: "INNSA", name: "Nhava Sheva (Mumbai)", country: "India", iso: "IN", currency: "USD" },
  { code: "INMAA", name: "Chennai", country: "India", iso: "IN", currency: "USD" },
  { code: "LKCMB", name: "Colombo", country: "Sri Lanka", iso: "LK", currency: "USD" },
  { code: "BDCGP", name: "Chittagong", country: "Bangladesh", iso: "BD", currency: "USD" },
  { code: "PKKHI", name: "Karachi", country: "Pakistan", iso: "PK", currency: "USD" },
  // Middle East & Africa
  { code: "AEJEA", name: "Jebel Ali (Dubai)", country: "United Arab Emirates", iso: "AE", currency: "USD" },
  { code: "SAJED", name: "Jeddah", country: "Saudi Arabia", iso: "SA", currency: "USD" },
  { code: "OMSLL", name: "Salalah", country: "Oman", iso: "OM", currency: "USD" },
  { code: "EGALY", name: "Alexandria", country: "Egypt", iso: "EG", currency: "USD" },
  { code: "MAPTM", name: "Tanger Med", country: "Morocco", iso: "MA", currency: "EUR" },
  { code: "TNTUN", name: "Tunis (Radès)", country: "Tunisia", iso: "TN", currency: "EUR" },
  { code: "ZADUR", name: "Durban", country: "South Africa", iso: "ZA", currency: "USD" },
  { code: "ZACPT", name: "Cape Town", country: "South Africa", iso: "ZA", currency: "USD" },
  { code: "KEMBA", name: "Mombasa", country: "Kenya", iso: "KE", currency: "USD" },
  { code: "NGLOS", name: "Lagos (Apapa)", country: "Nigeria", iso: "NG", currency: "USD" },
];

export const DEST_PORTS = [
  { code: "MYPKG", label: "Port Klang (Westport / Northport)" },
  { code: "MYTPP", label: "Tanjung Pelepas" },
  { code: "MYPEN", label: "Penang" },
  { code: "MYPGU", label: "Pasir Gudang" },
  { code: "MYKUA", label: "Kuantan" },
  { code: "MYBTU", label: "Bintulu" },
  { code: "MYKCH", label: "Kuching" },
  { code: "MYBKI", label: "Kota Kinabalu (Sepanggar)" },
  { code: "MYKUL", label: "KLIA (air freight)" },
];

export function searchPorts(q: string): Port[] {
  const s = q.trim().toLowerCase();
  if (!s) return PORTS;
  return PORTS.filter((p) => p.name.toLowerCase().includes(s) || p.country.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
}

export function findPort(code: string): Port | undefined {
  return PORTS.find((p) => p.code === code);
}
