import { useRef } from 'react'
import type { DragEvent } from 'react'
import { useDocuments } from '../hooks/useDocuments'

export function UploadPanel() {
  const { documents, uploading, uploadError, upload } = useDocuments()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(upload)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="p-4 border-r border-gray-200 w-72 flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Documents</h2>
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-sm text-gray-500">Drop files here or click to upload</p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, MD, TXT</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploading && <p className="text-sm text-blue-500 animate-pulse">Uploading…</p>}
      {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}

      <ul className="flex flex-col gap-2 overflow-y-auto">
        {documents.map((doc) => (
          <li key={doc.id} className="bg-gray-50 rounded p-2 text-sm">
            <p className="font-medium truncate">{doc.filename}</p>
            <p className="text-xs text-gray-400">{doc.chunkCount} chunks</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
