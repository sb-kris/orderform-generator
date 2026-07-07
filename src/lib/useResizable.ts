import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drag-based split-pane resize hook.
 *
 *  - `container` is the element whose bounding-box drives the ratio math.
 *  - `initial` is the starting fraction (0..1) of container width.
 *  - `min` and `max` clamp the fraction between sensible bounds so no pane
 *    can be squashed to zero.
 *  - `anchor` names the edge the sized pane hangs from. For a RIGHT-anchored
 *    pane (the preview), the fraction is measured from the right edge, so
 *    dragging the handle right shrinks the pane — the intuitive direction.
 *  - `onCommit` is invoked when the pointer is released so the caller can
 *    persist the new fraction.
 */
export function useResizable(opts: {
  container: React.RefObject<HTMLElement | null>
  initial: number
  min?: number
  max?: number
  anchor?: 'left' | 'right'
  onCommit?: (fraction: number) => void
}) {
  const { container, initial, min = 0.2, max = 0.7, anchor = 'left', onCommit } = opts
  const [fraction, setFraction] = useState(initial)
  const dragging = useRef(false)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    setFraction(initial)
  }, [initial])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragging.current = true
      const target = e.currentTarget
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        /* capture can fail for synthetic/stale pointers — drag still works */
      }
      target.dataset.dragging = 'true'
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !container.current) return
      const rect = container.current.getBoundingClientRect()
      const ratio =
        anchor === 'right'
          ? (rect.right - e.clientX) / rect.width
          : (e.clientX - rect.left) / rect.width
      const clamped = Math.max(min, Math.min(max, ratio))
      setFraction(clamped)
    },
    [container, max, min, anchor],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      dragging.current = false
      const target = e.currentTarget
      try {
        target.releasePointerCapture(e.pointerId)
      } catch {
        /* see setPointerCapture note */
      }
      target.dataset.dragging = 'false'
      commitRef.current?.(fraction)
    },
    [fraction],
  )

  return {
    fraction,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-valuenow': Math.round(fraction * 100),
      tabIndex: 0,
    },
  }
}
