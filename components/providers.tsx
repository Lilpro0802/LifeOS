'use client'

import { AppProvider } from '@/lib/app-context'
import { useSmsBridge } from '@/hooks/use-sms-bridge'
import type { ReactNode } from 'react'

function SmsBridgeInitializer() {
  useSmsBridge()
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <SmsBridgeInitializer />
      {children}
    </AppProvider>
  )
}
