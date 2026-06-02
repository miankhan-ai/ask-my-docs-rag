import { Github } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'

const LINKS: Record<string, Array<{ label: string; to: string }>> = {
  Product: [
    { label: 'Features', to: '/features' },
    { label: 'How it works', to: '/how-it-works' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Launch App', to: '/app' },
  ],
  Resources: [
    { label: 'Documentation', to: '/docs' },
    { label: 'GitHub', to: 'https://github.com' },
    { label: 'Changelog', to: '/changelog' },
    { label: 'Status', to: '/status' },
  ],
  Company: [
    { label: 'About', to: '/about' },
    { label: 'Blog', to: '/blog' },
    { label: 'Careers', to: '/careers' },
    { label: 'Contact', to: '/contact' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3 w-fit">
              <Logo size={24} />
              <span className="font-bold text-gray-900 text-sm">Ask My Docs</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              Production-grade RAG with cited, grounded answers. Self-hostable and open.
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-3">
                {section}
              </p>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.to.startsWith('http') ? (
                      <a
                        href={item.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        to={item.to}
                        className="text-sm text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Ask My Docs. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Built with FastAPI · React · pgvector · Groq
          </p>
        </div>
      </div>
    </footer>
  )
}
