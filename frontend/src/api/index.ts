export interface UploadResult {
  document_id: number
  chunk_count: number
}

export interface Citation {
  id: number
  text: string
  source: string
  page: number | null
}

export interface TokenEvent {
  type: 'token'
  content: string
}

export interface DoneEvent {
  type: 'done'
  citations: Citation[]
  citation_warning: boolean
  timings?: Record<string, number>
  prompt_tokens?: number
  completion_tokens?: number
  cost_usd?: number
  cached?: boolean
}

export type StreamEvent = TokenEvent | DoneEvent

export interface RetrievalDebugResult {
  bm25_candidates: Array<{ chunk_id: number; score: number }>
  dense_candidates: Array<{ chunk_id: number; score: number }>
  rrf_fused: Array<{ chunk_id: number; rrf_score: number }>
  reranked: Array<{
    chunk_id: number
    cross_encoder_score: number
    text: string
    source: string
    page_number: number | null
  }>
}

export interface DocumentInfo {
  document_id: number
  filename: string
  status: string
  chunk_count: number
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch('/documents')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteDocument(documentId: number): Promise<void> {
  const res = await fetch(`/documents/${documentId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function* streamQuery(question: string): AsyncGenerator<StreamEvent> {
  const res = await fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as StreamEvent
      }
    }
  }
}

export async function getRetrievalDebug(query: string): Promise<RetrievalDebugResult> {
  const res = await fetch(`/retrieval-debug?query=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface Stats {
  uptime_s: number
  requests: {
    total: number
    by_status: Record<string, number>
    rate_1m: number
    in_flight: number
    errors: number
  }
  latency_ms: {
    p50: number
    p95: number
    by_stage: Record<string, number>
  }
  tokens: { prompt_total: number; completion_total: number }
  cost_usd_total: number
  cache: Record<string, { hits: number; misses: number; hit_ratio: number }>
}

export async function getStats(): Promise<Stats> {
  const res = await fetch('/stats')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
