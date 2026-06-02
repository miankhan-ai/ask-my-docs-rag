import { motion } from 'framer-motion'
import { Upload, Sparkles, FileText, Cpu, Search, GitMerge, Award, DollarSign } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { LinkButton } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const PIPELINE_STAGES = [
  {
    step: '01',
    icon: Upload,
    title: 'Upload your document',
    color: 'from-blue-500 to-primary-500',
    description:
      'Drag and drop any PDF, DOCX, Markdown, or plain text file. The server accepts it via a multipart POST request and immediately begins processing.',
    technical: 'FastAPI /upload endpoint · python-docx, pypdf, plain text parsers',
  },
  {
    step: '02',
    icon: FileText,
    title: 'Parse & chunk',
    color: 'from-primary-500 to-primary-600',
    description:
      'The document is parsed into raw text (per page for PDFs), then split into overlapping chunks using RecursiveCharacterTextSplitter. Each chunk stores its source filename, page number, and character offsets for precise citation.',
    technical: 'langchain_text_splitters · chunk_size=512, overlap=64 (configurable)',
  },
  {
    step: '03',
    icon: Cpu,
    title: 'Embed & store',
    color: 'from-primary-600 to-accent-500',
    description:
      'Each chunk is embedded using either a local sentence-transformers model (all-MiniLM-L6-v2, 384-dim, zero-infra) or the HuggingFace Inference API (BAAI/bge-large-en-v1.5, 1024-dim). Embeddings are stored alongside the chunk text in the vector store.',
    technical: 'sentence-transformers / HF Inference API · SQLite (local) or pgvector (production)',
  },
  {
    step: '04',
    icon: Search,
    title: 'Hybrid retrieval',
    color: 'from-accent-500 to-accent-600',
    description:
      'At query time, both BM25 (keyword) and dense vector search run in parallel. BM25 excels at exact term matches; dense search catches semantic similarity. Both run concurrently via asyncio.gather for minimum latency.',
    technical: 'rank-bm25 · pgvector <=> operator (cosine) · asyncio.gather',
  },
  {
    step: '05',
    icon: GitMerge,
    title: 'RRF fusion + cross-encoder reranking',
    color: 'from-accent-600 to-violet-600',
    description:
      'Reciprocal Rank Fusion combines the BM25 and dense candidate lists into a single ranked set (robust to score-scale differences). The top-20 fused results are then re-scored by a cross-encoder model that jointly scores each (query, passage) pair for a much more accurate final ranking.',
    technical: 'RRF: score = Σ 1/(k + rank_i), k=60 · cross-encoder/ms-marco-MiniLM-L-6-v2',
  },
  {
    step: '06',
    icon: Sparkles,
    title: 'Grounded generation',
    color: 'from-violet-600 to-primary-500',
    description:
      'The top-k reranked passages are injected into a grounding system prompt that instructs the model to cite inline using [1][2][3] markers and to refuse when context doesn\'t support an answer. The response streams token-by-token via SSE. A post-generation validator checks all citation markers.',
    technical: 'Groq llama-3.3-70b-versatile · SSE streaming · citation validator',
  },
  {
    step: '07',
    icon: Award,
    title: 'Citation delivery',
    color: 'from-primary-500 to-emerald-500',
    description:
      'The final SSE event carries the full citations array with source filename, page number, and passage text. The UI renders clickable [N] superscripts inline in the answer text. Clicking any citation opens a source drawer with the exact retrieved passage.',
    technical: 'done event: { citations, citation_warning, timings, cost_usd }',
  },
  {
    step: '08',
    icon: DollarSign,
    title: 'Observability & caching',
    color: 'from-emerald-500 to-teal-500',
    description:
      'Every query stage is timed and logged. Token counts and estimated USD cost are computed and surfaced in the UI. The embedding and semantic answer caches cut latency by ~500× on repeated queries. Prometheus /metrics and /stats expose all metrics for monitoring.',
    technical: 'stage_timer · StatsCollector · /metrics (Prometheus) · /stats (JSON)',
  },
]

export function HowItWorksPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Architecture</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              From upload to cited answer —{' '}
              <span className="text-gradient">every step explained</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed">
              Ask My Docs runs a full 8-stage pipeline on every query. Here's exactly what happens at each step.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-primary-200 via-accent-200 to-emerald-200 hidden sm:block" />

          <div className="flex flex-col gap-10">
            {PIPELINE_STAGES.map((stage, i) => {
              const Icon = stage.icon
              return (
                <motion.div
                  key={stage.step}
                  {...fadeUpDelay(i % 4)}
                  className="flex gap-6 sm:gap-8"
                >
                  {/* Step circle */}
                  <div className="shrink-0 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stage.color} flex items-center justify-center shadow-soft`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-gray-400 tabular-nums">STEP {stage.step}</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{stage.title}</h2>
                    <p className="text-gray-500 leading-relaxed mb-3">{stage.description}</p>
                    <code className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                      {stage.technical}
                    </code>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16">
        <motion.div {...fadeUp} className="max-w-2xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">See it in action</h2>
          <p className="text-gray-500 mb-8">Upload a document and watch every stage run in the retrieval debug view.</p>
          <LinkButton to="/app" size="lg">Launch the app →</LinkButton>
        </motion.div>
      </section>
    </PageLayout>
  )
}
