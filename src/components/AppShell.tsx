import { useEffect, useMemo, useRef, useState } from 'react'
import { StickyToolbar } from './StickyToolbar'
import { SectionNavigation, SECTIONS } from './SectionNavigation'
import { CustomerInfoSection } from './sections/CustomerInfoSection'
import { SoldToSection } from './sections/SoldToSection'
import { ServicesTable } from './sections/ServicesTable'
import { BillingShippingSection } from './sections/BillingShippingSection'
import { SubscriptionDetailsSection } from './sections/SubscriptionDetailsSection'
import { TermsSection } from './sections/TermsSection'
import { SignatureSection } from './sections/SignatureSection'
import { PurchaseOrderSection } from './sections/PurchaseOrderSection'
import { PreviewCanvas } from './PreviewCanvas'
import { ValidationSummary } from './ValidationSummary'
import { FloatingPreviewToggle } from './FloatingPreviewToggle'
import { useStore } from '@/state/store'
import { validate } from '@/state/validation'
import { formatCurrency } from '@/lib/format'
import { CURRENCIES } from '@/lib/currency'
import { useResizable } from '@/lib/useResizable'
import { cn } from '@/lib/cn'

const SIDEBAR_EXPANDED = 224
const SIDEBAR_COLLAPSED = 60

export function AppShell() {
  const [activeId, setActiveId] = useState('customer')
  const { data, totals, layout, setLayout } = useStore()
  const issues = useMemo(() => validate(data), [data])

  const containerRef = useRef<HTMLDivElement>(null)
  const previewPane = useResizable({
    container: containerRef,
    initial: layout.previewPaneWidth,
    min: 0.24,
    max: 0.5,
    // The preview hangs from the right edge: dragging the handle right
    // shrinks it, dragging left grows it.
    anchor: 'right',
    onCommit: (v) => setLayout({ previewPaneWidth: v }),
  })

  const scrollTo = (id: string) => {
    setActiveId(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Highlight the section closest to the top of the viewport as the user scrolls.
  useEffect(() => {
    const opts = { rootMargin: '-40% 0px -55% 0px', threshold: 0.01 }
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.find((e) => e.isIntersecting)
      if (visible) setActiveId(visible.target.id)
    }, opts)
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  const previewCollapsed = layout.previewCollapsed
  const sidebarCollapsed = layout.sidebarCollapsed

  return (
    <div className="min-h-screen bg-background">
      <StickyToolbar onNavigateToSection={scrollTo} />

      <div
        ref={containerRef}
        className="relative mx-auto flex max-w-[1800px] gap-0 px-4 py-5"
        style={{ minHeight: 'calc(100vh - 76px)' }}
      >
        <aside
          className={cn(
            'hidden shrink-0 pr-4 lg:block lg:sticky lg:top-[76px] lg:self-start',
          )}
          style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
        >
          <SectionNavigation
            activeId={activeId}
            onSelect={scrollTo}
            issues={issues}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() =>
              setLayout({ sidebarCollapsed: !sidebarCollapsed })
            }
          />

          {!sidebarCollapsed && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-card p-3.5 shadow-xs">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Total ({CURRENCIES[data.currency].code})
              </div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-950">
                {formatCurrency(totals.total, data.currency)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {totals.populatedLines} populated line
                {totals.populatedLines === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </aside>

        <main
          className="min-w-0 flex-1 pr-4"
          style={{
            maxWidth: previewCollapsed
              ? undefined
              : `calc(100% - ${previewPane.fraction * 100}% - ${
                  sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
                }px)`,
          }}
        >
          <div className="grid gap-4">
            <ValidationSummary issues={issues} onGoto={scrollTo} />
            <CustomerInfoSection />
            <SoldToSection />
            <ServicesTable />
            <BillingShippingSection />
            <SubscriptionDetailsSection />
            <TermsSection />
            <SignatureSection />
            <PurchaseOrderSection />
            <FooterNote />
          </div>
        </main>

        {!previewCollapsed && (
          <>
            <div
              {...previewPane.handleProps}
              className="pane-resizer hidden lg:block"
              aria-label="Resize preview panel"
            />
            <aside
              id="quill-preview-panel"
              className="hidden shrink-0 lg:sticky lg:top-[76px] lg:block lg:self-start"
              style={{ width: `${previewPane.fraction * 100}%`, height: 'calc(100vh - 92px)' }}
            >
              <PreviewCanvas
                variant="pane"
                onHide={() => setLayout({ previewCollapsed: true })}
              />
            </aside>
          </>
        )}

      </div>
      <FloatingPreviewToggle />
    </div>
  )
}

function FooterNote() {
  return (
    <p className="text-[11px] leading-relaxed text-slate-500">
      All data stays in this browser (localStorage only). No analytics, no
      third-party requests. For a legally binding e-signature workflow —
      audit trail, signer authentication, envelope routing, and completion
      certificate — integrate with DocuSign, Adobe Sign, or PandaDoc.
    </p>
  )
}
