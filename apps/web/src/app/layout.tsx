import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LandedMY — Malaysia landed cost calculator",
  description: "Exact landed cost of importing wine, beer, cider and spirits into Malaysia: import duty, excise, SST, freight and port charges, per bottle and per shipment.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0B5E5A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        {/* Netlify Forms registers this at build time; submissions arrive via fetch from QuoteGap. */}
        <form name="quote-request" data-netlify="true" netlify-honeypot="bot-field" hidden>
          <input name="bot-field" />
          <input name="name" />
          <input name="company" />
          <input name="email" />
          <input name="phone" />
          <input name="lane" />
          <input name="equipment" />
          <input name="products" />
          <input name="landed_total_rm" />
          <input name="forwarder_quote" />
          <input name="share_link" />
        </form>
      </body>
    </html>
  );
}
