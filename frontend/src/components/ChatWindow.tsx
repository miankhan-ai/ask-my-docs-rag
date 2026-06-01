import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useStream } from '../hooks/useStream'
import type { Citation } from '../api'
import { CitationDrawer } from './CitationDrawer'
import { DebugView } from './DebugView'

function renderWithCitations(text: string, onCitationClick: (n: number) => void): ReactNode[] {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const n = parseInt(match[1])
      return (
        <sup
          key={i}
          className="cursor-pointer text-blue-500 hover:text-blue-700 font-semibold mx-0.5 text-xs"
          onClick={() => onCitationClick(n)}
        >
          [{n}]
        </sup>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function ChatWindow() {
  const { tokens, citations, citationWarning, isStreaming, error, ask } = useStream()
  const [input, setInput] = useState('')
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tokens])

  const submit = async () => {
    const q = input.trim()
    if (!q || isStreaming) return
    setLastQuery(q)
    setInput('')
    setActiveCitation(null)
    await ask(q)
  }

  const handleCitationClick = (n: number) => {
    const citation = citations.find((c) => c.id === n)
    if (citation) setActiveCitation(citation)
  }

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {tokens && (
          <div className="bg-white rounded-lg shadow p-4 leading-relaxed text-gray-800">
            {renderWithCitations(tokens, handleCitationClick)}
            {isStreaming && <span className="animate-pulse text-gray-400"> ▋</span>}
          </div>
        )}
        {citationWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
            Warning: some citations could not be verified against retrieved passages.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {tokens && !isStreaming && lastQuery && <DebugView query={lastQuery} />}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-200 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask a question about your documents…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={isStreaming}
        />
        <button
          onClick={submit}
          disabled={isStreaming || !input.trim()}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? 'Thinking…' : 'Ask'}
        </button>
      </div>

      <CitationDrawer citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  )
}
