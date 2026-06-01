import type { Citation } from '../api'

interface Props {
  citation: Citation | null
  onClose: () => void
}

export function CitationDrawer({ citation, onClose }: Props) {
  if (!citation) return null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Citation [{citation.id}]</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
          &times;
        </button>
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Source:</span> {citation.source}
          {citation.page != null && ` · Page ${citation.page}`}
        </p>
        <blockquote className="border-l-4 border-blue-300 pl-4 text-sm text-gray-700 italic leading-relaxed">
          {citation.text}
        </blockquote>
      </div>
    </div>
  )
}
