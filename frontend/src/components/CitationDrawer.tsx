import { AnimatePresence, motion } from 'framer-motion'
import { X, Quote } from 'lucide-react'
import type { Citation } from '../api'

interface Props {
  citation: Citation | null
  onClose: () => void
}

export function CitationDrawer({ citation, onClose }: Props) {
  return (
    <AnimatePresence>
      {citation && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          {/* Drawer — bottom sheet on mobile, right panel on sm+ */}
          <motion.div
            key="drawer"
            // Mobile: slide up from bottom
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="
              fixed bottom-0 left-0 right-0 z-50
              sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-full sm:w-96
              bg-white shadow-2xl border-t sm:border-t-0 sm:border-l border-gray-100
              flex flex-col
              rounded-t-2xl sm:rounded-none
              max-h-[85vh] sm:max-h-full
            "
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 shrink-0">
              {/* Drag handle — mobile only */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-200 rounded-full sm:hidden" />
              <div className="flex items-center gap-2 mt-1 sm:mt-0">
                <Quote className="h-4 w-4 text-primary-500" />
                <h3 className="font-semibold text-gray-800">
                  Citation [{citation.id}]
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close citation drawer"
                className="text-gray-400 hover:text-gray-700 transition-colors rounded-lg p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto scrollbar-slim flex-1">
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Source:</span>{' '}
                {citation.source}
                {citation.page != null && (
                  <span className="text-gray-400"> · Page {citation.page}</span>
                )}
              </p>
              <blockquote className="border-l-4 border-primary-300 pl-4 text-sm text-gray-700 italic leading-relaxed">
                {citation.text}
              </blockquote>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
