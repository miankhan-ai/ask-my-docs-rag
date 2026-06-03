import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { SectionHeading } from '../ui/SectionHeading'
import { LinkButton } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { fadeUpDelay, fadeUp } from './motion'

interface Tier {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  popular?: boolean
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    description: 'Self-host with Docker. Full feature access, your infrastructure.',
    features: [
      'All retrieval & ranking features',
      'SQLite or Postgres+pgvector',
      'Local embedding models',
      'Semantic caching',
      'Prometheus metrics',
      'Community support',
    ],
    cta: 'Get started free',
  },
  {
    name: 'Pro',
    price: '$49',
    description: 'Managed hosting, cloud embeddings, Redis cache, and priority support.',
    features: [
      'Everything in Free',
      'Managed Postgres+pgvector',
      'Cloud embeddings (HF API)',
      'Redis semantic cache',
      'Live dashboard hosted',
      'Email support',
    ],
    cta: 'Start free trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'SSO, SLA, on-prem, custom integrations, and dedicated support.',
    features: [
      'Everything in Pro',
      'SSO / SAML',
      'SLA guarantees',
      'On-prem deployment',
      'Custom integrations',
      'Dedicated success manager',
    ],
    cta: 'Contact sales',
  },
]

export function PricingTeaser() {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mb-14">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple, transparent pricing"
            subtitle="Start for free. Scale when you're ready."
          />
        </motion.div>
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 items-start">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              {...fadeUpDelay(i)}
              className={`bg-white rounded-2xl border p-4 sm:p-7 flex flex-col ${
                tier.popular
                  ? 'border-primary-300 shadow-glow ring-2 ring-primary-200'
                  : 'border-gray-200 shadow-soft'
              }`}
            >
              {tier.popular && (
                <Badge variant="primary" className="w-fit mb-4">
                  Most popular
                </Badge>
              )}
              <p className="text-lg font-bold text-gray-900">{tier.name}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">
                {tier.price}
                {tier.price !== 'Custom' && (
                  <span className="text-base font-normal text-gray-400">/mo</span>
                )}
              </p>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">{tier.description}</p>
              <ul className="mt-6 flex flex-col gap-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <LinkButton
                to="/app"
                variant={tier.popular ? 'primary' : 'outline'}
                className="mt-8 w-full justify-center"
              >
                {tier.cta}
              </LinkButton>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
