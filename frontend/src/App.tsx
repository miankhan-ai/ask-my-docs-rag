import { UploadPanel } from './components/UploadPanel'
import { ChatWindow } from './components/ChatWindow'

export default function App() {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      <UploadPanel />
      <ChatWindow />
    </div>
  )
}
