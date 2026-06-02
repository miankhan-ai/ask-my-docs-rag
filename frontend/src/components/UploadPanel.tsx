import { useRef } from 'react'
import type { DragEvent } from 'react'
import { Upload, File, Trash2, Loader2, FolderOpen } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDocuments } from '../hooks/useDocuments'

export function UploadPanel() {
  const { documents, uploading, uploadError, deletingId, upload, remove } = useDocuments()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(upload)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="w-72 shrink-0 p-4 border-r border-gray-100 bg-white flex flex-col gap-4">
      {/* Heading */}
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-primary-500" />
        <h2 className="font-semibold text-sm text-gray-800">Documents</h2>
      </div>

      {/* The file input is a SIBLING of the dropzone (not a child) to prevent
          inputRef.click() from bubbling back into the div's onClick. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.md,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center cursor-pointer
          hover:border-primary-400 hover:bg-primary-50/40 transition-colors"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-5 w-5 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 font-medium">Drop files or click to upload</p>
        <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, MD, TXT</p>
      </div>

      {uploading && (
        <p className="text-sm text-primary-600 flex items-center gap-1.5 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading…
        </p>
      )}
      {uploadError && (
        <p className="text-sm text-rose-600">{uploadError}</p>
      )}

      {/* Document list */}
      <ul className="flex flex-col gap-1.5 overflow-y-auto scrollbar-slim flex-1">
        {documents.length === 0 && !uploading && (
          <li className="text-xs text-gray-400 text-center py-4">
            No documents yet.
            <br />
            Upload one to get started.
          </li>
        )}
        <AnimatePresence initial={false}>
          {documents.map((doc) => (
            <motion.li
              key={doc.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-gray-50 hover:bg-gray-100 rounded-xl p-2.5 text-sm
                flex items-start justify-between gap-2 group transition-colors"
            >
              <div className="flex items-start gap-2 min-w-0">
                <File className="h-3.5 w-3.5 text-primary-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate text-gray-800 text-xs" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-400">{doc.chunkCount} chunks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(doc.id)
                }}
                disabled={deletingId === doc.id}
                aria-label={`Delete ${doc.filename}`}
                className="shrink-0 text-gray-400 hover:text-rose-500 disabled:opacity-40
                  transition-colors p-0.5 rounded"
              >
                {deletingId === doc.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
