"use client";
import { createContext, useContext, type ReactNode } from "react";

export type Lang = "en" | "ms";

/** English key → Bahasa Malaysia. Keys are the English strings as written in the UI. */
const MS: Record<string, string> = {
  "Free · no login": "Percuma · tanpa log masuk",
  "Step {n} of 4": "Langkah {n} daripada 4",
  "Where is it coming from?": "Dari mana barang ini datang?",
  "Set the lane once. Every product you add next shares it.": "Tetapkan laluan sekali. Semua produk yang ditambah akan berkongsi laluan ini.",
  "From port": "Dari pelabuhan",
  "To port": "Ke pelabuhan",
  "Search port or country": "Cari pelabuhan atau negara",
  "Shipment type": "Jenis penghantaran",
  "Number of pallets": "Bilangan palet",
  "Price basis": "Asas harga",
  "Currency": "Mata wang",
  "Customs exchange rate": "Kadar tukaran kastam",
  "Add products": "Tambah produk",
  "What are you bringing?": "Apa yang anda bawa masuk?",
  "Type a name. Size, strength and customs code fill themselves.": "Taip nama. Saiz, kekuatan dan kod kastam diisi secara automatik.",
  "Search product, e.g. Duvel 330ml": "Cari produk, cth. Duvel 330ml",
  "Scan invoice, price list or photo": "Imbas invois, senarai harga atau gambar",
  "+ Add another product": "+ Tambah produk lain",
  "Product name": "Nama produk",
  "Type": "Jenis",
  "Customs code": "Kod kastam",
  "Group": "Kumpulan",
  "Cost / unit": "Kos / unit",
  "Per case": "Setiap kotak",
  "Cases": "Kotak",
  "Code confirmed": "Kod disahkan",
  "Check customs code": "Semak kod kastam",
  "Your rates, verify": "Kadar anda, sila sahkan",
  "Back": "Kembali",
  "Next: freight and charges": "Seterusnya: tambang dan caj",
  "Freight and charges": "Tambang dan caj",
  "Got a forwarder quote? Enter it. If not, use our lane benchmark.": "Ada sebut harga forwarder? Masukkan. Jika tiada, guna penanda aras laluan kami.",
  "Use benchmark": "Guna penanda aras",
  "Calculate landed cost": "Kira kos mendarat",
  "Shipment landed at your warehouse": "Penghantaran mendarat di gudang anda",
  "Import duty": "Duti import",
  "Excise": "Eksais",
  "SST 10%": "SST 10%",
  "Local charges": "Caj tempatan",
  "Freight + insurance": "Tambang + insurans",
  "Show formula": "Tunjuk formula",
  "Hide formula": "Sembunyi formula",
  "Margin check": "Semakan margin",
  "Gross margin": "Margin kasar",
  "Before you ship": "Sebelum anda hantar",
  "Import licence for alcohol (RMCD)": "Lesen import alkohol (JKDM)",
  "Customs tax stamps on every bottle": "Setem cukai kastam pada setiap botol",
  "Labels meet Food Regulations (from 1 Apr 2026)": "Label mematuhi Peraturan Makanan (mulai 1 Apr 2026)",
  "Sales tax registration if over threshold": "Pendaftaran cukai jualan jika melebihi ambang",
  "Share link": "Kongsi pautan",
  "Copied": "Disalin",
  "PDF / print": "PDF / cetak",
  "Edit": "Ubah",
  "New shipment": "Penghantaran baharu",
  "Freight check": "Semakan tambang",
  "Get quotes from forwarders and customs agents": "Dapatkan sebut harga daripada forwarder dan ejen kastam",
  "Reverse: what can I pay the supplier?": "Terbalik: berapa saya boleh bayar pembekal?",
  "Compare scenarios": "Bandingkan senario",
  "Save": "Simpan",
  "Load": "Muat",
  "Remove": "Buang",
  "This shipment": "Penghantaran ini",
  "Loading…": "Memuatkan…",
  "tax is {n}% of it": "cukai ialah {n}% daripadanya",
  "Goods": "Barang",
  "Duty": "Duti",
  "SST": "SST",
  "Freight & local": "Tambang & tempatan",
  "/ unit": "/ unit",
  "Estimate only; final assessment by RMCD.": "Anggaran sahaja; taksiran muktamad oleh JKDM.",
};

const Ctx = createContext<Lang>("en");
export const LangProvider = ({ lang, children }: { lang: Lang; children: ReactNode }) => <Ctx.Provider value={lang}>{children}</Ctx.Provider>;

export function useT() {
  const lang = useContext(Ctx);
  return (key: string, vars?: Record<string, string | number>) => {
    let s = lang === "ms" ? (MS[key] ?? key) : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
