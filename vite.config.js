import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const readerPort = Number(process.env.STUDY_READER_PORT) || 5210
const kbPort = Number(process.env.STUDY_KB_PORT) || 5214

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_KB_PORT': JSON.stringify(String(kbPort)),
  },
  server: {
    /** 固定 IPv4，避免 Windows 上 Vite 只绑 ::1 导致 Electron 等 127.0.0.1 永远连不上 */
    host: '127.0.0.1',
    port: readerPort,
    strictPort: !!process.env.STUDY_READER_PORT,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${kbPort}`,
        changeOrigin: true,
      },
    },
  },
})
