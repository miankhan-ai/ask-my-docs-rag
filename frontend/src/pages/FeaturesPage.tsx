import { motion } from 'framer-motion'
import {
  BookMarked, Layers, ShieldCheck, Zap, Activity, Rocket,
  BadgeCheck, Server, ChevronRight, ArrowRight,
} from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { SectionHeading } from '../components/ui/SectionHeading'
import { LinkButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const FEATURES = [
  {
    icon: BookMarked,
    tag: 'Retrieval',
    title: 'Inline citations — not just references',
    description:
      'Every answer contains numbered citations like [1][2] that map directly to the retrieved passage. Click any citation to see the exact source text, filename, and page number. There is no ambiguity about where the answer came from.',
    details: [
      'Inline [N] citation markers in every answer',
      'One-click source passage reveal with page numbers',
      'Citation validation: warns when markers don\'t match retrieved chunks',
      'Refuses to answer when context doesn\'t support a claim',
    ],
  },
  {
    icon: Layers,
    tag: 'Retrieval',
    title: 'Hybrid retrieval with two-stage ranking',
    description:
      'BM25 keyword search and dense vector search run in parallel, combined via Reciprocal Rank Fusion, then re-scored by a cross-encoder reranker. This two-stage approach catches both exact keyword matches and semantically similar passages that keyword search misses.',
    details: [
      'BM25 (rank-bm25) for exact keyword matching',
      'Dense vector search via pgvector cosine similarity',
      'RRF fusion — robust to scale differences between scores',
      'Cross-encoder (ms-marco-MiniLM-L-6-v2) second-stage reranking',
    ],
  },
  {
    icon: ShieldCheck,
    tag: 'Trust',
    title: 'Anti-hallucination grounding',
    description:
      'The system prompt explicitly instructs the model to cite only from retrieved context and to say "I don\'t have enough information" when context doesn\'t support an answer. A post-generation validator checks all citation markers and flags unverifiable claims.',
    details: [
      'System prompt enforces context-only answers',
      'Post-generation citation validator runs after every response',
      'citation_warning flag surfaced to the UI when citations are invalid',
      'Model trained refusal phrase for unsupported questions',
    ],
  },
  {
    icon: Zap,
    tag: 'Performance',
    title: 'Token-by-token streaming',
    description:
      'Answers stream via Server-Sent Events (SSE) from the first token. The UI renders each token as it arrives, so time-to-first-token (TTFT) is tracked separately from total generation time and visible in the live dashboard.',
    details: [
      'SSE streaming from /query endpoint',
      'Token events + final done event with citations',
      'TTFT tracked and exposed in per-answer debug panel',
      'Streaming cursor with graceful fallback',
    ],
  },
  {
    icon: Activity,
    tag: 'Observability',
    title: 'Live observability dashboard',
    description:
      'Every query is instrumented with per-stage timing (embed_query, bm25_search, dense_search, rrf_fuse, rerank, llm_ttft, llm_total), token counts, and estimated USD cost. The live dashboard polls /stats every 1.5s and renders recharts panels for latency, cost, cache hit ratio, and throughput.',
    details: [
      'Per-stage latency breakdown in every answer',
      'Prometheus /metrics endpoint for external scrapers',
      '/stats JSON endpoint for the in-app dashboard',
      'Token + cost accounting per query (configurable price table)',
    ],
  },
  {
    icon: Rocket,
    tag: 'Performance',
    title: '~500× caching speedup',
    description:
      'Two caching layers reduce latency and cost on repeated queries. An embedding cache (keyed by SHA-256 text hash) avoids recomputing vectors. A semantic answer cache serves near-duplicate queries (~5ms) instead of running the full pipeline (~2.7s).',
    details: [
      'Embedding cache: SHA-256 keyed, LRU+TTL, thread-safe',
      'Semantic answer cache: cosine similarity threshold (0.95 default)',
      '~5ms cached vs ~2.7s cold — ~500× speedup',
      '80% hit rate in practice on repeated-query workloads',
    ],
  },
  {
    icon: BadgeCheck,
    tag: 'Quality',
    title: 'CI-gated evaluation suite',
    description:
      'A golden Q&A set drives an automated eval suite on every PR. Three metrics are measured via LLM-as-judge and hard thresholds gate the build. Retrieval recall, citation faithfulness, and answer correctness are all tracked and enforced — regressions break the build.',
    details: [
      'Retrieval Recall@k ≥ 0.7 (fraction of expected sources found)',
      'Citation Faithfulness ≥ 0.8 (LLM-as-judge, per-citation 0/1 score)',
      'Answer Correctness ≥ 3.5/5 (LLM-as-judge rubric)',
      'GitHub Actions runs evals on every PR, fails on threshold breach',
    ],
  },
  {
    icon: Server,
    tag: 'Infrastructure',
    title: 'Swappable everything, self-hostable',
    description:
      'Every major component is configurable via environment variables. Swap embedding models, LLMs, vector stores, and cache backends without code changes. Deploy with one Docker Compose command on your own infrastructure — your data never leaves your servers.',
    details: [
      'Local or HuggingFace API embeddings',
      'SQLite (zero-infra) or PostgreSQL+pgvector',
      'In-process LRU or Redis cache',
      'docker compose up for one-command local deploy',
    ],
  },
]

export function FeaturesPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">All features</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              Everything you need for{' '}
              <span className="text-gradient">production RAG</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-8">
              Not just a chatbot wrapper. A complete, observable, quality-gated retrieval pipeline built for teams that care about accuracy.
            </p>
            <LinkButton to="/app" size="lg">
              Try it free <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </motion.div>
        </div>
      </section>

      {/* Feature deep-dives */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-16">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                {...fadeUpDelay(i % 4)}
                className="flex flex-col lg:flex-row gap-8"
              >
                {/* Left: icon + tag + title + body */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <Badge variant="neutral">{f.tag}</Badge>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">{f.title}</h2>
                  <p className="text-gray-500 leading-relaxed">{f.description}</p>
                </div>
                {/* Right: bullet details */}
                <div className="lg:w-72 shrink-0">
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      How it works
                    </p>
                    <ul className="flex flex-col gap-2">
                      {f.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-sm text-gray-600">
                          <ChevronRight className="h-4 w-4 text-primary-500 shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-50 py-16">
        <motion.div {...fadeUp} className="max-w-2xl mx-auto text-center px-4">
          <SectionHeading
            title="Ready to try it?"
            subtitle="Deploy in under a minute with Docker. No signup required."
          />
          <div className="mt-8 flex gap-3 justify-center">
            <LinkButton to="/app" size="lg">Launch App →</LinkButton>
            <LinkButton to="/docs" variant="outline" size="lg">Read the docs</LinkButton>
          </div>
        </motion.div>
      </section>
    </PageLayout>
  )
}
