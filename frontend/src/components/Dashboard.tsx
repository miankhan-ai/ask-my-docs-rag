import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity } from 'lucide-react'
import { useStats } from '../hooks/useStats'

// Centralised chart colours matching the new indigo/violet palette.
const CHART = {
  primary: '#6366f1',   // indigo-500
  accent: '#8b5cf6',    // violet-500
  amber: '#f59e0b',
  emerald: '#10b981',
  cyan: '#0ea5e9',
  rose: '#f43f5e',
  embedArea: '#a5b4fc', // primary-300
  answerArea: '#c4b5fd', // accent-300
  grid: '#e5e7eb',
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        {title}
      </h3>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-gray-900 tabular-nums">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export function Dashboard() {
  const { latest, history, error } = useStats(1500)

  const stageData = latest
    ? STAGE_ORDER.filter((s) => s in latest.latency_ms.by_stage).map((s) => ({
        stage: s,
        ms: latest.latency_ms.by_stage[s],
      }))
    : []

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 scrollbar-slim">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary-500" />
          Live System Dashboard
        </h2>
        <span className="text-xs text-gray-400">
          {latest
            ? `uptime ${latest.uptime_s}s · refreshing every 1.5s`
            : 'connecting…'}
        </span>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-600 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency — per stage */}
        <Panel title="Latency — per stage (current)">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stageData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis type="number" tick={{ fontSize: 11 }} unit="ms" />
              <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v} ms`} />
              <Bar dataKey="ms" fill={CHART.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Latency over time */}
        <Panel title="Latency — p50/p95 & LLM (over time)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit="s" />
              <YAxis tick={{ fontSize: 11 }} unit="ms" />
              <Tooltip />
              <Line type="monotone" dataKey="p50" stroke={CHART.primary} dot={false} name="p50" />
              <Line type="monotone" dataKey="p95" stroke={CHART.amber} dot={false} name="p95" />
              <Line type="monotone" dataKey="llmTtft" stroke={CHART.emerald} dot={false} name="LLM TTFT" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Tokens & cost */}
        <Panel title="Tokens & cost">
          <div className="flex gap-6 mb-3">
            <Stat
              label="Prompt tokens"
              value={(latest?.tokens.prompt_total ?? 0).toLocaleString()}
            />
            <Stat
              label="Completion tokens"
              value={(latest?.tokens.completion_total ?? 0).toLocaleString()}
            />
            <Stat
              label="Est. cost"
              value={`$${(latest?.cost_usd_total ?? 0).toFixed(5)}`}
            />
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit="s" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="tokenRate" stroke={CHART.accent} dot={false} name="tokens/s" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Cache hit ratio */}
        <Panel title="Cache hit ratio (%)">
          <div className="flex gap-6 mb-3">
            <Stat
              label="Embedding cache"
              value={`${((latest?.cache.embedding?.hit_ratio ?? 0) * 100).toFixed(0)}%`}
              sub={`${latest?.cache.embedding?.hits ?? 0} hits / ${latest?.cache.embedding?.misses ?? 0} miss`}
            />
            <Stat
              label="Answer cache"
              value={`${((latest?.cache.answer?.hit_ratio ?? 0) * 100).toFixed(0)}%`}
              sub={`${latest?.cache.answer?.hits ?? 0} hits / ${latest?.cache.answer?.misses ?? 0} miss`}
            />
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit="s" />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="embedHitRatio" stroke={CHART.emerald} fill={CHART.embedArea} name="embedding" />
              <Area type="monotone" dataKey="answerHitRatio" stroke={CHART.primary} fill={CHART.answerArea} name="answer" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Throughput & errors */}
        <Panel title="Throughput & errors">
          <div className="flex gap-6 mb-3">
            <Stat label="Requests" value={(latest?.requests.total ?? 0).toLocaleString()} />
            <Stat label="In-flight" value={String(latest?.requests.in_flight ?? 0)} />
            <Stat label="Errors" value={String(latest?.requests.errors ?? 0)} />
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} unit="s" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="reqRate" stroke={CHART.cyan} dot={false} name="req/s (1m)" />
              <Line type="monotone" dataKey="inFlight" stroke={CHART.rose} dot={false} name="in-flight" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  )
}
