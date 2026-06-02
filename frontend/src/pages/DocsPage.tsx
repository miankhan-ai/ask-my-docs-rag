import { motion } from 'framer-motion'
import { Book, Terminal, Settings, FlaskConical, Cpu, GitBranch, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const DOC_SECTIONS = [
  {
    icon: Book,
    title: 'Getting Started',
    description: 'Deploy Ask My Docs in under 5 minutes.',
    articles: [
      { title: 'Quick start with Docker Compose', time: '3 min' },
      { title: 'Running locally without Docker', time: '5 min' },
      { title: 'Uploading your first document', time: '2 min' },
      { title: 'Asking your first question', time: '2 min' },
    ],
  },
  {
    icon: Settings,
    title: 'Configuration',
    description: 'All settings via environment variables — no code changes needed.',
    articles: [
      { title: 'Environment variables reference', time: '5 min' },
      { title: 'Switching embedding backends (local vs HF API)', time: '3 min' },
      { title: 'Configuring the vector store (SQLite vs pgvector)', time: '4 min' },
      { title: 'Cache configuration (in-process vs Redis)', time: '3 min' },
    ],
  },
  {
    icon: Terminal,
    title: 'API Reference',
    description: 'REST endpoints and SSE event shapes.',
    articles: [
      { title: 'POST /upload — document ingestion', time: '2 min' },
      { title: 'POST /query — streaming SSE response', time: '4 min' },
      { title: 'GET /retrieval-debug — pipeline inspection', time: '3 min' },
      { title: 'GET /metrics and /stats — observability', time: '3 min' },
    ],
  },
  {
    icon: Cpu,
    title: 'Architecture',
    description: 'How the retrieval pipeline works under the hood.',
    articles: [
      { title: 'Pipeline overview: parse → chunk → embed → store', time: '5 min' },
      { title: 'Hybrid retrieval: BM25 + dense + RRF', time: '6 min' },
      { title: 'Cross-encoder reranking', time: '4 min' },
      { title: 'Citation enforcement and grounding', time: '4 min' },
    ],
  },
  {
    icon: FlaskConical,
    title: 'Evaluation',
    description: 'Run the CI-gated eval suite against your documents.',
    articles: [
      { title: 'Running the eval CLI', time: '3 min' },
      { title: 'Retrieval recall, faithfulness, correctness metrics', time: '5 min' },
      { title: 'Adding to your golden set', time: '4 min' },
      { title: 'GitHub Actions CI configuration', time: '3 min' },
    ],
  },
  {
    icon: GitBranch,
    title: 'Deployment',
    description: 'Take Ask My Docs to production.',
    articles: [
      { title: 'Docker Compose production setup', time: '5 min' },
      { title: 'Migrating from SQLite to Postgres+pgvector', time: '4 min' },
      { title: 'Setting up Redis for the semantic cache', time: '3 min' },
      { title: 'Prometheus + Grafana monitoring stack', time: '6 min' },
    ],
  },
]

export function DocsPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Documentation</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              Everything you need to{' '}
              <span className="text-gradient">build and deploy</span>
            </h1>
            <p className="text-xl text-gray-500">
              From quick-start Docker deployment to production-grade evaluation pipelines.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search bar (UI only) */}
      <div className="max-w-2xl mx-auto px-4 -mt-4 mb-12">
        <input
          type="text"
          placeholder="Search documentation…"
          className="w-full border border-gray-200 rounded-2xl px-5 py-3.5 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
        />
      </div>

      {/* Doc sections */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DOC_SECTIONS.map((section, i) => {
            const Icon = section.icon
            return (
              <motion.div
                key={section.title}
                {...fadeUpDelay(i % 3)}
                className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 hover:shadow-card hover:border-primary-100 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900">{section.title}</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{section.description}</p>
                <ul className="flex flex-col gap-2">
                  {section.articles.map((a) => (
                    <li key={a.title}>
                      <Link
                        to="#"
                        className="flex items-center justify-between group text-sm text-gray-600 hover:text-primary-600 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary-400 transition-colors" />
                          {a.title}
                        </span>
                        <span className="text-xs text-gray-400">{a.time}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </section>
    </PageLayout>
  )
}
