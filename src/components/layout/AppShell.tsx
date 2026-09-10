import type { ReactNode } from 'react'
import { TopNav } from './TopNav'
import { Footer } from './Footer'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav />
      <main className="flex-1">
        <div className="container-content py-xxl">{children}</div>
      </main>
      <Footer />
    </div>
  )
}
