import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

// Per the Kindred Mind Design Foundation (docs/DESIGN_FOUNDATION.md),
// Inter is the single font family for the entire product. Loaded once at
// the root and exposed as the CSS variable `--font-sans`; every page
// inherits it from body styles.
//
// metadataBase is required by Next.js to resolve file-convention images
// (apps/web/app/opengraph-image.png, icon.png, apple-icon.png) into
// absolute URLs for social previews. Falls back to the production domain
// if NEXT_PUBLIC_APP_URL isn't set locally.
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kindred.haybee.xyz';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Kindred Mind — never let a loyal fan become a forgotten fan',
  description:
    'Kindred Mind quietly observes your Telegram community, remembers relationships, and helps creators build stronger connections — without becoming another chatbot.',
  openGraph: {
    title: 'Kindred Mind — never let a loyal fan become a forgotten fan',
    description:
      'Kindred Mind quietly observes your Telegram community, remembers relationships, and helps creators build stronger connections — without becoming another chatbot.',
    url: siteUrl,
    siteName: 'Kindred Mind',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kindred Mind — never let a loyal fan become a forgotten fan',
    description:
      'Kindred Mind quietly observes your Telegram community, remembers relationships, and helps creators build stronger connections — without becoming another chatbot.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
