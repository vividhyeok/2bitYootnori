import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(() => {
  const base = process.env.GH_PAGES ? '/2bitYootnori/' : '/'
  return {
    plugins: [react()],
    base,
  }
})
