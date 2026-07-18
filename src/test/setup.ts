// Vitest global setup.
//
// The jsdom environment in this project does not provide a working Storage
// implementation — `window.localStorage` exists but has no getItem/setItem/
// clear methods. Install a minimal in-memory Storage so tests that exercise
// client-side persistence (daily-draft resume, etc.) behave like a browser.
import { beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

function installStorage(name: 'localStorage' | 'sessionStorage') {
  Object.defineProperty(window, name, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  })
}

installStorage('localStorage')
installStorage('sessionStorage')

// Start every test with a clean slate so persisted state can't leak across tests.
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})
