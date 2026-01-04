import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mimirr - Book Discovery & Requests',
    short_name: 'Mimirr',
    description: 'Discover and request books for your personal library through Bookshelf',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['books', 'entertainment', 'utilities'],
    shortcuts: [
      {
        name: 'Discover Books',
        short_name: 'Discover',
        description: 'Browse and discover new books',
        url: '/discover',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My Requests',
        short_name: 'Requests',
        description: 'View your book requests',
        url: '/requests',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
