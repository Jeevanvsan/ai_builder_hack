import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
  // Changes every build, so screenshot/video URLs never hit a stale browser cache.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
})
