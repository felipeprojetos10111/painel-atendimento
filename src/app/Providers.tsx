'use client'

import { LinguaProvider } from '@/contexts/LinguaContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return <LinguaProvider>{children}</LinguaProvider>
}
