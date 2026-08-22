import { useEffect } from 'react'

/**
 * Scrolls the first open slot's assign button into view whenever a player is
 * selected in assign mode. Shared by the classic, daily, and roster grids —
 * each passes its own data attribute.
 */
export function useScrollToFirstAssign(
  dataAttr: string,
  isAssigning: boolean,
  selectedPlayerId: string | null | undefined,
): void {
  useEffect(() => {
    if (!isAssigning || !selectedPlayerId) return
    const assignButton = document.querySelector(`[data-${dataAttr}="true"]`)
    assignButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // selectedPlayerId (not the object) keeps this stable across renders.
  }, [dataAttr, isAssigning, selectedPlayerId])
}

export default useScrollToFirstAssign
