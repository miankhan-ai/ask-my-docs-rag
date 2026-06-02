import { motion } from 'framer-motion'
import { Sparkles, Zap, ShieldCheck, Activity, ArrowRight } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { LinkButton } from '../components/ui/Button'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const RELEASES = [
  {
    version: '1.3.0',
    date: 'June 2, 2026',
    tag: 'Major',
    tagVariant: 'primary' as const,
    title: 'Observability, semantic caching & live dashboard',
    icon: Activity,
    highlights: [
      'Per-stage latency instrumentation across the full RAG pipeline',
      'Prometheus /metrics endpoint + compact /stats JSON for the live dashboard',
      'In-app live dashboard with 4 recharts panels (latency, tokens/cost, cache, throughput)',
      'Embedding cache (SHA-256 keyed LRU, thread-safe) — avoids recomputing vectors',
      'Semantic answer cache (~5ms cached vs ~2.7s cold, ~500× speedup, 80% hit rate)',
      'Optional Redis backend for the embedding cache',
      'Token + USD cost accounting per query (Groq usage endpoint)',
      'benchmark/run_benchmark.py — before/after cache comparison table',
      'Locust load test configuration',
    ],
  },
  {
    version: '1.2.0',
    date: 'May 28, 2026',
    tag: 'Feature',
    tagVariant: 'success' as const,
    title: 'Document management, chat history & UI fixes',
    icon: Sparkles,
    highlights: [
      'GET /documents and DELETE /documents/{id} — document list + per-document deletion',
      'Document list persists across page reloads (loaded from API on mount)',
      'Chat history: full conversation persists in UI state across multiple turns',
      'Fixed dropzone recursive-click bug (file input is now a sibling, not a child)',
      'Delete-all bug fixed: delete button stopPropagation prevents stacked-modal bleed-through',
    ],
  },
  {
    version: '1.1.0',
    date: 'May 22, 2026',
    tag: 'Feature',
    tagVariant: 'success' as const,
    title: 'SQLite local backend & Python 3.14 support',
    icon: Zap,
    highlights: [
      'db_backend=sqlite config flag — embeddings stored as JSON, cosine search in Python',
      'EmbeddingType TypeDecorator — pgvector Vector on Postgres, JSON-TEXT on SQLite',
      'embedding_dim config — dimension-agnostic column, works with any sentence-transformers model',
      'Default local embedding model switched to all-MiniLM-L6-v2 (384-dim, ~90MB)',
      'All 40 backend tests pass on Python 3.14 without Docker or Postgres',
      'aiosqlite added to requirements',
    ],
  },
  {
    version: '1.0.0',
    date: 'June 1, 2026',
    tag: 'Launch',
    tagVariant: 'primary' as const,
    title: 'Initial release — full-stack RAG with CI-gated evals',
    icon: ShieldCheck,
    highlights: [
      'PDF, DOCX, Markdown, TXT ingestion with recursive chunking',
      'BM25 + dense vector (pgvector) hybrid retrieval with RRF fusion',
      'Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)',
      'Groq-powered grounded generation with inline citation enforcement',
      'Server-Sent Events (SSE) streaming',
      'React 18 + TypeScript + Vite + Tailwind frontend with citation drawer and retrieval debug view',
      'CI-gated eval suite: recall@k ≥ 0.7, faithfulness ≥ 0.8, correctness ≥ 3.5/5',
      'GitHub Actions workflow on every PR',
      'Docker Compose for one-command local startup',
    ],
  },
]

export function ChangelogPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Changelog</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              What's new in Ask My Docs
            </h1>
            <p className="text-xl text-gray-500">
              Every release, every improvement — fully documented.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Releases */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col gap-12">
          {RELEASES.map((release, i) => {
            const Icon = release.icon
            return (
              <motion.div key={release.version} {...fadeUpDelay(i % 4)}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 text-lg">v{release.version}</span>
                      <Badge variant={release.tagVariant}>{release.tag}</Badge>
                      <span className="text-sm text-gray-400">{release.date}</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">{release.title}</h2>
                  </div>
                </div>
                <div className="ml-14 bg-gray-50 rounded-2xl border border-gray-100 p-5">
                  <ul className="flex flex-col gap-2">
                    {release.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-gray-600">
                        <ArrowRight className="h-3.5 w-3.5 text-primary-400 shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="bg-gray-50 py-12">
        <motion.div {...fadeUp} className="max-w-xl mx-auto text-center px-4">
          <p className="text-gray-500 mb-4">Want to follow new releases?</p>
          <LinkButton to="/app" variant="outline">Subscribe to updates</LinkButton>
        </motion.div>
      </section>
    </PageLayout>
  )
}
