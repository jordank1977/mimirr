'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

interface User {
  id: number
  username: string
  email: string
  displayName: string
  role: string
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session')

        if (!response.ok) {
          router.push('/login')
          return
        }

        const data = await response.json()
        setUser(data.user)
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Automatic Polling for Book Requests
  useEffect(() => {
    if (!user) return

    // Function to trigger polling
    const pollRequests = async () => {
      try {
        const response = await fetch('/api/requests/poll', {
          method: 'POST'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.updated > 0) {
            console.info(`[Mimirr] Polled requests: ${data.checked} checked, ${data.updated} updated.`)
            // We could potentially trigger a global state refresh here if needed,
            // but the status is mostly displayed on specific pages that fetch their own data.
          }
        }
      } catch (error) {
        // Silently fail polling to not disturb the user experience
        console.error('[Mimirr] Error polling requests:', error)
      }
    }

    // Run immediately on mount
    pollRequests()

    // Set up interval (every 60 seconds)
    const interval = setInterval(pollRequests, 60000)

    return () => clearInterval(interval)
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground-muted">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} />
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <Footer />
    </div>
  )
}
