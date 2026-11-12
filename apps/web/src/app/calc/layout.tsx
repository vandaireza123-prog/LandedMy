import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landed cost calculator — Costavora",
  description: "Calculate the landed cost of a shipment into any of 213 countries: import duty, excise, VAT or sales tax, freight and port charges, per unit and per shipment.",
  alternates: { canonical: "https://costavora.com/calc/" },
};

export default function CalcLayout({ children }: { children: React.ReactNode }) {
  return children;
}
