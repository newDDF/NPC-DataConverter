import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://dataconverter.x0u0x.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Free Online Data Converter – JSON, CSV, XML, YAML & Excel",
    template: "%s | NPC-DataConverter",
  },
  description:
    "Convert JSON, CSV, XML, YAML, Markdown, and Excel files online. Preview data, select fields, and export results with a simple browser-based converter.",
  applicationName: "NPC-DataConverter",
  keywords: [
    "online data converter",
    "JSON converter",
    "CSV converter",
    "XML converter",
    "YAML converter",
    "Excel converter",
    "JSON to CSV",
    "CSV to JSON",
    "online file converter",
    "data format converter",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "NPC-DataConverter",
    title: "Free Online Data Converter – JSON, CSV, XML, YAML & Excel",
    description:
      "Convert and preview JSON, CSV, XML, YAML, Markdown, and Excel data online with NPC-DataConverter.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Free Online Data Converter | NPC-DataConverter",
    description:
      "Convert JSON, CSV, XML, YAML, Markdown, and Excel files online.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
