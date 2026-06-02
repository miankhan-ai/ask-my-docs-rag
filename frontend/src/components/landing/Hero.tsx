import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { LinkButton } from '../ui/Button'
import { heroEntranceDelay } from './motion'
import { HeroChatDemo } from './HeroChatDemo'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-20 pb-24 sm:pt-28 sm:pb-32">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid opacity-60" />

      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-300/20 rounded-full blur-3xl animate-blob" />
      <div
        className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent-300/20 rounded-full blur-3xl animate-blob"
        style={{ animationDelay: '5s' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div {...heroEntranceDelay(0)}>
              <Badge variant="primary" className="mb-5 text-sm px-3 py-1">
                RAG that cites its sources ✦
              </Badge>
            </motion.div>

            <motion.h1
              {...heroEntranceDelay(1)}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-tight"
            >
              Chat with your docs.{' '}
              <span className="text-gradient">Every answer cites its source.</span>
            </motion.h1>

            <motion.p
              {...heroEntranceDelay(2)}
              className="mt-6 text-lg sm:text-xl text-gray-500 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Upload PDF, DOCX, Markdown, or TXT files and get streamed answers with
              inline citations, anti-hallucination grounding, and live cost observability.
            </motion.p>

            <motion.div
              {...heroEntranceDelay(3)}
              className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <LinkButton to="/app" size="lg">
                Try it free <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <a
                href="#how"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-medium text-gray-700 border border-gray-200 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                See how it works
              </a>
            </motion.div>

            <motion.p
              {...heroEntranceDelay(4)}
              className="mt-5 text-xs text-gray-400"
            >
              No signup required · Self-hostable · Open observability
            </motion.p>
          </div>

          {/* Right: chat demo */}
          <motion.div {...heroEntranceDelay(2)} className="flex-1 w-full lg:flex-none lg:w-auto">
            <HeroChatDemo />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
