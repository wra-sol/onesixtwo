import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useShareActions } from '@/hooks/useShareActions'

type ShareResultPanelProps = {
  /** Share link; when null the share-specific chrome hides itself. */
  shareUrl: string | null
  shareTitle: string
  shareText: string
  trackProps?: Record<string, string>
  restartLabel: string
  onRestart: () => void
  showLeaderboard?: boolean
  /** Rendered between the copy fallback and the action buttons (e.g. submit slot). */
  children?: ReactNode
}

/**
 * The share ladder every result screen shows: preview text, clipboard
 * fallback, and the Share / Copy / restart / Leaderboard button row.
 * Callers own only what to say; this owns how sharing behaves.
 */
export function ShareResultPanel({
  shareUrl,
  shareTitle,
  shareText,
  trackProps = {},
  restartLabel,
  onRestart,
  showLeaderboard = false,
  children,
}: ShareResultPanelProps) {
  const {
    canNativeShare,
    copied,
    showShareText,
    share: handleShare,
    copy: handleCopy,
  } = useShareActions(shareUrl, shareTitle, shareText, trackProps)

  return (
    <div className="space-y-4">
      {shareUrl && (
        <details className="group rounded-lg border border-border bg-muted/30 text-left">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span
                className="text-muted-foreground transition group-open:rotate-90"
                aria-hidden
              >
                ▸
              </span>
              Preview share text
            </span>
          </summary>
          <pre className="max-h-40 overflow-y-auto border-t border-border/60 px-3 py-2 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {shareText}
          </pre>
        </details>
      )}

      {showShareText && shareUrl && (
        <div className="space-y-2 text-left">
          <p className="text-xs text-muted-foreground">
            Copy did not work in this browser. Select the text below:
          </p>
          <textarea
            readOnly
            className="h-28 w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-xs leading-relaxed"
            value={shareText}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}

      {children}

      <div className="flex flex-wrap justify-center gap-2">
        {shareUrl && canNativeShare && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleShare()}
          >
            Share
          </Button>
        )}
        {shareUrl && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </Button>
        )}
        <Button type="button" onClick={onRestart}>
          {restartLabel}
        </Button>
        {showLeaderboard && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = '/leaderboard'
            }}
          >
            Leaderboard
          </Button>
        )}
      </div>
    </div>
  )
}

export default ShareResultPanel
