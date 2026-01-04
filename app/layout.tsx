import type { Metadata, Viewport } from 'next'
import { SetupChecker } from '@/components/setup-checker'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0a0a0a',
}

export const metadata: Metadata = {
  title: 'Mimirr - Book Request Management',
  description: 'Discover and request books for your personal library',
  applicationName: 'Mimirr',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mimirr',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SetupChecker />
        {children}
      </body>
    </html>
  )
}
