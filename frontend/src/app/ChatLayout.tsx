import { useState } from 'react'
import { X, PanelLeft, Upload } from 'lucide-react'
import { UploadPanel } from '../components/UploadPanel'
import { ChatWindow } from '../components/ChatWindow'
import { ConversationSidebar } from '../components/ConversationSidebar'
import type { ConversationInfo } from '../api'

export function ChatLayout() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const handleNew = (conv: ConversationInfo) => {
    if (conv.id) {
      setActiveConversationId(conv.id)
      setSidebarOpen(false)
    }
  }

  const handleSelect = (id: string) => {
    setActiveConversationId(id)
    setSidebarOpen(false)
  }

  return (
    <div className="flex flex-1 h-full min-h-0 relative">
      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile upload overlay ── */}
      {uploadOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setUploadOpen(false)}
        />
      )}

      {/* ── Conversation sidebar ── */}
      <div
        className={[
          // Desktop: always visible static column
          'md:relative md:flex md:w-60 md:shrink-0 md:translate-x-0',
          // Mobile: fixed drawer sliding in from left
          'fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Close button visible only on mobile inside sidebar */}
        <div className="md:hidden absolute top-3 right-3 z-10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ConversationSidebar
          activeId={activeConversationId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>

      {/* ── Main area: upload panel + chat ── */}
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Upload panel: hidden on mobile, visible from lg */}
        <div className="hidden lg:flex lg:w-72 lg:shrink-0">
          <UploadPanel />
        </div>

        {/* Mobile upload drawer */}
        <div
          className={[
            'lg:hidden fixed inset-y-0 right-0 z-30 w-72 transition-transform duration-200',
            uploadOpen ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
        >
          <div className="h-full bg-white border-l border-gray-100 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Documents</span>
              <button
                onClick={() => setUploadOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <UploadPanel hideHeading />
            </div>
          </div>
        </div>

        {/* Chat + mobile toolbar */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {/* Mobile toolbar row */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 text-xs font-medium"
            >
              <PanelLeft className="h-4 w-4" />
              <span className="hidden xs:inline">Chats</span>
            </button>
            <div className="flex-1 text-xs text-center text-gray-400 truncate">
              {activeConversationId ? '' : 'Select or start a chat'}
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 text-xs font-medium"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden xs:inline">Docs</span>
            </button>
          </div>

          <ChatWindow conversationId={activeConversationId} />
        </div>
      </div>
    </div>
  )
}
