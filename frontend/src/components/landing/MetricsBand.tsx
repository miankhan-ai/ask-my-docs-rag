import { motion } from 'framer-motion'
import { fadeUpDelay, fadeUp } from './motion'

const METRICS = [
  { value: '~500×', label: 'Faster on cached queries', sub: '5ms vs 2.7s cold' },
  { value: '80%', label: 'Cache hit rate', sub: 'Warm semantic cache' },
  { value: '≥ 0.8', label: 'Citation faithfulness', sub: 'LLM-as-judge eval threshold' },
  { value: '3.5/5', label: 'Answer correctness', sub: 'CI-gated quality floor' },
]

export function MetricsBand() {
  return (
    <section
      id="metrics"
      className="py-16 sm:py-20 bg-gradient-to-br from-primary-600 to-accent-600"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-6 sm:mb-10">
          <p className="text-primary-200 text-xs font-semibold uppercase tracking-widest mb-2">
            Measurable results
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Performance you can measure
          </h2>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              {...fadeUpDelay(i)}
              className="text-center"
            >
              <p className="text-4xl sm:text-5xl font-bold text-white tabular-nums">{m.value}</p>
              <p className="mt-1 text-primary-100 font-medium text-sm">{m.label}</p>
              <p className="text-primary-300 text-xs mt-0.5">{m.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
