import { motion } from 'framer-motion'
import { fadeUp } from './motion'

const ITEMS = ['PDF', 'DOCX', 'Markdown', 'TXT', 'Postgres + pgvector', 'SQLite', 'Redis', 'Docker']

export function TrustStrip() {
  return (
    <motion.section
      {...fadeUp}
      className="border-y border-gray-100 bg-gray-50/60 py-6"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-4">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mr-2">Works with</span>
        {ITEMS.map((item) => (
          <span
            key={item}
            className="px-3 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full"
          >
            {item}
          </span>
        ))}
      </div>
    </motion.section>
  )
}
