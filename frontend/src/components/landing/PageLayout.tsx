import type { ReactNode } from 'react'
import { LandingNav } from './LandingNav'
import { Footer } from './Footer'

interface PageLayoutProps {
  children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <LandingNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
