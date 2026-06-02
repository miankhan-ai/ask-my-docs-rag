import { useState, useCallback, useRef } from 'react'
import { streamQuery } from '../api'
import type { Citation } from '../api'

export interface UserMessage {
  role: 'user'
  id: number
  content: string
}

export interface AssistantMessage {
  role: 'assistant'
  id: number
  /** The question that produced this answer (used for the retrieval-debug view). */
  query: string
  tokens: string
  citations: Citation[]
  citationWarning: boolean
  isStreaming: boolean
  error: string | null
  /** Per-stage latency (ms) reported by the backend in the done event. */
  timings?: Record<string, number>
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
  cached?: boolean
}

export type ChatMessage = UserMessage | AssistantMessage

let nextId = 0

export function useStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const abortRef = useRef(false)

  /** Update the assistant message with the given id in place. */
  const patchAssistant = useCallback(
    (id: number, patch: Partial<AssistantMessage>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.role === 'assistant' && m.id === id ? { ...m, ...patch } : m
        )
      )
    },
    []
  )

  const ask = useCallback(
    async (question: string) => {
      abortRef.current = false

      const userMsg: UserMessage = {
        role: 'user',
        id: nextId++,
        content: question,
      }
      const assistantId = nextId++
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        id: assistantId,
        query: question,
        tokens: '',
        citations: [],
        citationWarning: false,
        isStreaming: true,
        error: null,
      }
      // Append both turns; previous messages are preserved.
      setMessages((prev) => [...prev, userMsg, assistantMsg])

      try {
        for await (const event of streamQuery(question)) {
          if (abortRef.current) break
          if (event.type === 'token') {
            setMessages((prev) =>
              prev.map((m) =>
                m.role === 'assistant' && m.id === assistantId
                  ? { ...m, tokens: m.tokens + event.content }
                  : m
              )
            )
          } else if (event.type === 'done') {
            patchAssistant(assistantId, {
              citations: event.citations,
              citationWarning: event.citation_warning,
              isStreaming: false,
              timings: event.timings,
              promptTokens: event.prompt_tokens,
              completionTokens: event.completion_tokens,
              costUsd: event.cost_usd,
              cached: event.cached,
            })
          }
        }
      } catch (err) {
        patchAssistant(assistantId, { isStreaming: false, error: String(err) })
      }
    },
    [patchAssistant]
  )

  /** Whether any assistant message is currently streaming. */
  const isStreaming = messages.some(
    (m) => m.role === 'assistant' && m.isStreaming
  )

  const reset = useCallback(() => {
    abortRef.current = true
    setMessages([])
  }, [])

  return { messages, isStreaming, ask, reset }
}
