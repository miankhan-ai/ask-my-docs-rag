import { Upload, MessageSquare, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { SectionHeading } from '../ui/SectionHeading'
import { fadeUpDelay, fadeUp } from './motion'

const STEPS = [
  {
    icon: Upload,
    number: '01',
    title: 'Upload your documents',
    description:
      'Drag-and-drop PDF, DOCX, Markdown, or TXT files. The pipeline parses, chunks, and embeds them automatically.',
  },
  {
    icon: MessageSquare,
    number: '02',
    title: 'Ask in natural language',
    description:
      'Type any question. Hybrid retrieval finds the most relevant passages using both keyword and semantic search.',
  },
  {
    icon: Sparkles,
    number: '03',
    title: 'Get cited, grounded answers',
    description:
      "Stream back answers with inline [1][2] citations. Click any citation to see the exact source passage. The model refuses when it doesn't know.",
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mb-14">
          <SectionHeading
            eyebrow="How it works"
            title="From document to cited answer in seconds"
          />
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-8 left-[17%] right-[17%] h-px bg-gradient-to-r from-primary-200 via-accent-200 to-primary-200" />

          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                {...fadeUpDelay(i)}
                className="flex flex-col items-center text-center"
              >
                <div className="relative mb-4 sm:mb-5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lift">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-primary-200 text-xs font-bold text-primary-600 flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
