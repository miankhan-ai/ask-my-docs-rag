import { useEffect, useRef, useState } from 'react'
import { getStats } from '../api'
import type { Stats } from '../api'

export interface StatsSample {
  t: number // seconds since dashboard mount
  p50: number
  p95: number
  llmTtft: number
  llmTotal: number
  tokenRate: number // completion tokens/sec since last sample
  cost: number // cumulative USD
  reqRate: number // requests/sec (1m)
  inFlight: number
  errors: number
  embedHitRatio: number
  answerHitRatio: number
}

interface UseStatsResult {
  latest: Stats | null
  history: StatsSample[]
  error: string | null
}

const MAX_HISTORY = 60

/**
 * Polls GET /stats on an interval and keeps a rolling history for trend charts.
 * Pauses while the tab is hidden to avoid useless network churn.
 */
export function useStats(intervalMs = 1500): UseStatsResult {
  const [latest, setLatest] = useState<Stats | null>(null)
  const [history, setHistory] = useState<StatsSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const mountedAt = useRef(Date.now())
  const prev = useRef<{ completion: number; t: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const s = await getStats()
        if (cancelled) return
        setLatest(s)
        setError(null)

        const nowS = (Date.now() - mountedAt.current) / 1000
        let tokenRate = 0
        if (prev.current) {
          const dt = nowS - prev.current.t
          if (dt > 0) {
            tokenRate = Math.max(
              0,
              (s.tokens.completion_total - prev.current.completion) / dt
            )
          }
        }
        prev.current = { completion: s.tokens.completion_total, t: nowS }

        const embed = s.cache.embedding ?? { hit_ratio: 0 }
        const answer = s.cache.answer ?? { hit_ratio: 0 }

        const sample: StatsSample = {
          t: Math.round(nowS),
          p50: s.latency_ms.p50,
          p95: s.latency_ms.p95,
          llmTtft: s.latency_ms.by_stage.llm_ttft ?? 0,
          llmTotal: s.latency_ms.by_stage.llm_total ?? 0,
          tokenRate: Math.round(tokenRate),
          cost: s.cost_usd_total,
          reqRate: s.requests.rate_1m,
          inFlight: s.requests.in_flight,
          errors: s.requests.errors,
          embedHitRatio: embed.hit_ratio * 100,
          answerHitRatio: answer.hit_ratio * 100,
        }
        setHistory((h) => [...h, sample].slice(-MAX_HISTORY))
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return { latest, history, error }
}
