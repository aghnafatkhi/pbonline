import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { brandConfig } from '@/lib/brand';

export const metadata: Metadata = {
  title: brandConfig.brandName,
  description: brandConfig.description,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
