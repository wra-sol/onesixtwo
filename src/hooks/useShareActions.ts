import { useCallback, useState } from 'react'
import { trackEvent } from '@/lib/analytics'

const canNativeShare =
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export type ShareActions = {
  /** True when navigator.share exists in this browser. */
  canNativeShare: boolean
  /** True briefly after a successful clipboard copy. */
  copied: boolean
  /** True when the fallback "copy this text" block should render. */
  showShareText: boolean
  share: () => Promise<void>
  copy: () => Promise<void>
}

/**
 * The clipboard → native-share → fallback-text ladder shared by every
 * result screen. Callers own the title/text composition; this owns the
 * mechanics and the analytics events.
 */
export function useShareActions(
  shareUrl: string | null | undefined,
  shareTitle: string,
  shareText: string,
  trackProps: Record<string, string> = {},
): ShareActions {
  const [copied, setCopied] = useState(false)
  const [showShareText, setShowShareText] = useState(false)

  const copy = useCallback(async () => {
    if (!shareUrl) return
    setShowShareText(false)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      trackEvent('share_copied', trackProps)
      window.setTimeout(() => setCopied(false), 2000)
      return
    } catch {
      setCopied(false)
    }
    setShowShareText(true)
  }, [shareUrl, trackProps])

  const share = useCallback(async () => {
    if (!shareUrl) return
    if (!canNativeShare) {
      await copy()
      return
    }
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
      trackEvent('native_share_opened', trackProps)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      await copy()
    }
  }, [shareUrl, shareTitle, shareText, trackProps, copy])

  return { canNativeShare, copied, showShareText, share, copy }
}

export default useShareActions
