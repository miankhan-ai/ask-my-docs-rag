import { motion } from 'framer-motion'
import { Target, Shield, Cpu, Users, ArrowRight } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { LinkButton } from '../components/ui/Button'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const VALUES = [
  {
    icon: Shield,
    title: 'Truth over convenience',
    description:
      'It is always better to say "I don\'t know" than to fabricate an answer. Every Ask My Docs response is grounded in what the document actually says — nothing more, nothing less.',
  },
  {
    icon: Target,
    title: 'Precision at the source',
    description:
      'Vague answers are useless when stakes are high. We built inline citation enforcement from day one because "the document says so" is not good enough — you need to be able to verify it.',
  },
  {
    icon: Cpu,
    title: 'Transparency of process',
    description:
      'Every stage of the retrieval pipeline — BM25, dense search, RRF fusion, reranking — is visible and inspectable. The retrieval debug view and live dashboard are not afterthoughts; they are core features.',
  },
  {
    icon: Users,
    title: 'Your data, your infrastructure',
    description:
      'We built Ask My Docs to be fully self-hostable from day one. Your documents never have to leave your servers. The free tier is a complete product, not a crippled trial.',
  },
]

const TEAM = [
  {
    name: 'Mian Khan',
    role: 'Founder & Engineer',
    bio: 'Full-stack AI/ML engineer with deep expertise in RAG systems, LLM application development, and production-grade Python/TypeScript. Built Ask My Docs to solve the hallucination problem in enterprise document Q&A.',
    avatar: 'MK',
  },
]

export function AboutPage() {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">About</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              We built Ask My Docs because{' '}
              <span className="text-gradient">hallucinations are unacceptable</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed">
              Every existing document Q&A tool we tested would confidently give wrong answers. We decided to fix that — properly.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Origin story */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div {...fadeUp} className="prose prose-gray max-w-none">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The problem we set out to solve</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Document-grounded Q&A has a simple requirement: the answer should come from the document, and you should be able to verify it. Yet almost every "chat with your docs" product we tested would confidently fabricate details, mix up documents, or — worst — present hallucinated legal terms as if they were verbatim quotes.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            The root cause is not the LLM — it is the retrieval. If the wrong passages reach the model, the model has nothing to cite. If the pipeline has no grounding enforcement, the model fills gaps with plausible-sounding fabrications. The solution is to fix the retrieval and enforce grounding at every layer.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Ask My Docs is built on a two-stage retrieval pipeline (BM25 + dense search → RRF → cross-encoder reranking) that dramatically improves the quality of passages reaching the model. A grounding system prompt and post-generation citation validator enforce that the model cites only what was retrieved — and refuse to answer when the retrieved context does not support the question.
          </p>
          <p className="text-gray-600 leading-relaxed">
            We did not stop at the pipeline. We built a CI-gated evaluation suite that measures retrieval recall, citation faithfulness, and answer correctness on every pull request. We built a live observability dashboard. We built caching that makes repeated queries 500× faster. We made every component swappable and self-hostable. The result is a product you can trust with documents that actually matter.
          </p>
        </motion.div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">What we stand for</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map((v, i) => {
              const Icon = v.icon
              return (
                <motion.div
                  key={v.title}
                  {...fadeUpDelay(i % 2)}
                  className="bg-white rounded-2xl border border-gray-100 p-6 shadow-soft"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">The team</h2>
        </motion.div>
        <div className="flex flex-wrap justify-center gap-8">
          {TEAM.map((member, i) => (
            <motion.div
              key={member.name}
              {...fadeUpDelay(i)}
              className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg">
                  {member.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{member.name}</p>
                  <p className="text-sm text-primary-600">{member.role}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{member.bio}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-12">
        <motion.div {...fadeUp} className="max-w-xl mx-auto text-center px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Try it yourself</h2>
          <p className="text-gray-500 mb-6">Upload a document. Ask a question. See every citation trace back to the source.</p>
          <LinkButton to="/app" size="lg">
            Launch Ask My Docs <ArrowRight className="h-4 w-4" />
          </LinkButton>
        </motion.div>
      </section>
    </PageLayout>
  )
}
