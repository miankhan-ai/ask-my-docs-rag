import { NavLink, Outlet, Link } from 'react-router-dom'
import { MessageSquare, LayoutDashboard } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { UserMenu } from '../components/UserMenu'
import { cn } from '../components/ui/cn'

export function AppLayout() {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary-600 text-white shadow-soft'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
    )

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between px-5 h-14 border-b border-gray-100 bg-white/90 backdrop-blur sticky top-0 z-30 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-900 hover:opacity-80 transition-opacity"
        >
          <Logo size={28} />
          <span className="font-semibold tracking-tight text-sm">Ask My Docs</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/app" end className={navLinkClass}>
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </NavLink>
          <NavLink to="/app/dashboard" className={navLinkClass}>
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </NavLink>
        </nav>
        <UserMenu />
      </header>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  )
}
