import { useEffect, useState, useCallback } from 'react'
import { Plus, MessageSquare, Pencil, Trash2, Check, X, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  type ConversationInfo,
} from '../api'
import { useAuth } from '../hooks/useAuth'
import { cn } from './ui/cn'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: (conv: ConversationInfo) => void
}

export function ConversationSidebar({ activeId, onSelect, onNew }: Props) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationInfo[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    try {
      const list = await listConversations()
      setConversations(list)
    } catch {}
  }, [user])

  useEffect(() => { load() }, [load])

  const handleNew = async () => {
    if (!user) {
      // Guest: create a local-only "conversation" with a temp id
      const tempConv: ConversationInfo = {
        id: `guest-${Date.now()}`,
        title: 'New Conversation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      onNew(tempConv)
      return
    }
    try {
      const conv = await createConversation('New Conversation')
      setConversations((prev) => [conv, ...prev])
      onNew(conv)
    } catch {}
  }

  const startEdit = (conv: ConversationInfo) => {
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  const commitRename = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return }
    try {
      const updated = await renameConversation(id, editTitle.trim())
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)))
    } catch {}
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch {}
  }

  return (
    <div className="w-60 shrink-0 flex flex-col border-r border-gray-100 bg-white h-full">
      <div className="px-3 py-3 border-b border-gray-100">
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors',
              activeId === conv.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700',
            )}
            onClick={() => onSelect(conv.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {editingId === conv.id ? (
              <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(conv.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <button onClick={() => commitRename(conv.id)} className="text-primary-600 hover:text-primary-700">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => startEdit(conv)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(conv.id)} className="text-gray-400 hover:text-rose-500 p-0.5 rounded">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {user && conversations.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No conversations yet</p>
        )}
        {!user && (
          <p className="text-xs text-gray-400 text-center py-6">Start a new chat below</p>
        )}
      </div>

      {/* Guest sign-in prompt */}
      {!user && (
        <div className="px-3 py-3 border-t border-gray-100">
          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-primary-200 text-primary-600 text-xs font-medium hover:bg-primary-50 transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in to save history
          </Link>
        </div>
      )}
    </div>
  )
}
