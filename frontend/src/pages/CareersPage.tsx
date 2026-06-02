import { motion } from 'framer-motion'
import { MapPin, Clock, ArrowRight, Code2, Sparkles, BarChart3 } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { LinkButton } from '../components/ui/Button'
import { SectionHeading } from '../components/ui/SectionHeading'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const OPENINGS = [
  {
    title: 'Senior ML / AI Engineer',
    team: 'Engineering',
    location: 'Remote (worldwide)',
    type: 'Full-time',
    icon: Sparkles,
    description:
      'Own the retrieval and ranking pipeline. Work on novel chunking strategies, embedding model evaluation, reranking improvements, and the eval framework. You will use Python, FastAPI, and sentence-transformers every day.',
    requirements: [
      '3+ years building ML/NLP/RAG systems in Python',
      'Deep understanding of information retrieval (BM25, dense search, reranking)',
      'Experience with LLM APIs and prompt engineering',
      'Strong testing and evaluation mindset',
    ],
  },
  {
    title: 'Full-stack Engineer (React + Python)',
    team: 'Engineering',
    location: 'Remote (worldwide)',
    type: 'Full-time',
    icon: Code2,
    description:
      'Build the frontend (React, TypeScript, Tailwind) and backend (FastAPI, SQLAlchemy) features that make Ask My Docs feel like a premium product. You will work on everything from the live dashboard to the streaming citation UI to the document ingestion pipeline.',
    requirements: [
      '3+ years full-stack experience (React + Python)',
      'Comfortable with TypeScript and async Python',
      'Experience with SSE or WebSockets',
      'Product taste — you care about what the user actually experiences',
    ],
  },
  {
    title: 'Developer Relations / Technical Writer',
    team: 'Growth',
    location: 'Remote (worldwide)',
    type: 'Full-time',
    icon: BarChart3,
    description:
      'Write tutorials, create demos, and grow the developer community around Ask My Docs. Translate complex retrieval concepts into blog posts and documentation that developers actually want to read.',
    requirements: [
      'Ability to write clear technical content for a developer audience',
      'Comfortable running and explaining LLM/RAG demos',
      'Experience building developer communities (Discord, GitHub, Twitter)',
      'Bonus: Python or TypeScript experience',
    ],
  },
]

const PERKS = [
  { emoji: '🌍', title: 'Fully remote', desc: 'Work from anywhere in the world' },
  { emoji: '🏖️', title: 'Unlimited PTO', desc: 'We trust you to manage your time' },
  { emoji: '💻', title: 'Equipment budget', desc: '$2,000 to set up your ideal workspace' },
  { emoji: '📚', title: 'Learning budget', desc: '$1,500/year for courses, books, conferences' },
  { emoji: '🏥', title: 'Health coverage', desc: 'Full medical, dental, and vision' },
  { emoji: '🚀', title: 'Equity', desc: 'Meaningful early-stage equity' },
]

export function CareersPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Careers</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              Help us make AI answers{' '}
              <span className="text-gradient">worth trusting</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
              We are a small team building production-grade RAG infrastructure. We value rigour, transparency, and shipping things that actually work.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Perks */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PERKS.map((p, i) => (
              <motion.div key={p.title} {...fadeUpDelay(i % 3)} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-soft">
                <p className="text-2xl mb-2">{p.emoji}</p>
                <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Openings */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div {...fadeUp} className="mb-10">
          <SectionHeading center={false} eyebrow="Open roles" title="Join the team" />
        </motion.div>
        <div className="flex flex-col gap-6">
          {OPENINGS.map((role, i) => {
            const Icon = role.icon
            return (
              <motion.div
                key={role.title}
                {...fadeUpDelay(i)}
                className="bg-white rounded-2xl border border-gray-100 shadow-soft p-7"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">{role.title}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <Badge variant="neutral">{role.team}</Badge>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {role.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {role.type}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed mb-4">{role.description}</p>
                <div className="bg-gray-50 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
                  <ul className="flex flex-col gap-1.5">
                    {role.requirements.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm text-gray-600">
                        <ArrowRight className="h-3.5 w-3.5 text-primary-400 shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <LinkButton to="/contact" variant="primary">
                  Apply now <ArrowRight className="h-4 w-4" />
                </LinkButton>
              </motion.div>
            )
          })}
        </div>
      </section>
    </PageLayout>
  )
}
