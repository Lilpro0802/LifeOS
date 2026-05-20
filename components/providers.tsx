'use client'

import { AppProvider } from '@/lib/app-context'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>
}
