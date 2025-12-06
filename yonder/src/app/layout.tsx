import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import { TRPCProvider } from "../trpc/provider";
import { ToastProvider } from "./_components/ui/toast-provider";
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// SEO Configuration
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://liveyonder.com";
const siteName = "Yonder";
const siteDescription = "Find and acquire land plots in Portugal with AI-powered search, zoning analysis, and guided acquisition process. Your complete platform for land investment.";
const siteKeywords = [
  "land plots Portugal",
  "buy land Portugal",
  "plot acquisition",
  "land investment",
  "AI land search",
  "zoning analysis",
  "property Portugal",
  "land for sale",
  "rural land Portugal",
  "building plots",
  "land GPT",
  "plot finder"
];

export const metadata: Metadata = {
  // Base URL for resolving relative URLs
  metadataBase: new URL(siteUrl),
  
  // Basic metadata
  title: {
    default: `${siteName} - Find Your Perfect Land Plot in Portugal`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: siteKeywords,
  
  // Author and publisher
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  
  // Robots and indexing
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  // Open Graph metadata (Facebook, LinkedIn, etc.)
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: siteName,
    title: `${siteName} - Find Your Perfect Land Plot in Portugal`,
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteName} - Land Plot Platform`,
      },
    ],
  },
  
  // Twitter Card metadata
  twitter: {
    card: "summary_large_image",
    title: `${siteName} - Find Your Perfect Land Plot in Portugal`,
    description: siteDescription,
    images: ["/og-image.png"],
    creator: "@liveyonderco",
  },
  
  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  
  // Web app manifest
  manifest: "/site.webmanifest",
  
  // Alternate languages (if applicable)
  alternates: {
    canonical: siteUrl,
  },
  
  // Category
  category: "Real Estate",
};

// Viewport configuration (separated in Next.js 14+)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TRPCProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TRPCProvider>
        <Analytics />
      </body>
    </html>
  );
}
