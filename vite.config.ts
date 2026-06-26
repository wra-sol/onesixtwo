/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function cloudflareBeaconPlugin() {
  return {
    name: 'cloudflare-beacon',
    transformIndexHtml(html: string) {
      const token = process.env.VITE_CF_BEACON_TOKEN
      if (!token) return html
      const snippet = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`
      return html.replace('</body>', `${snippet}</body>`)
    },
  }
}

const devApiOrigin = process.env.VITE_DEV_API_ORIGIN ?? 'http://127.0.0.1:8790'

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflareBeaconPlugin()],
  server: {
    proxy: {
      '/api': {
        target: devApiOrigin,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared/live': path.resolve(__dirname, './shared/live'),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
