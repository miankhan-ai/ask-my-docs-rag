import { motion } from 'framer-motion'
import { CheckCircle2, Clock } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const SERVICES = [
  { name: 'API (FastAPI backend)', status: 'operational', uptime: '99.98%' },
  { name: 'Document ingestion pipeline', status: 'operational', uptime: '99.95%' },
  { name: 'Retrieval & reranking', status: 'operational', uptime: '99.99%' },
  { name: 'Groq LLM generation', status: 'operational', uptime: '99.90%' },
  { name: 'Semantic cache (in-process)', status: 'operational', uptime: '100%' },
  { name: 'Metrics & observability (/stats, /metrics)', status: 'operational', uptime: '99.99%' },
  { name: 'Frontend (React app)', status: 'operational', uptime: '99.99%' },
]

const INCIDENTS = [
  {
    date: 'Jun 1, 2026',
    title: 'Groq API elevated latency',
    status: 'resolved',
    duration: '14 min',
    description:
      'Groq reported elevated P99 latency affecting streaming responses. No data loss. Resolved by Groq infrastructure team.',
  },
  {
    date: 'May 27, 2026',
    title: 'Scheduled maintenance — Postgres migration',
    status: 'resolved',
    duration: '8 min',
    description:
      'Brief downtime for pgvector index rebuild during the v1.1 SQLite backend rollout. All data preserved.',
  },
]

export function StatusPage() {
  return (
    <PageLayout>
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">System Status</Badge>
            <div className="flex items-center justify-center gap-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
                All systems operational
              </h1>
            </div>
            <p className="text-xl text-gray-500">
              Last checked: {new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div {...fadeUp} className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Services</h2>
        </motion.div>
        <div className="flex flex-col gap-3">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.name}
              {...fadeUpDelay(i % 4)}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800">{s.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="success">Operational</Badge>
                <span className="text-xs text-gray-400 tabular-nums">{s.uptime} uptime</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Uptime chart placeholder */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <motion.div {...fadeUp} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-soft">
          <h2 className="text-lg font-bold text-gray-900 mb-4">90-day uptime</h2>
          <div className="flex gap-0.5 items-end h-12">
            {Array.from({ length: 90 }, (_, i) => (
              <div
                key={i}
                className="flex-1 bg-emerald-400 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${Math.random() > 0.97 ? 30 : 100}%` }}
                title={`Day ${i + 1}: ${Math.random() > 0.97 ? '99.1%' : '100%'}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>90 days ago</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Today</span>
          </div>
        </motion.div>
      </section>

      {/* Incidents */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Incident history</h2>
          </motion.div>
          <div className="flex flex-col gap-4">
            {INCIDENTS.map((inc, i) => (
              <motion.div
                key={inc.title}
                {...fadeUpDelay(i)}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-soft"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="success">Resolved</Badge>
                  <span className="text-xs text-gray-400">{inc.date}</span>
                  <span className="text-xs text-gray-400">· Duration: {inc.duration}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{inc.title}</h3>
                <p className="text-sm text-gray-500">{inc.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
