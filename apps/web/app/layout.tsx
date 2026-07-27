import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// metadataBase is required by Next.js to resolve file-convention images
// (apps/web/app/opengraph-image.png, icon.png, apple-icon.png) into
// absolute URLs for social previews. Falls back to the production domain
// if NEXT_PUBLIC_APP_URL isn't set locally.
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kindred.haybee.xyz';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Kindred',
  description: 'Never let a loyal fan become a forgotten fan.',
  openGraph: {
    title: 'Kindred',
    description: 'Never let a loyal fan become a forgotten fan.',
    url: siteUrl,
    siteName: 'Kindred',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kindred',
    description: 'Never let a loyal fan become a forgotten fan.',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
