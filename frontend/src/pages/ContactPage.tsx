import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MessageSquare, Github, CheckCircle2 } from 'lucide-react'
import { PageLayout } from '../components/landing/PageLayout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { fadeUp, fadeUpDelay } from '../components/landing/motion'

const CHANNELS = [
  {
    icon: Mail,
    title: 'Email',
    description: 'For sales, enterprise inquiries, and partnerships.',
    value: 'hello@askmydocs.io',
    href: 'mailto:hello@askmydocs.io',
  },
  {
    icon: Github,
    title: 'GitHub',
    description: 'Bug reports, feature requests, and open source contributions.',
    value: 'github.com/askmydocs',
    href: 'https://github.com',
  },
  {
    icon: MessageSquare,
    title: 'Community',
    description: 'Questions, discussions, and show-and-tell.',
    value: 'Discord server',
    href: '#',
  },
]

export function ContactPage() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real product this would POST to an API endpoint.
    setSent(true)
  }

  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary-50/60 to-white pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div {...fadeUp}>
            <Badge variant="primary" className="mb-5">Contact</Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
              Let's talk
            </h1>
            <p className="text-xl text-gray-500">
              Sales enquiries, enterprise deployments, bug reports, or just saying hi — we read everything.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <motion.div {...fadeUp}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send a message</h2>
            {sent ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <h3 className="text-xl font-semibold text-gray-900">Message sent!</h3>
                <p className="text-gray-500">We'll get back to you within one business day.</p>
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                  <input
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="How can we help?"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                  <textarea
                    required
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us about your use case, question, or feedback…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 resize-none"
                  />
                </div>
                <Button type="submit" variant="primary" size="lg" className="self-start">
                  Send message →
                </Button>
              </form>
            )}
          </motion.div>

          {/* Channels */}
          <div>
            <motion.div {...fadeUpDelay(1)} className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Other ways to reach us</h2>
              <div className="flex flex-col gap-4">
                {CHANNELS.map((c, i) => {
                  const Icon = c.icon
                  return (
                    <motion.a
                      key={c.title}
                      {...fadeUpDelay(i)}
                      href={c.href}
                      target={c.href.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="flex items-start gap-4 bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover:shadow-card hover:border-primary-100 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                          {c.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>
                        <p className="text-sm text-primary-600 mt-1">{c.value}</p>
                      </div>
                    </motion.a>
                  )
                })}
              </div>
            </motion.div>

            {/* Response time */}
            <motion.div {...fadeUpDelay(2)} className="bg-primary-50 rounded-2xl border border-primary-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Response times</h3>
              <ul className="flex flex-col gap-1.5 text-sm text-gray-600">
                <li className="flex justify-between">
                  <span>General enquiries</span>
                  <span className="text-gray-400">Within 24 hours</span>
                </li>
                <li className="flex justify-between">
                  <span>Enterprise / sales</span>
                  <span className="text-gray-400">Within 4 hours</span>
                </li>
                <li className="flex justify-between">
                  <span>Bug reports (GitHub)</span>
                  <span className="text-gray-400">Within 48 hours</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
