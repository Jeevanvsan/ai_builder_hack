import react from '@vitejs/plugin-react'
import { readdirSync } from 'node:fs'
import { defineConfig } from 'vite'

// Only request screenshots/videos that actually exist, so missing ones don't 404 in the console.
const list = (dir: string, ext: string) => {
  try { return readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)) } catch { return [] }
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
  define: {
    // Changes every build, so screenshot/video URLs never hit a stale browser cache.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    __SHOTS__: JSON.stringify(list('public/shots', '.png')),
    __VIDEOS__: JSON.stringify(list('public/videos', '.mp4')),
  },
})
