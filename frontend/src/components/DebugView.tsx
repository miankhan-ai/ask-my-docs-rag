import { useState } from 'react'
import { getRetrievalDebug } from '../api'
import type { RetrievalDebugResult } from '../api'

interface Props {
  query: string
}

interface SectionProps {
  title: string
  rows: Array<Record<string, unknown>>
  scoreKey: string
  showText?: boolean
}

export function DebugView({ query }: Props) {
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
    <div className="mt-2">
      <button onClick={toggle} className="text-xs text-gray-400 hover:text-gray-600 underline">
        {open ? 'Hide' : 'Show'} retrieval debug
      </button>

      {loading && <p className="text-xs text-gray-400 mt-1">Loading…</p>}

      {open && data && (
        <div className="mt-3 text-xs font-mono overflow-x-auto">
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

function Section({ title, rows, scoreKey, showText }: SectionProps) {
  return (
    <div className="mb-3">
      <p className="font-semibold text-gray-600 mb-1">{title}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">chunk_id</th>
            <th className="border px-2 py-1 text-left">{scoreKey}</th>
            {showText && <th className="border px-2 py-1 text-left">text</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const score = r[scoreKey]
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border px-2 py-1">{String(r.chunk_id)}</td>
                <td className="border px-2 py-1">
                  {typeof score === 'number' ? score.toFixed(4) : String(score)}
                </td>
                {showText && (
                  <td className="border px-2 py-1 max-w-xs truncate">{String(r.text ?? '')}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
