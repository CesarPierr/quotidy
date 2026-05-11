import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "./globals.css";
import { ThemeProvider, ThemeScript } from "@/components/shared/theme-provider";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Quotidy",
    template: "%s · Quotidy",
  },
  description: "Organisez vos routines et votre budget. Partagez les responsabilités équitablement.",
  keywords: ["gestion foyer", "tâches ménagères", "épargne partagée", "planning familial", "équité"],
  authors: [{ name: "Quotidy" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quotidy",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "Quotidy — Gestion équitable du foyer",
    description: "Organisez vos routines et votre budget. Partagez les responsabilités équitablement.",
    siteName: "Quotidy",
  },
  twitter: {
    card: "summary",
    title: "Quotidy",
    description: "Organisez vos routines et votre budget. Partagez les responsabilités équitablement.",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#D8643D" },
    { media: "(prefers-color-scheme: dark)", color: "#e8704f" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable} h-full`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full bg-sand-50 text-ink-950 antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
