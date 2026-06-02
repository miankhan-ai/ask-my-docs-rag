import { LandingNav } from '../components/landing/LandingNav'
import { Hero } from '../components/landing/Hero'
import { TrustStrip } from '../components/landing/TrustStrip'
import { FeatureGrid } from '../components/landing/FeatureGrid'
import { HowItWorks } from '../components/landing/HowItWorks'
import { MetricsBand } from '../components/landing/MetricsBand'
import { UseCases } from '../components/landing/UseCases'
import { PricingTeaser } from '../components/landing/PricingTeaser'
import { FinalCTA } from '../components/landing/FinalCTA'
import { Footer } from '../components/landing/Footer'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNav />
      <main>
        <Hero />
        <TrustStrip />
        <FeatureGrid />
        <HowItWorks />
        <MetricsBand />
        <UseCases />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
