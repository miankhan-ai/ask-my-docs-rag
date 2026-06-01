import { useState, useCallback, useRef } from 'react'
import { streamQuery } from '../api'
import type { Citation } from '../api'

export interface StreamState {
  tokens: string
  citations: Citation[]
  citationWarning: boolean
  isStreaming: boolean
  error: string | null
}

export function useStream() {
  const [state, setState] = useState<StreamState>({
    tokens: '',
    citations: [],
    citationWarning: false,
    isStreaming: false,
    error: null,
  })
  const abortRef = useRef(false)

  const ask = useCallback(async (question: string) => {
    abortRef.current = false
    setState({ tokens: '', citations: [], citationWarning: false, isStreaming: true, error: null })

    try {
      for await (const event of streamQuery(question)) {
        if (abortRef.current) break
        if (event.type === 'token') {
          setState((prev) => ({ ...prev, tokens: prev.tokens + event.content }))
        } else if (event.type === 'done') {
          setState((prev) => ({
            ...prev,
            citations: event.citations,
            citationWarning: event.citation_warning,
            isStreaming: false,
          }))
        }
      }
    } catch (err) {
      setState((prev) => ({ ...prev, isStreaming: false, error: String(err) }))
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setState({ tokens: '', citations: [], citationWarning: false, isStreaming: false, error: null })
  }, [])

  return { ...state, ask, reset }
}
