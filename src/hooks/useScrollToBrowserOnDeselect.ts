import { useEffect, useRef } from 'react'

/**
 * After a selected player is assigned (selection clears), scrolls the player
 * browser back into view so the next pick is one glance away — instead of
 * leaving the user stranded at the lineup grid. Mobile only; desktop layouts
 * show both columns at once. No-ops when no `[data-player-browser]` anchor
 * exists (e.g. lineup phase, where the browser is not rendered).
 */
export function useScrollToBrowserOnDeselect(
  selectedPlayerId: string | null | undefined,
): void {
  const prevIdRef = useRef<string | null | undefined>(selectedPlayerId)

  useEffect(() => {
    const prevId = prevIdRef.current
    prevIdRef.current = selectedPlayerId
    if (!prevId || selectedPlayerId) return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    document
      .querySelector('[data-player-browser="true"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedPlayerId])
}

export default useScrollToBrowserOnDeselect
