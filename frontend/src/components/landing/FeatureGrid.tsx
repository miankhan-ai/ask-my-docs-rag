import type { LucideIcon } from 'lucide-react'
import {
  BookMarked,
  Layers,
  ShieldCheck,
  Zap,
  Activity,
  Rocket,
  BadgeCheck,
  Server,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { SectionHeading } from '../ui/SectionHeading'
import { fadeUpDelay, fadeUp } from './motion'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: BookMarked,
    title: 'Inline citations',
    description:
      'Every answer cites exact passages with source filename and page number. One click reveals the full source text.',
  },
  {
    icon: Layers,
    title: 'Hybrid retrieval + reranking',
    description:
      'BM25 keyword search and dense vector search run in parallel, fused with Reciprocal Rank Fusion, then re-scored by a cross-encoder reranker.',
  },
  {
    icon: ShieldCheck,
    title: 'Anti-hallucination grounding',
    description:
      'The system refuses to answer when context doesn\'t support it, and flags unverifiable citations — so you always know what the model actually knows.',
  },
  {
    icon: Zap,
    title: 'Streaming answers',
    description:
      'Token-by-token SSE streaming keeps time-to-first-token low. Answers appear character-by-character, not after a 10-second wait.',
  },
  {
    icon: Activity,
    title: 'Live observability dashboard',
    description:
      'Per-stage latency (p50/p95), token counts, estimated USD cost, cache hit ratios, and throughput — all live, no Grafana required.',
  },
  {
    icon: Rocket,
    title: '~500× caching speedup',
    description:
      'Semantic answer cache serves repeated queries in ~5ms vs ~2.7s cold. 80% cache hit rate in practice. Per-query cost drops to $0 on hits.',
  },
  {
    icon: BadgeCheck,
    title: 'CI-gated eval quality',
    description:
      'A built-in eval suite gates every PR: retrieval recall@k ≥ 0.7, citation faithfulness ≥ 0.8, answer correctness ≥ 3.5/5. Quality regressions break the build.',
  },
  {
    icon: Server,
    title: 'Swappable & self-hostable',
    description:
      'Local or cloud embeddings, SQLite or Postgres+pgvector, in-process or Redis cache. One-command Docker deploy. Your data, your infra.',
  },
]

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon
  return (
    <motion.div
      {...fadeUpDelay(index)}
      className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 sm:p-6 hover:shadow-card hover:border-primary-100 transition-all"
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mb-3 sm:mb-4">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
    </motion.div>
  )
}

export function FeatureGrid() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mb-14">
          <SectionHeading
            eyebrow="Everything you need"
            title="Production-grade RAG, out of the box"
            subtitle="Not just a chatbot wrapper. A complete, observable, quality-gated retrieval pipeline with every component you need to ship with confidence."
          />
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
