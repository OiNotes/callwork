import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { headers } from 'next/headers';
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from 'sonner';
import { VirtualGong } from '@/components/leaderboard/VirtualGong';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Callwork Premium",
  description: "Advanced Sales Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? undefined;

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta property="csp-nonce" content={nonce} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <VirtualGong />
        <Toaster position="top-right" richColors />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
