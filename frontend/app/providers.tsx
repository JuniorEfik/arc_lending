'use client'

import { ToastProvider } from '@/contexts/ToastContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  )
}
