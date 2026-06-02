import { UploadPanel } from '../components/UploadPanel'
import { ChatWindow } from '../components/ChatWindow'

export function ChatLayout() {
  return (
    <div className="flex flex-1 h-full min-h-0">
      <UploadPanel />
      <ChatWindow />
    </div>
  )
}
