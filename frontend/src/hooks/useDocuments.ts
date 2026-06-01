import { useState, useCallback } from 'react'
import { uploadDocument } from '../api'
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

  return { documents, uploading, uploadError, upload }
}
