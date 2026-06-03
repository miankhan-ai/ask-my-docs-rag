import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { FeaturesPage } from './pages/FeaturesPage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { PricingPage } from './pages/PricingPage'
import { DocsPage } from './pages/DocsPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { StatusPage } from './pages/StatusPage'
import { AboutPage } from './pages/AboutPage'
import { BlogPage } from './pages/BlogPage'
import { CareersPage } from './pages/CareersPage'
import { ContactPage } from './pages/ContactPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { AppLayout } from './app/AppLayout'
import { ChatLayout } from './app/ChatLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

const Dashboard = lazy(() =>
  import('./components/Dashboard').then((m) => ({ default: m.Dashboard })),
)

const DashboardFallback = (
  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
    Loading dashboard…
  </div>
)

export default function App() {
  return (
    <Routes>
      {/* Marketing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected app */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ChatLayout />} />
        <Route
          path="dashboard"
          element={<Suspense fallback={DashboardFallback}><Dashboard /></Suspense>}
        />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}
