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
          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-100 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-primary-500" />
                <h3 className="font-semibold text-gray-800">
                  Citation [{citation.id}]
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close citation drawer"
                className="text-gray-400 hover:text-gray-700 transition-colors rounded-lg p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 overflow-y-auto scrollbar-slim flex-1">
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
