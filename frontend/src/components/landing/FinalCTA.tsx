import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { LinkButton } from '../ui/Button'
import { fadeUp } from './motion'

export function FinalCTA() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          {...fadeUp}
          className="relative bg-gradient-to-br from-primary-600 to-accent-600 rounded-3xl px-8 py-14 overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Start chatting with your documents today
            </h2>
            <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
              No signup. No credit card. Deploy with Docker in under a minute.
            </p>
            <LinkButton
              to="/app"
              variant="secondary"
              size="lg"
              className="bg-white text-primary-700 hover:bg-primary-50 shadow-lift"
            >
              Launch App — it's free <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
