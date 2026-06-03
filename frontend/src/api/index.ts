const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export const apiUrl = (path: string): string => `${API_BASE}${path}`

// --- In-memory token store (never persists to localStorage) ---
let _accessToken: string | null = null

export function setAccessToken(token: string | null) {
  _accessToken = token
}

export function getAccessToken(): string | null {
  return _accessToken
}

// --- Auth headers + 401 interceptor ---
let _isRefreshing = false
let _refreshPromise: Promise<string | null> | null = null

async function silentRefresh(): Promise<string | null> {
  if (_isRefreshing) return _refreshPromise!
  _isRefreshing = true
  _refreshPromise = (async () => {
    try {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) { setAccessToken(null); return null }
      const data: TokenResponse = await res.json()
      setAccessToken(data.access_token)
      return data.access_token
    } finally {
      _isRefreshing = false
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers, credentials: 'include' })
  if (res.status === 401) {
    const newToken = await silentRefresh()
    if (!newToken) return res
    headers.set('Authorization', `Bearer ${newToken}`)
    return fetch(input, { ...init, headers, credentials: 'include' })
  }
  return res
}

// --- Auth endpoints ---
export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserInfo {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  auth_provider: string
  is_admin: boolean
}

export async function apiRegister(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiLogout(): Promise<void> {
  await fetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'include' })
  setAccessToken(null)
}

export async function apiMe(): Promise<UserInfo> {
  const res = await authFetch(apiUrl('/auth/me'))
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}

export async function apiSilentRefresh(): Promise<string | null> {
  return silentRefresh()
}

// --- Conversation endpoints ---
export interface ConversationInfo {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface MessageInfo {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[] | null
  created_at: string
}

export interface ConversationWithMessages extends ConversationInfo {
  messages: MessageInfo[]
}

export async function listConversations(): Promise<ConversationInfo[]> {
  const res = await authFetch(apiUrl('/conversations'))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createConversation(title = 'New Conversation'): Promise<ConversationInfo> {
  const res = await authFetch(apiUrl('/conversations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const res = await authFetch(apiUrl(`/conversations/${id}`))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function renameConversation(id: string, title: string): Promise<ConversationInfo> {
  const res = await authFetch(apiUrl(`/conversations/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await authFetch(apiUrl(`/conversations/${id}`), { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function postMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  citations: Citation[] | null,
): Promise<MessageInfo> {
  const res = await authFetch(apiUrl(`/conversations/${conversationId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content, citations }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// --- Document endpoints ---
export interface UploadResult { document_id: number; chunk_count: number }
export interface Citation { id: number; text: string; source: string; page: number | null }
export interface TokenEvent { type: 'token'; content: string }
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

export interface DocumentInfo { document_id: number; filename: string; status: string; chunk_count: number }

export async function uploadDocument(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await authFetch(apiUrl('/upload'), { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await authFetch(apiUrl('/documents'))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteDocument(documentId: number): Promise<void> {
  const res = await authFetch(apiUrl(`/documents/${documentId}`), { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function* streamQuery(question: string, conversationId?: string): AsyncGenerator<StreamEvent> {
  const res = await authFetch(apiUrl('/query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversation_id: conversationId }),
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
  const res = await authFetch(apiUrl(`/retrieval-debug?query=${encodeURIComponent(query)}`))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface Stats {
  uptime_s: number
  requests: { total: number; by_status: Record<string, number>; rate_1m: number; in_flight: number; errors: number }
  latency_ms: { p50: number; p95: number; by_stage: Record<string, number> }
  tokens: { prompt_total: number; completion_total: number }
  cost_usd_total: number
  cache: Record<string, { hits: number; misses: number; hit_ratio: number }>
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(apiUrl('/stats'))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
