import { useState, useCallback, useRef, useEffect } from 'react'
import {
  streamQuery,
  postMessage,
  getConversation,
  renameConversation,
  type Citation,
} from '../api'

export interface UserMessage {
  role: 'user'
  id: string
  content: string
}

export interface AssistantMessage {
  role: 'assistant'
  id: string
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

let _tempId = 0
const tempId = () => `temp-${_tempId++}`

const isGuestId = (id: string | null) => id?.startsWith('guest-') ?? false

export function useStream(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const abortRef = useRef(false)
  const isFirstMessage = useRef(true)

  useEffect(() => {
    if (!conversationId) { setMessages([]); return }
    // Guest sessions have no server-side history
    if (isGuestId(conversationId)) { setMessages([]); isFirstMessage.current = true; return }
    isFirstMessage.current = false
    getConversation(conversationId).then((conv) => {
      isFirstMessage.current = conv.messages.length === 0
      setMessages(
        conv.messages.map((m): ChatMessage => {
          if (m.role === 'user') {
            return { role: 'user', id: m.id, content: m.content }
          }
          return {
            role: 'assistant',
            id: m.id,
            query: '',
            tokens: m.content,
            citations: m.citations ?? [],
            citationWarning: false,
            isStreaming: false,
            error: null,
          }
        }),
      )
    }).catch(() => setMessages([]))
  }, [conversationId])

  /** Update the assistant message with the given id in place. */
  const patchAssistant = useCallback(
    (id: string, patch: Partial<AssistantMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.role === 'assistant' && m.id === id ? { ...m, ...patch } : m)),
      )
    },
    [],
  )

  const ask = useCallback(
    async (question: string) => {
      if (!conversationId) return
      abortRef.current = false

      const isGuest = isGuestId(conversationId)
      const userMsgId = isGuest ? tempId() : (await postMessage(conversationId, 'user', question, null)).id

      if (isFirstMessage.current) {
        isFirstMessage.current = false
        if (!isGuest) renameConversation(conversationId, question.slice(0, 60)).catch(() => {})
      }

      const userMsg: UserMessage = { role: 'user', id: userMsgId, content: question }
      const assistantTempId = tempId()
      const assistantMsg: AssistantMessage = {
        role: 'assistant', id: assistantTempId, query: question,
        tokens: '', citations: [], citationWarning: false, isStreaming: true, error: null,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])

      let finalTokens = ''
      let finalCitations: Citation[] = []

      try {
        for await (const event of streamQuery(question, conversationId)) {
          if (abortRef.current) break
          if (event.type === 'token') {
            finalTokens += event.content
            setMessages((prev) =>
              prev.map((m) =>
                m.role === 'assistant' && m.id === assistantTempId
                  ? { ...m, tokens: m.tokens + event.content }
                  : m,
              ),
            )
          } else if (event.type === 'done') {
            finalCitations = event.citations
            patchAssistant(assistantTempId, {
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
        if (!isGuest) {
          const savedAssistant = await postMessage(
            conversationId, 'assistant', finalTokens,
            finalCitations.length ? finalCitations : null
          )
          setMessages((prev) =>
            prev.map((m) => (m.role === 'assistant' && m.id === assistantTempId ? { ...m, id: savedAssistant.id } : m)),
          )
        }
      } catch (err) {
        patchAssistant(assistantTempId, { isStreaming: false, error: String(err) })
      }
    },
    [conversationId, patchAssistant],
  )

  /** Whether any assistant message is currently streaming. */
  const isStreaming = messages.some((m) => m.role === 'assistant' && (m as AssistantMessage).isStreaming)

  const reset = useCallback(() => {
    abortRef.current = true
    setMessages([])
  }, [])

  return { messages, isStreaming, ask, reset }
}
