import { useState } from 'react'
import { UploadPanel } from '../components/UploadPanel'
import { ChatWindow } from '../components/ChatWindow'
import { ConversationSidebar } from '../components/ConversationSidebar'
import type { ConversationInfo } from '../api'

export function ChatLayout() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  const handleNew = (conv: ConversationInfo) => {
    if (conv.id) setActiveConversationId(conv.id)
  }

  return (
    <div className="flex flex-1 h-full min-h-0">
      <ConversationSidebar
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onNew={handleNew}
      />
      <div className="flex flex-1 min-h-0">
        <UploadPanel />
        <ChatWindow conversationId={activeConversationId} />
      </div>
    </div>
  )
}
