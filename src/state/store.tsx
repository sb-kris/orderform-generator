import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_LAYOUT_PREFS,
  defaultData,
  emptyLine,
  type LayoutPrefs,
  type OrderFormData,
  type ServiceLine,
} from './types'
import { parseNumber } from '@/lib/format'

const STORAGE_KEY = 'quill-order-form-draft-v2'
const STORAGE_TS_KEY = 'quill-order-form-draft-v2-savedAt'
const LAYOUT_KEY = 'quill-layout-prefs-v1'
const READINESS_KEY = 'quill-readiness-checked-v1'

type Action =
  | { type: 'set'; data: OrderFormData }
  | { type: 'update'; patch: (prev: OrderFormData) => OrderFormData }
  | { type: 'reset' }

function reducer(state: OrderFormData, action: Action): OrderFormData {
  switch (action.type) {
    case 'set':
      return action.data
    case 'update':
      return action.patch(state)
    case 'reset':
      return defaultData()
  }
}

export type SaveStatus = 'clean' | 'unsaved' | 'saved'

type StoreValue = {
  data: OrderFormData
  update: (patch: (prev: OrderFormData) => OrderFormData) => void
  reset: () => void
  saveDraft: () => boolean
  loadDraft: () => boolean
  saveStatus: SaveStatus
  lastSavedAt: number | null
  totals: {
    subtotal: number
    total: number
    lineSubtotals: number[]
    populatedLines: number
  }
  layout: LayoutPrefs
  setLayout: (patch: Partial<LayoutPrefs>) => void
  toggleSectionCollapsed: (id: string) => void
  expandSection: (id: string) => void
  /**
   * Whether the readiness dashboard has been "turned on" for this draft. Until
   * then the form stays in a calm draft state (no critical-error dashboard,
   * no per-section error badges). Set by "Check readiness" or any export.
   */
  hasRunReadinessCheck: boolean
  runReadinessCheck: () => void
  /** Acknowledge a QA warning so it no longer counts against readiness. */
  ignoreWarning: (id: string, dependencyKey: string) => void
  /** Restore a previously-acknowledged warning. */
  restoreWarning: (id: string) => void
  /** Session-only record of the most recent successful export. */
  lastExport: { type: string; at: number } | null
  recordExport: (type: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, defaultData)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('clean')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    try {
      const ts = localStorage.getItem(STORAGE_TS_KEY)
      return ts ? Number(ts) : null
    } catch {
      return null
    }
  })
  const [layout, setLayoutState] = useState<LayoutPrefs>(() => loadLayout())
  const [lastExport, setLastExport] = useState<{ type: string; at: number } | null>(null)
  // Starts false on every fresh mount; the load effect re-enables it only when a
  // saved draft that had already been checked is restored.
  const [hasRunReadinessCheck, setHasRunReadinessCheck] = useState(false)

  const runReadinessCheck = useCallback(() => {
    setHasRunReadinessCheck(true)
    try {
      localStorage.setItem(READINESS_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const update = useCallback((patch: (prev: OrderFormData) => OrderFormData) => {
    dispatch({ type: 'update', patch })
    setSaveStatus('unsaved')
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
    setSaveStatus('clean')
    setLastSavedAt(null)
    // Back to the calm draft state — no lingering readiness dashboard.
    setHasRunReadinessCheck(false)
    try {
      localStorage.removeItem(READINESS_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  /**
   * Returns false when the write failed (typically QuotaExceededError from
   * oversized image uploads) so the toolbar can tell the user instead of
   * showing a false "saved" confirmation.
   */
  const saveDraft = useCallback((): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      const now = Date.now()
      localStorage.setItem(STORAGE_TS_KEY, String(now))
      setLastSavedAt(now)
      setSaveStatus('saved')
      return true
    } catch {
      return false
    }
  }, [data])

  const loadDraft = useCallback((): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as Partial<OrderFormData>
      const base = defaultData()
      const merged: OrderFormData = {
        ...base,
        ...parsed,
        documentId: parsed.documentId ?? base.documentId,
        currency: parsed.currency ?? base.currency,
        customer: { ...base.customer, ...parsed.customer },
        soldTo: { ...base.soldTo, ...parsed.soldTo },
        services:
          parsed.services && parsed.services.length
            ? parsed.services.map((s: ServiceLine) => ({
                id: s.id ?? crypto.randomUUID(),
                description: s.description ?? '',
                price: s.price ?? '',
                quantity: s.quantity ?? '',
              }))
            : Array.from({ length: 6 }, emptyLine),
        billing: {
          ...base.billing,
          ...parsed.billing,
          billTo: { ...base.billing.billTo, ...parsed.billing?.billTo },
          shipTo: { ...base.billing.shipTo, ...parsed.billing?.shipTo },
        },
        subscription: { ...base.subscription, ...parsed.subscription },
        customerLogo: parsed.customerLogo ?? base.customerLogo,
        ignoredWarnings: parsed.ignoredWarnings ?? base.ignoredWarnings,
        termOverrides: parsed.termOverrides ?? base.termOverrides,
        signature: {
          customer: { ...base.signature.customer, ...parsed.signature?.customer },
          surveysparrow: {
            ...base.signature.surveysparrow,
            ...parsed.signature?.surveysparrow,
          },
        },
        purchaseOrder: { ...base.purchaseOrder, ...parsed.purchaseOrder },
      }
      dispatch({ type: 'set', data: merged })
      setSaveStatus('saved')
      return true
    } catch {
      return false
    }
  }, [])

  const setLayout = useCallback((patch: Partial<LayoutPrefs>) => {
    setLayoutState((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const recordExport = useCallback((type: string) => {
    setLastExport({ type, at: Date.now() })
  }, [])

  /** Persist a full draft immediately (used for acknowledge/restore actions). */
  const persistNow = useCallback((next: OrderFormData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      const now = Date.now()
      localStorage.setItem(STORAGE_TS_KEY, String(now))
      setLastSavedAt(now)
      setSaveStatus('saved')
    } catch {
      /* ignore quota errors — the in-memory state still reflects the change */
    }
  }, [])

  const ignoreWarning = useCallback(
    (id: string, dependencyKey: string) => {
      const next: OrderFormData = {
        ...data,
        ignoredWarnings: { ...data.ignoredWarnings, [id]: dependencyKey },
      }
      dispatch({ type: 'set', data: next })
      persistNow(next)
    },
    [data, persistNow],
  )

  const restoreWarning = useCallback(
    (id: string) => {
      const nextIgnored = { ...data.ignoredWarnings }
      delete nextIgnored[id]
      const next: OrderFormData = { ...data, ignoredWarnings: nextIgnored }
      dispatch({ type: 'set', data: next })
      persistNow(next)
    },
    [data, persistNow],
  )

  const expandSection = useCallback((id: string) => {
    setLayoutState((prev) => {
      if (!prev.collapsedSections.includes(id)) return prev
      const next = {
        ...prev,
        collapsedSections: prev.collapsedSections.filter((s) => s !== id),
      }
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const toggleSectionCollapsed = useCallback((id: string) => {
    setLayoutState((prev) => {
      const collapsed = prev.collapsedSections.includes(id)
        ? prev.collapsedSections.filter((s) => s !== id)
        : [...prev.collapsedSections, id]
      const next = { ...prev, collapsedSections: collapsed }
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const totals = useMemo(() => {
    const lineSubtotals = data.services.map(
      (l) => parseNumber(l.price) * parseNumber(l.quantity),
    )
    const subtotal = lineSubtotals.reduce((a, b) => a + b, 0)
    const populatedLines = data.services.filter(
      (l) => l.description.trim() || parseNumber(l.price) || parseNumber(l.quantity),
    ).length
    return { subtotal, total: subtotal, lineSubtotals, populatedLines }
  }, [data.services])

  useEffect(() => {
    const ok = loadDraft()
    // Only restore the readiness-checked state for a real saved draft; a blank
    // first-load always starts calm (and any stale flag is cleared).
    if (ok) {
      try {
        if (localStorage.getItem(READINESS_KEY) === '1') setHasRunReadinessCheck(true)
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem(READINESS_KEY)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: StoreValue = {
    data,
    update,
    reset,
    saveDraft,
    loadDraft,
    saveStatus,
    lastSavedAt,
    totals,
    layout,
    setLayout,
    toggleSectionCollapsed,
    expandSection,
    hasRunReadinessCheck,
    runReadinessCheck,
    ignoreWarning,
    restoreWarning,
    lastExport,
    recordExport,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function loadLayout(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return DEFAULT_LAYOUT_PREFS
    const parsed = JSON.parse(raw) as Partial<LayoutPrefs>
    return { ...DEFAULT_LAYOUT_PREFS, ...parsed }
  } catch {
    return DEFAULT_LAYOUT_PREFS
  }
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_TS_KEY)
    localStorage.removeItem(READINESS_KEY)
  } catch {
    /* ignore */
  }
}
