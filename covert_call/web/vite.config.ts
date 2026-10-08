import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Demo clips keep their file names when replaced; this build stamp in their URL makes browsers fetch the new one.
  define: { __DEMO_V__: JSON.stringify(String(Date.now())) },
})
