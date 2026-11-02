import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculator — LandedMY",
  description: "Calculate the exact landed cost of a shipment into Malaysia: import duty, excise, SST, freight and port charges per bottle, case and pallet.",
  alternates: { canonical: "https://landedmy.netlify.app/calc/" },
};

export default function CalcLayout({ children }: { children: React.ReactNode }) {
  return children;
}
