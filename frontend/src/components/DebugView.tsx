import { useState } from 'react'
import { ChevronRight, Zap } from 'lucide-react'
import { getRetrievalDebug } from '../api'
import type { RetrievalDebugResult } from '../api'
import { cn } from './ui/cn'

interface Props {
  query: string
  timings?: Record<string, number>
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
  cached?: boolean
}

const STAGE_ORDER = [
  'embed_query',
  'bm25_search',
  'dense_search',
  'rrf_fuse',
  'rerank',
  'llm_ttft',
  'llm_total',
]

interface SectionProps {
  title: string
  rows: Array<Record<string, unknown>>
  scoreKey: string
  showText?: boolean
}

function LatencyBreakdown({
  timings,
  promptTokens,
  completionTokens,
  costUsd,
  cached,
}: {
  timings?: Record<string, number>
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
  cached?: boolean
}) {
  if (!timings || Object.keys(timings).length === 0) {
    if (cached) {
      return (
        <p className="text-xs text-emerald-600 mb-3 flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Served from semantic cache — no pipeline run.
        </p>
      )
    }
    return null
  }
  const entries = STAGE_ORDER.filter((s) => s in timings).map((s) => [s, timings[s]] as const)
  const max = Math.max(...entries.map(([, ms]) => ms), 1)
  return (
    <div className="mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-600 mb-2">
        Latency breakdown{cached ? ' — ⚡ cached' : ''}
      </p>
      <div className="flex flex-col gap-1.5">
        {entries.map(([stage, ms]) => (
          <div key={stage} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-gray-500">{stage}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 relative overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary-400 to-accent-400 h-2 rounded-full"
                style={{ width: `${(ms / max) * 100}%` }}
              />
            </div>
            <span className="w-14 text-right tabular-nums text-xs text-gray-600">
              {ms.toFixed(1)}ms
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {promptTokens ?? 0} in / {completionTokens ?? 0} out · est.{' '}
        <span className="text-gray-600">${(costUsd ?? 0).toFixed(6)}</span>
      </p>
    </div>
  )
}

function Section({ title, rows, scoreKey, showText }: SectionProps) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-gray-600 mb-1">{title}</p>
      <div className="overflow-hidden rounded-lg border border-gray-200 overflow-x-auto scrollbar-slim">
        <table className="w-full border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1.5 text-left text-gray-500 font-medium border-b border-gray-200">chunk_id</th>
              <th className="px-2 py-1.5 text-left text-gray-500 font-medium border-b border-gray-200">{scoreKey}</th>
              {showText && (
                <th className="px-2 py-1.5 text-left text-gray-500 font-medium border-b border-gray-200">text</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const score = r[scoreKey]
              return (
                <tr key={i} className="hover:bg-primary-50/40 transition-colors">
                  <td className="px-2 py-1 border-b border-gray-100 text-gray-700">{String(r.chunk_id)}</td>
                  <td className="px-2 py-1 border-b border-gray-100 text-gray-700">
                    {typeof score === 'number' ? score.toFixed(4) : String(score)}
                  </td>
                  {showText && (
                    <td className="px-2 py-1 border-b border-gray-100 max-w-xs truncate text-gray-600">
                      {String(r.text ?? '')}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DebugView({ query, timings, promptTokens, completionTokens, costUsd, cached }: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<RetrievalDebugResult | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!open && !data) {
      setLoading(true)
      try {
        const result = await getRetrievalDebug(query)
        setData(result)
      } finally {
        setLoading(false)
      }
    }
    setOpen((prev) => !prev)
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform duration-200', open ? 'rotate-90' : '')}
        />
        {open ? 'Hide' : 'Show'} retrieval debug
      </button>

      {loading && <p className="text-xs text-gray-400 mt-1">Loading…</p>}

      {open && (
        <div className="mt-2 text-xs">
          <LatencyBreakdown
            timings={timings}
            promptTokens={promptTokens}
            completionTokens={completionTokens}
            costUsd={costUsd}
            cached={cached}
          />
        </div>
      )}

      {open && data && (
        <div className="mt-1 text-xs">
          <Section title="BM25 Candidates" rows={data.bm25_candidates} scoreKey="score" />
          <Section title="Dense Candidates" rows={data.dense_candidates} scoreKey="score" />
          <Section title="RRF Fused" rows={data.rrf_fused} scoreKey="rrf_score" />
          <Section
            title={`Reranked (top ${data.reranked.length})`}
            rows={data.reranked}
            scoreKey="cross_encoder_score"
            showText
          />
        </div>
      )}
    </div>
  )
}
