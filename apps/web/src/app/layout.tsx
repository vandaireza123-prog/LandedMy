import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://costavora.com"),
  title: "Costavora — the landed cost of anything, anywhere",
  description: "Free landed cost calculator: import duty, tax, excise, freight and port charges for any product into 213 countries, with the source of every rate.",
  applicationName: "Costavora",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icons/favicon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/icon-180.png" },
  openGraph: { siteName: "Costavora", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Costavora — the landed cost of anything, anywhere" }] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
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
