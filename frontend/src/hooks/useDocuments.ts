import { useState, useCallback, useEffect } from 'react'
import { uploadDocument, listDocuments, deleteDocument } from '../api'
import type { UploadResult } from '../api'

export interface UploadedDocument {
  id: number
  filename: string
  chunkCount: number
}

export function useDocuments() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Load already-ingested documents on mount so the list survives reloads.
  useEffect(() => {
    listDocuments()
      .then((docs) =>
        setDocuments(
          docs.map((d) => ({
            id: d.document_id,
            filename: d.filename,
            chunkCount: d.chunk_count,
          }))
        )
      )
      .catch(() => {
        /* backend may not be up yet; ignore */
      })
  }, [])

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const result: UploadResult = await uploadDocument(file)
      setDocuments((prev) => [
        ...prev,
        {
          id: result.document_id,
          filename: file.name,
          chunkCount: result.chunk_count,
        },
      ])
    } catch (err) {
      setUploadError(String(err))
    } finally {
      setUploading(false)
    }
  }, [])

  const remove = useCallback(async (id: number) => {
    setDeletingId(id)
    setUploadError(null)
    try {
      await deleteDocument(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setUploadError(String(err))
    } finally {
      setDeletingId(null)
    }
  }, [])

  return { documents, uploading, uploadError, deletingId, upload, remove }
}
