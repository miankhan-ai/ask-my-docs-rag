import { useEffect, useRef, useState } from 'react'
import { Sparkles, Zap } from 'lucide-react'

interface DemoCitation {
  id: number
  text: string
}

interface DemoMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: DemoCitation[]
  showSpeedup?: boolean
}

const SCRIPT: DemoMessage[] = [
  {
    role: 'user',
    content: 'What is the remote work policy?',
  },
  {
    role: 'assistant',
    content:
      'Employees may work remotely up to 3 days per week [1]. Fully remote arrangements require director-level approval and a signed remote-work agreement [1].',
    citations: [
      {
        id: 1,
        text: 'Employees may work remotely up to 3 days per week. Fully remote arrangements require director-level approval.',
      },
    ],
  },
  {
    role: 'user',
    content: 'What is the remote work policy?',
  },
  {
    role: 'assistant',
    content:
      'Employees may work remotely up to 3 days per week [1]. Fully remote arrangements require director-level approval and a signed remote-work agreement [1].',
    citations: [
      {
        id: 1,
        text: 'Employees may work remotely up to 3 days per week. Fully remote arrangements require director-level approval.',
      },
    ],
    showSpeedup: true,
  },
]

function renderDemoText(text: string, onCite: (id: number) => void) {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/)
    if (m) {
      const n = parseInt(m[1])
      return (
        <sup
          key={i}
          onClick={() => onCite(n)}
          className="cursor-pointer inline-flex items-center justify-center w-4 h-4 rounded
            bg-primary-50 text-primary-600 hover:bg-primary-100 text-[10px] font-semibold mx-0.5 align-baseline"
        >
          {n}
        </sup>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function HeroChatDemo() {
  const [visible, setVisible] = useState<DemoMessage[]>([])
  const [typing, setTyping] = useState<string | null>(null)
  const [popover, setPopover] = useState<DemoCitation | null>(null)
  const phase = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const schedule = (fn: () => void, ms: number) => {
      timerRef.current = setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
    }

    const runPhase = (idx: number) => {
      if (idx >= SCRIPT.length) {
        // Restart after a pause
        schedule(() => {
          setVisible([])
          setTyping(null)
          phase.current = 0
          runPhase(0)
        }, 3000)
        return
      }

      const msg = SCRIPT[idx]
      schedule(() => {
        if (msg.role === 'user') {
          setVisible((prev) => [...prev, msg])
          schedule(() => runPhase(idx + 1), 500)
        } else {
          // Typewriter effect for assistant messages
          const full = msg.content
          let i = 0
          setTyping('')
          const tick = () => {
            i += 3
            if (i >= full.length) {
              setTyping(null)
              setVisible((prev) => [...prev, msg])
              schedule(() => runPhase(idx + 1), 1800)
            } else {
              setTyping(full.slice(0, i))
              timerRef.current = setTimeout(tick, 18)
            }
          }
          timerRef.current = setTimeout(tick, 18)
        }
      }, 600)
    }

    runPhase(phase.current)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lift border border-gray-100 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-gray-400 ml-1">employee-handbook.pdf</span>
        </div>

        {/* Messages */}
        <div className="px-4 py-4 flex flex-col gap-3 min-h-[260px]">
          {visible.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-primary-600 text-white rounded-2xl rounded-br-md px-3 py-2 text-sm max-w-[80%]">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-gray-50 rounded-2xl rounded-tl-md px-3 py-2 text-sm text-gray-800 leading-relaxed border border-gray-100">
                      {renderDemoText(msg.content, (id) => {
                        const c = msg.citations?.find((c) => c.id === id)
                        if (c) setPopover(popover?.id === id ? null : c)
                      })}
                    </div>
                  </div>
                  {msg.showSpeedup && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-8 text-xs text-emerald-600 font-medium">
                      <Zap className="h-3 w-3" />
                      2.7s → 5ms — served from cache ⚡
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {typing !== null && (
            <div className="flex items-start gap-2">
              <div className="shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <div className="bg-gray-50 rounded-2xl rounded-tl-md px-3 py-2 text-sm text-gray-800 border border-gray-100">
                {typing}
                <span className="inline-block w-1 h-3.5 bg-primary-400 animate-blink align-middle ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Citation popover */}
        {popover && (
          <div className="mx-4 mb-4 bg-primary-50 border border-primary-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-primary-700 mb-1">
              Source passage [{popover.id}]
            </p>
            <p className="text-xs text-gray-600 italic leading-relaxed">{popover.text}</p>
          </div>
        )}
      </div>

      {/* Decorative glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-primary-400/10 to-accent-400/10 rounded-3xl blur-xl -z-10" />
    </div>
  )
}
