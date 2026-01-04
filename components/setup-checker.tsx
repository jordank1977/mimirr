'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function SetupChecker() {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Don't check if already on setup page or API routes
    if (pathname.startsWith('/setup') || pathname.startsWith('/api')) {
      setChecking(false)
      return
    }

    async function checkSetup() {
      try {
        const response = await fetch('/api/setup')

        // If API fails, assume setup is needed (fail-safe)
        if (!response.ok) {
          console.error('Setup API failed, redirecting to setup')
          router.push('/setup')
          return
        }

        const data = await response.json()

        if (data.needsSetup) {
          router.push('/setup')
        }
      } catch (error) {
        console.error('Failed to check setup status:', error)
        // On error, redirect to setup as fail-safe
        router.push('/setup')
      } finally {
        setChecking(false)
      }
    }

    checkSetup()
  }, [pathname, router])

  // Show nothing while checking (prevents flash of content)
  if (checking) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return null
}
