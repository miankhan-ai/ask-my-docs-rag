import { motion } from 'framer-motion'
import { Check, X, HelpCircle } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { LinkButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { SectionHeading } from '../components/ui/SectionHeading'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Self-host on your own infrastructure. Full feature access, no vendor lock-in.',
    cta: 'Get started free',
    href: '/app',
    popular: false,
    features: [
      { text: 'Unlimited document uploads', yes: true },
      { text: 'PDF, DOCX, Markdown, TXT', yes: true },
      { text: 'Hybrid retrieval (BM25 + dense + RRF)', yes: true },
      { text: 'Cross-encoder reranking', yes: true },
      { text: 'Inline citation enforcement', yes: true },
      { text: 'SQLite or Postgres + pgvector', yes: true },
      { text: 'Local embedding models', yes: true },
      { text: 'Semantic caching (in-process)', yes: true },
      { text: 'Prometheus /metrics + /stats', yes: true },
      { text: 'Docker Compose deploy', yes: true },
      { text: 'Cloud embeddings (HF API)', yes: false },
      { text: 'Redis semantic cache', yes: false },
      { text: 'Email support', yes: false },
      { text: 'SSO / SAML', yes: false },
    ],
  },
  {
    name: 'Pro',
    price: '$49',
    period: 'per month',
    description: 'Managed hosting, cloud embeddings, Redis cache, and priority support.',
    cta: 'Start 14-day free trial',
    href: '/app',
    popular: true,
    features: [
      { text: 'Unlimited document uploads', yes: true },
      { text: 'PDF, DOCX, Markdown, TXT', yes: true },
      { text: 'Hybrid retrieval (BM25 + dense + RRF)', yes: true },
      { text: 'Cross-encoder reranking', yes: true },
      { text: 'Inline citation enforcement', yes: true },
      { text: 'Managed Postgres + pgvector', yes: true },
      { text: 'Cloud embeddings (HF API included)', yes: true },
      { text: 'Redis semantic cache', yes: true },
      { text: 'Prometheus /metrics + /stats', yes: true },
      { text: 'Hosted live dashboard', yes: true },
      { text: 'Email support (< 24h response)', yes: true },
      { text: 'SSO / SAML', yes: false },
      { text: 'SLA guarantee', yes: false },
      { text: 'On-prem deployment', yes: false },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'SSO, SLA guarantees, on-prem deployment, custom integrations, dedicated support.',
    cta: 'Contact sales',
    href: '/contact',
    popular: false,
    features: [
      { text: 'Unlimited document uploads', yes: true },
      { text: 'PDF, DOCX, Markdown, TXT', yes: true },
      { text: 'Hybrid retrieval (BM25 + dense + RRF)', yes: true },
      { text: 'Cross-encoder reranking', yes: true },
      { text: 'Inline citation enforcement', yes: true },
      { text: 'Managed Postgres + pgvector', yes: true },
      { text: 'Cloud embeddings (HF API included)', yes: true },
      { text: 'Redis semantic cache', yes: true },
      { text: 'Prometheus /metrics + /stats', yes: true },
      { text: 'Hosted live dashboard', yes: true },
      { text: 'Dedicated success manager', yes: true },
      { text: 'SSO / SAML', yes: true },
      { text: 'SLA guarantee (99.9% uptime)', yes: true },
      { text: 'On-prem deployment', yes: true },
    ],
  },
]

const FAQS = [
  {
    q: 'Can I self-host on my own servers?',
    a: 'Yes. The Free tier is a fully open build — run docker compose up and you have the entire stack running locally or on any cloud VM. Your documents never leave your infrastructure.',
  },
  {
    q: 'What LLM does Ask My Docs use?',
    a: 'By default we use Groq\'s llama-3.3-70b-versatile (free tier available). The LLM is configurable via the GROQ_MODEL environment variable. Bring your own Groq API key or point to any compatible endpoint.',
  },
  {
    q: 'How is the ~500× cache speedup achieved?',
    a: 'A two-layer cache: (1) an embedding cache keyed by SHA-256 text hash avoids recomputing vectors for repeated text, and (2) a semantic answer cache uses cosine similarity to detect near-duplicate queries and serve the cached answer (~5ms vs ~2.7s cold pipeline).',
  },
  {
    q: 'What evaluation metrics does the CI gate enforce?',
    a: 'Three thresholds on every PR: Retrieval Recall@k ≥ 0.7, Citation Faithfulness ≥ 0.8 (LLM-as-judge), and Answer Correctness ≥ 3.5/5.0. The GitHub Actions workflow fails the build if any metric drops below threshold.',
  },
  {
    q: 'Is there a data retention policy?',
    a: 'For the self-hosted Free tier, all data stays on your infrastructure — we have no access to your documents. Pro and Enterprise tiers have configurable retention policies with optional automatic deletion.',
  },
]

export function PricingPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Pricing</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-gray-500">
              Start for free. Self-host forever. Scale when you're ready.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tiers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              {...fadeUpDelay(i)}
              className={`bg-white rounded-2xl border p-7 flex flex-col ${
                tier.popular
                  ? 'border-primary-300 shadow-glow ring-2 ring-primary-200'
                  : 'border-gray-200 shadow-soft'
              }`}
            >
              {tier.popular && (
                <Badge variant="primary" className="w-fit mb-4">Most popular</Badge>
              )}
              <p className="text-lg font-bold text-gray-900">{tier.name}</p>
              <p className="mt-1">
                <span className="text-4xl font-bold text-gray-900 tabular-nums">{tier.price}</span>
                {tier.price !== 'Custom' && (
                  <span className="text-sm text-gray-400 ml-1">/{tier.period}</span>
                )}
              </p>
              {tier.price === 'Custom' && (
                <p className="text-sm text-gray-400 mt-1">{tier.period}</p>
              )}
              <p className="mt-3 text-sm text-gray-500 leading-relaxed mb-6">{tier.description}</p>

              <LinkButton
                to={tier.href}
                variant={tier.popular ? 'primary' : 'outline'}
                className="w-full justify-center mb-6"
              >
                {tier.cta}
              </LinkButton>

              <ul className="flex flex-col gap-2.5">
                {tier.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-sm">
                    {f.yes ? (
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                    )}
                    <span className={f.yes ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mb-12">
            <SectionHeading eyebrow="FAQ" title="Common questions" />
          </motion.div>
          <div className="flex flex-col gap-6">
            {FAQS.map((faq, i) => (
              <motion.div key={faq.q} {...fadeUpDelay(i)} className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-start gap-3 mb-3">
                  <HelpCircle className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                  <h3 className="font-semibold text-gray-900">{faq.q}</h3>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed pl-8">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
