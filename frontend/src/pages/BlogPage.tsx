import { motion } from 'framer-motion'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const POSTS = [
  {
    slug: 'why-rag-hallucinations-happen',
    title: 'Why RAG systems hallucinate — and how to stop them',
    excerpt:
      'Most "chat with your docs" products confidently fabricate answers. The problem is not the LLM — it is the retrieval. Here is a systematic breakdown of every failure mode and how Ask My Docs addresses each one.',
    date: 'June 1, 2026',
    readTime: '8 min read',
    tag: 'Engineering',
    tagVariant: 'primary' as const,
    featured: true,
  },
  {
    slug: 'hybrid-retrieval-explained',
    title: 'BM25 + dense vectors + RRF: why hybrid retrieval beats either alone',
    excerpt:
      'Dense vector search misses exact keyword matches. BM25 misses semantic similarity. RRF fusion combines both without needing to tune weights between incompatible score scales. Here\'s why this matters for document Q&A.',
    date: 'May 25, 2026',
    readTime: '6 min read',
    tag: 'Engineering',
    tagVariant: 'primary' as const,
    featured: false,
  },
  {
    slug: 'cross-encoder-reranking',
    title: 'Cross-encoder reranking: the second stage that changes everything',
    excerpt:
      'Bi-encoder retrieval is fast but inaccurate. Cross-encoders are slow but much more accurate. The secret is running retrieval in two stages — fast bi-encoder for recall, cross-encoder for precision. Here\'s how we implemented it.',
    date: 'May 20, 2026',
    readTime: '5 min read',
    tag: 'Engineering',
    tagVariant: 'primary' as const,
    featured: false,
  },
  {
    slug: 'llm-as-judge-eval',
    title: 'LLM-as-judge for citation faithfulness: a practical rubric',
    excerpt:
      'How do you automatically measure whether an AI answer is supported by the source passages it cites? We use a structured LLM-as-judge prompt that scores faithfulness 0/1 per citation, with a per-run threshold that gates the CI build.',
    date: 'May 15, 2026',
    readTime: '7 min read',
    tag: 'Evaluation',
    tagVariant: 'success' as const,
    featured: false,
  },
  {
    slug: '500x-cache-speedup',
    title: 'How we achieved a ~500× speedup with semantic caching',
    excerpt:
      'Running the full RAG pipeline on every query is expensive and slow. Semantic caching — returning cached answers for near-duplicate queries — cuts latency from ~2.7s to ~5ms. Here is our implementation using cosine similarity.',
    date: 'May 10, 2026',
    readTime: '6 min read',
    tag: 'Performance',
    tagVariant: 'warning' as const,
    featured: false,
  },
  {
    slug: 'observability-for-rag',
    title: 'Observability for RAG: what to measure and why',
    excerpt:
      'Most AI applications are black boxes. We instrument every stage of the pipeline with per-stage latency, token counts, cost-per-query, and cache hit rates — then expose all of it in a live dashboard. Here\'s what we learned.',
    date: 'May 5, 2026',
    readTime: '5 min read',
    tag: 'Observability',
    tagVariant: 'neutral' as const,
    featured: false,
  },
]

export function BlogPage() {
  const [featured, ...rest] = POSTS

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Blog</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              Engineering behind{' '}
              <span className="text-gradient">trustworthy RAG</span>
            </h1>
            <p className="text-xl text-gray-500">
              Deep dives on retrieval, evaluation, caching, and production AI systems.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Featured post */}
        <motion.div {...fadeUp} className="mb-12">
          <Link
            to={`/blog/${featured.slug}`}
            className="group block bg-gradient-to-br from-primary-50 to-accent-50 rounded-3xl border border-primary-100 p-8 hover:shadow-lift transition-all"
          >
            <Badge variant={featured.tagVariant} className="mb-4">{featured.tag}</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 group-hover:text-primary-700 transition-colors">
              {featured.title}
            </h2>
            <p className="text-gray-500 leading-relaxed mb-4">{featured.excerpt}</p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {featured.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {featured.readTime}
              </span>
              <span className="ml-auto flex items-center gap-1 text-primary-600 font-medium group-hover:gap-2 transition-all">
                Read more <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </motion.div>

        {/* Post grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {rest.map((post, i) => (
            <motion.div key={post.slug} {...fadeUpDelay(i % 3)}>
              <Link
                to={`/blog/${post.slug}`}
                className="group block bg-white rounded-2xl border border-gray-100 shadow-soft p-6 hover:shadow-card hover:border-primary-100 transition-all h-full"
              >
                <Badge variant={post.tagVariant} className="mb-3">{post.tag}</Badge>
                <h2 className="font-bold text-gray-900 mb-2 group-hover:text-primary-700 transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {post.readTime}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </PageLayout>
  )
}
