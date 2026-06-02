import { Gavel, FlaskConical, Database, HeadphonesIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { SectionHeading } from '../ui/SectionHeading'
import { fadeUpDelay, fadeUp } from './motion'

const CASES = [
  {
    icon: Gavel,
    title: 'Legal & compliance',
    description:
      'Query contracts, policies, and regulations. Every answer traces back to a clause — audit-ready by design.',
  },
  {
    icon: FlaskConical,
    title: 'Research & academia',
    description:
      'Navigate dense papers and reports. Cited answers mean you always know which paper supports which claim.',
  },
  {
    icon: Database,
    title: 'Internal knowledge bases',
    description:
      'Replace manual search across wikis, runbooks, and SOPs. Ground truth, not guesswork.',
  },
  {
    icon: HeadphonesIcon,
    title: 'Support & documentation',
    description:
      'Let teams self-serve from product docs. Reduce ticket volume with answers that cite the exact help article.',
  },
]

export function UseCases() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mb-12">
          <SectionHeading
            eyebrow="Who it's for"
            title="Built for teams that can't afford to be wrong"
            subtitle="Anywhere accuracy and source transparency matter more than speed."
          />
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CASES.map((c, i) => {
            const Icon = c.icon
            return (
              <motion.div
                key={c.title}
                {...fadeUpDelay(i)}
                className="group p-6 rounded-2xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center mb-4 transition-colors">
                  <Icon className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{c.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{c.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
