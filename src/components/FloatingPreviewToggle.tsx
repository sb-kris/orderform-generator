import { motion, AnimatePresence } from 'motion/react'
import { PanelRightClose, PanelRightOpen, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '@/state/store'
import { PreviewCanvas } from './PreviewCanvas'

/**
 * Preview controls that stay reachable wherever the user is:
 *
 * - Desktop (lg+): a pill that appears once the page is scrolled OR whenever
 *   the preview panel is collapsed. When collapsed it becomes a prominent
 *   accented "Show Preview" button so it's never missed; when open it offers
 *   scroll-to and minimise.
 * - Small screens (<lg): the side panel doesn't exist, so the pill opens the
 *   preview in a full-height drawer instead.
 *
 * z-index sits below the toasts (z-50) and above content; bottom-right
 * placement means it can never be obscured by the sticky toolbar.
 */
export function FloatingPreviewToggle() {
  const { layout, setLayout } = useStore()
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const collapsed = layout.previewCollapsed
  const desktopVisible = scrolled || collapsed

  const scrollPreviewIntoView = () => {
    const el = document.getElementById('quill-preview-panel')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {/* Desktop pill */}
      <AnimatePresence>
        {desktopVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-40 hidden lg:block"
          >
            {collapsed ? (
              // Prominent, accented — this is the only way back to the preview.
              <button
                type="button"
                onClick={() => setLayout({ previewCollapsed: false })}
                className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background shadow-pop ring-1 ring-black/5 transition-transform hover:scale-[1.02] active:scale-95"
                title="Show preview"
              >
                <PanelRightOpen className="h-4 w-4 text-teal-400" /> Show Preview
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-card/95 p-1 shadow-pop backdrop-blur">
                <button
                  type="button"
                  onClick={scrollPreviewIntoView}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
                  title="Scroll to preview"
                >
                  <FileText className="h-3.5 w-3.5" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => setLayout({ previewCollapsed: true })}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
                  title="Hide preview"
                  aria-label="Hide preview"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
