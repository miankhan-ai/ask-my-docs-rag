import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'
import { LinkButton } from '../ui/Button'

const NAV_LINKS = [
  { label: 'Features', to: '/features' },
  { label: 'How it works', to: '/how-it-works' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog' },
]

export function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold tracking-tight text-gray-900">Ask My Docs</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <LinkButton to="/login" variant="secondary" size="sm">
            Sign in
          </LinkButton>
          <LinkButton to="/register" size="sm">
            Get started →
          </LinkButton>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-500 hover:text-gray-800"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-gray-600 hover:text-primary-600"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <LinkButton to="/register" size="sm" className="mt-2">
            Get started →
          </LinkButton>
        </div>
      )}
    </header>
  )
}
