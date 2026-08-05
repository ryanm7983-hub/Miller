import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AuditReady — Know exactly what you’re missing before the auditor arrives',
    template: '%s · AuditReady',
  },
  description:
    'AuditReady organizes your requirements, analyzes your evidence with AI, and shows your team exactly what needs attention before an audit. Built for small manufacturers and lean quality teams.',
  keywords: [
    'audit readiness',
    'audit preparation software',
    'quality management',
    'evidence management',
    'gap analysis',
    'compliance readiness',
    'internal audit',
  ],
  openGraph: {
    title: 'AuditReady — Know you’re ready before the auditor arrives',
    description:
      'Upload your evidence. Let AI identify gaps, organize requirements, and show your team exactly what needs attention.',
    type: 'website',
    siteName: 'AuditReady',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0A6659',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
