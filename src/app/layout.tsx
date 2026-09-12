import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Providers } from "@/components/Providers";
import { project } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const title = `${project.name} (${project.ticker})`;
const description = `${project.coreLine} A Solana memecoin on stonk.fun. Eligible holders may receive variable WBTC rewards. Independent parody. Not financial advice.`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(project.siteUrl),
  title,
  description,
  applicationName: project.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${bebas.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
