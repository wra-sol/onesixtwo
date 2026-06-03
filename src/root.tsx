import { Outlet } from 'react-router-dom'

export default function Root() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b-2 border-primary bg-gradient-to-b from-[#152218] to-background px-4 py-3 text-center md:py-5">
        <h1 className="font-display text-2xl tracking-widest text-primary md:text-4xl">
          162-0
        </h1>
        <p className="hidden text-muted-foreground md:block">
          Can you go 162-0?
        </p>
      </header>
      <main className="relative mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden px-4 py-2 md:py-4">
        <Outlet />
      </main>
      <footer className="hidden shrink-0 border-t border-border px-4 py-4 text-center text-sm text-muted-foreground md:block">
        Inspired by{' '}
        <a
          href="https://www.82-0.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          82-0
        </a>
      </footer>
    </div>
  )
}
