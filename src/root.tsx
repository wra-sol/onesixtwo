import { Outlet } from 'react-router-dom'

export default function Root() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="logo">162-0</h1>
        <p className="tagline">Can you go 162-0?</p>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
