import { motion, AnimatePresence } from 'motion/react'
import { PanelRightOpen, FileText } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '@/state/store'
import { PreviewCanvas } from './PreviewCanvas'

/**
 * Preview controls that stay reachable wherever the user is:
 *
 * - Desktop (lg+): when the preview panel is *collapsed*, a single prominent
 *   "Show Preview" pill is the way back. When the panel is open there is no
 *   floating control — the in-pane hide button already covers it, and a
 *   floating pill would only hover over form fields. This keeps the working
 *   area clear (previously the pill overlapped the Services section).
 * - Small screens (<lg): the side panel doesn't exist, so a pill opens the
 *   preview in a full-height drawer instead.
 *
 * z-index sits below the toasts (z-50) and above content.
 */
export function FloatingPreviewToggle() {
  const { layout, setLayout } = useStore()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const collapsed = layout.previewCollapsed

  return (
    <>
      {/* Desktop: only shown while the preview is hidden — the only way back. */}
      <AnimatePresence>
        {collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-40 hidden lg:block"
          >
            <button
              type="button"
              onClick={() => setLayout({ previewCollapsed: false })}
              className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background shadow-pop ring-1 ring-black/5 transition-transform hover:scale-[1.02] active:scale-95"
              title="Show preview"
            >
              <PanelRightOpen className="h-4 w-4 text-teal-400" /> Show Preview
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile / tablet: preview lives in a drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background shadow-pop lg:hidden"
      >
        <FileText className="h-4 w-4 text-teal-400" /> Preview
      </button>
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[680px] flex-col bg-background p-4 shadow-pop lg:hidden"
              role="dialog"
              aria-label="Document preview"
            >
              <PreviewCanvas variant="drawer" onHide={() => setDrawerOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
