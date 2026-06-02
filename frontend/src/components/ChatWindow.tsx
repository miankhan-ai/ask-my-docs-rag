import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Send, Sparkles, AlertTriangle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStream } from '../hooks/useStream'
import type { AssistantMessage } from '../hooks/useStream'
import type { Citation } from '../api'
import { CitationDrawer } from './CitationDrawer'
import { DebugView } from './DebugView'

const EXAMPLE_QUESTIONS = [
  'Summarize the key points of this document.',
  'What are the main requirements outlined here?',
  'What conclusions does this document reach?',
]

function renderWithCitations(text: string, onCitationClick: (n: number) => void): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const n = parseInt(match[1])
      return (
        <sup
          key={i}
          className="cursor-pointer inline-flex items-center justify-center
            w-4 h-4 rounded bg-primary-50 text-primary-600 hover:bg-primary-100
            text-[10px] font-semibold mx-0.5 align-baseline"
          onClick={() => onCitationClick(n)}
        >
          {n}
        </sup>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function AssistantTurn({
  message,
  onCitationClick,
}: {
  message: AssistantMessage
  onCitationClick: (citation: Citation) => void
}) {
  const handleClick = (n: number) => {
    const citation = message.citations.find((c) => c.id === n)
    if (citation) onCitationClick(citation)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5 self-start max-w-[85%]">
        {/* Assistant avatar */}
        <div className="shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="bg-white rounded-2xl rounded-tl-md shadow-card border border-gray-100 px-4 py-3 leading-relaxed text-gray-800 text-sm">
          {message.tokens ? (
            renderWithCitations(message.tokens, handleClick)
          ) : (
            message.isStreaming && (
              <span className="text-gray-400 text-sm">Thinking…</span>
            )
          )}
          {message.isStreaming && message.tokens && (
            <span className="inline-block w-1.5 h-3.5 bg-primary-400 animate-blink align-middle ml-0.5" />
          )}
        </div>
      </div>

      {message.citationWarning && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 ml-9">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Some citations could not be verified against retrieved passages.
        </div>
      )}
      {message.error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-600 ml-9">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message.error}
        </div>
      )}
      {message.tokens && !message.isStreaming && (
        <div className="ml-9">
          <DebugView
            query={message.query}
            timings={message.timings}
            promptTokens={message.promptTokens}
            completionTokens={message.completionTokens}
            costUsd={message.costUsd}
            cached={message.cached}
          />
        </div>
      )}
    </div>
  )
}

export function ChatWindow() {
  const { messages, isStreaming, ask } = useStream()
  const [input, setInput] = useState('')
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = async () => {
    const q = input.trim()
    if (!q || isStreaming) return
    setInput('')
    await ask(q)
  }

  return (
    <div className="flex-1 flex flex-col h-full relative min-w-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 scrollbar-slim">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center mt-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Ask anything</p>
              <p className="text-sm text-gray-400 mt-1">
                Every answer cites the exact source passage.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500
                    hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) =>
            message.role === 'user' ? (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-2.5
                  self-end max-w-[85%] text-sm leading-relaxed shadow-soft"
              >
                {message.content}
              </motion.div>
            ) : (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <AssistantTurn
                  message={message}
                  onCitationClick={setActiveCitation}
                />
              </motion.div>
            ),
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white/80 backdrop-blur flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask a question about your documents…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400
            disabled:opacity-60"
          disabled={isStreaming}
        />
        <button
          onClick={submit}
          disabled={isStreaming || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white
            rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40
            disabled:cursor-not-allowed transition-colors shadow-soft shrink-0"
        >
          {isStreaming ? (
            <>
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Thinking…
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Ask
            </>
          )}
        </button>
      </div>

      <CitationDrawer citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  )
}
