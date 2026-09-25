import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

export type GameMarkKind =
  | 'classic'
  | 'daily'
  | 'live'
  | 'sim162'
  | 'empty'
  | 'loading'
  | 'result'

type GameMarkProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  kind: GameMarkKind
  /** Supply a label only when the mark carries meaning without nearby text. */
  label?: string
}

function ClassicMark() {
  return (
    <>
      <path d="M24 5 43 24 24 43 5 24 24 5Z" fill="color-mix(in srgb, var(--primary) 10%, transparent)" stroke="currentColor" strokeWidth="1.8" />
      <path d="m24 12 12 12-12 12-12-12 12-12Z" stroke="color-mix(in srgb, var(--primary) 55%, transparent)" strokeWidth="1.2" />
      <path d="M24 5v7M43 24h-7M24 43v-7M5 24h7" stroke="currentColor" strokeWidth="1.4" />
    </>
  )
}

function DailyMark() {
  return (
    <>
      <rect x="8" y="5" width="32" height="38" rx="3" fill="color-mix(in srgb, var(--primary) 8%, transparent)" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 14h20M14 21h20M14 28h13M14 35h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m33 31 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L33 31Z" fill="color-mix(in srgb, var(--primary) 35%, transparent)" stroke="currentColor" strokeWidth="1.2" />
    </>
  )
}

function LiveMark() {
  return (
    <>
      <path d="M8 12h9a6 6 0 0 1 0 12h-1a6 6 0 0 0 0 12h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 12h9M31 36h9" stroke="color-mix(in srgb, var(--primary) 55%, transparent)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="12" r="2.4" fill="currentColor" />
      <circle cx="8" cy="36" r="2.4" fill="currentColor" />
      <circle cx="40" cy="12" r="2.4" fill="color-mix(in srgb, var(--primary) 65%, transparent)" />
      <circle cx="40" cy="36" r="2.4" fill="color-mix(in srgb, var(--primary) 65%, transparent)" />
    </>
  )
}

function Sim162Mark() {
  return (
    <>
      <path d="M24 5 40 14v14L24 37 8 28V14l16-9Z" fill="color-mix(in srgb, var(--primary) 8%, transparent)" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 15.5 24 12l8 3.5v8L24 27l-8-3.5v-8Z" stroke="color-mix(in srgb, var(--primary) 60%, transparent)" strokeWidth="1.4" />
      <path d="M24 27v10M18 40h12M20 37h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24 8v5M24 33v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  )
}

function EmptyMark() {
  return (
    <>
      <circle cx="24" cy="24" r="13" fill="color-mix(in srgb, var(--primary) 7%, transparent)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.5 16.5c3 2.3 4.4 4.9 4.4 7.5s-1.4 5.2-4.4 7.5M31.5 16.5c-3 2.3-4.4 4.9-4.4 7.5s1.4 5.2 4.4 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  )
}

function LoadingMark() {
  return (
    <>
      <path d="M24 6 42 24 24 42 6 24 24 6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
      <path d="m24 16 8 8-8 8-8-8 8-8Z" fill="color-mix(in srgb, var(--primary) 12%, transparent)" stroke="currentColor" strokeWidth="1.3" />
    </>
  )
}

function ResultMark() {
  return (
    <>
      <circle cx="24" cy="24" r="16" fill="color-mix(in srgb, var(--primary) 7%, transparent)" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 4v5M24 39v5M4 24h5M39 24h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  )
}

export function GameMark({
  kind,
  label,
  className,
  ...props
}: GameMarkProps) {
  const mark = {
    classic: <ClassicMark />,
    daily: <DailyMark />,
    live: <LiveMark />,
    sim162: <Sim162Mark />,
    empty: <EmptyMark />,
    loading: <LoadingMark />,
    result: <ResultMark />,
  }[kind]

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn('shrink-0', className)}
      {...props}
    >
      {label ? <title>{label}</title> : null}
      {mark}
    </svg>
  )
}

export function PlayerRoleGlyph({
  role,
  className,
}: {
  role: 'hitter' | 'pitcher' | 'two-way'
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {role === 'pitcher' ? (
        <>
          <path d="M7 5.5c2.6-1.4 5.3-1.4 7.9 0l1.3 8.4c-2.6 3.1-6.4 4.4-9.9 1.5L7 5.5Z" fill="color-mix(in srgb, var(--primary) 10%, transparent)" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.6 8.5c3.2 1.3 5.6 1.3 8.7 0M6.2 12c3.2 1.2 5.7 1.2 8.8 0" stroke="currentColor" strokeWidth="1.1" />
        </>
      ) : (
        <>
          <path d="m6 20 10.8-10.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m15.2 6.2 2.6 2.6M13.8 7.6l2.6 2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m5 21 2.5-.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {role === 'two-way' && (
            <circle cx="19" cy="18" r="2.2" fill="color-mix(in srgb, var(--primary) 45%, transparent)" stroke="currentColor" strokeWidth="1.1" />
          )}
        </>
      )}
    </svg>
  )
}
